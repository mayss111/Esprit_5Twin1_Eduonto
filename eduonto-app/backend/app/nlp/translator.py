"""Traducteur « question en français → requête SPARQL », sans LLM.

Pipeline (outils à citer dans la présentation) :
  1. Normalisation du texte (minuscules, accents retirés)                      — Python / unicodedata
  2. Tokenisation et lemmatisation                                              — spaCy (fr_core_news_sm)
  3. Reconnaissance des entités de l'ontologie (Ahmed, Angular, DataScientist…)  — spaCy PhraseMatcher
     + correction des fautes de frappe (« Angulr » → Angular)                    — rapidfuzz (optionnel)
  4. Détection de l'intention : score de mots-clés + similarité sémantique avec
     les questions-exemples (optionnel, EDUONTO_EMB=1), puis repli zero-shot      — sentence-transformers / Hugging Face
  5. Remplissage d'un modèle de requête SPARQL avec les entités, les nombres,
     l'opérateur de comparaison et les valeurs d'énumération (Master, Rattrapage…) — templates
"""
import os
import re
import unicodedata
from threading import Lock

import spacy
from spacy.matcher import PhraseMatcher
from spacy.util import filter_spans

from .. import store
from .intents import ALL_INTENTS

HF_MODEL = "MoritzLaurer/mDeBERTa-v3-base-mnli-xnli"                       # zero-shot multilingue (français compris)
EMB_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"  # phrases → vecteurs (similarité cosinus)
LABEL_PROPS = ["prenom", "nom", "intitule", "intituleFormation", "libelleCompetence",
               "intituleMetier", "libelleDomaine", "titre", "nomParcours"]

# Score final d'une intention = POIDS["mots_cles"] × score mots-clés normalisé (1 - 0,5^nb mots trouvés)
#                              + POIDS["semantique"] × similarité cosinus avec ses questions-exemples
POIDS = {"mots_cles": 0.5, "semantique": 0.5}
BONUS_PARAMETRE = 0.03     # par paramètre rempli : à score égal, l'intention la plus précise passe devant
PENALITE_ENTITE = 0.15     # par entité citée dont aucun paramètre de l'intention n'a l'usage (« … en TWIN »)
SEUIL_SEMANTIQUE = 0.6     # sans aucun mot-clé, la similarité seule doit atteindre ce seuil
SEUIL_ZERO_SHOT = 0.4
SEUIL_CONFIANCE = 0.35     # en dessous : la réponse propose des questions-exemples
SEUIL_FUZZY = 85           # rapidfuzz (0-100) : « angulr » / « angular » = 92
EGALITE = 0.01

# Opérateurs de comparaison (texte normalisé). Les expressions les plus longues sont testées d'abord.
OPERATEURS = {
    "superieure ou egale": ">=", "superieur ou egal": ">=", "au moins": ">=", "minimum": ">=", "a partir de": ">=",
    "pas plus de": "<=", "inferieure ou egale": "<=", "inferieur ou egal": "<=", "au plus": "<=", "maximum": "<=",
    "plus de": ">", "superieure": ">", "superieur": ">", "au dessus": ">", "depasse": ">", "plus grande": ">",
    "moins de": "<", "inferieure": "<", "inferieur": "<", "en dessous": "<", "sous": "<", "plus petite": "<",
}
# Mots qui renvoient à la question précédente (« et ses notes ? », « quelle est sa moyenne ? »)
ANAPHORES = {"sa", "son", "ses", "il", "elle", "lui", "leur", "leurs", "ma", "mon", "mes", "je", "me", "moi"}


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFD", text.lower())
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = re.sub(r"[-_'’?!.,;:]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def split_camel(name: str) -> str:
    return re.sub(r"(?<=[a-z])(?=[A-Z])", " ", name.replace("_", " "))


def premiere_ligne(e: Exception) -> str:
    return (str(e).splitlines() or [type(e).__name__])[0]


def exemples(intent) -> list[str]:
    """Questions-exemples d'une intention (à défaut : sa description)."""
    return intent.get("exemples") or [intent["description"]]


class Translator:
    def __init__(self):
        try:
            self.nlp = spacy.load("fr_core_news_sm")
            self.model = "fr_core_news_sm"
        except OSError:                                   # modèle non installé : tokeniseur seul
            self.nlp = spacy.blank("fr")
            self.model = "spacy.blank('fr')"
        self.zero_shot = self.load_zero_shot()
        self.fuzzy = self.load_fuzzy()
        self.build_lexicon()
        store.on_change(self.build_lexicon)               # lexique à jour après chaque INSERT / DELETE / rechargement
        self._verrou_emb = Lock()                         # un encodage à la fois
        self.embedder, self.vecteurs = self.load_embeddings()
        # classes attendues par les paramètres des intentions (Etudiant, Cours…) : sert à reporter le contexte
        self.types_slots = {t for i in ALL_INTENTS for t in i.get("slots", {}).values()
                            if isinstance(t, str) and t not in ("number", "CLASS")}

    def load_zero_shot(self):
        """Charge le modèle zero-shot dès le démarrage si EDUONTO_HF=1 (sinon, ou si transformers manque : None)."""
        if os.getenv("EDUONTO_HF") != "1":
            return None
        try:
            from transformers import pipeline
            return pipeline("zero-shot-classification", model=HF_MODEL)
        except Exception as e:                            # transformers absent, pas de réseau…
            print(f"[EduOnto] zero-shot désactivé : {premiere_ligne(e)}")
            return None

    def load_fuzzy(self):
        """rapidfuzz (distance d'édition) s'il est installé, sinon None : pas de correction des fautes."""
        if os.getenv("EDUONTO_FUZZY") == "0":
            return None
        try:
            from rapidfuzz import fuzz, process
            return {"fuzz": fuzz, "process": process}
        except ImportError:
            print("[EduOnto] correction des fautes désactivée : pip install rapidfuzz")
            return None

    def load_embeddings(self):
        """Si EDUONTO_EMB=1 et sentence-transformers installé : encode UNE fois les exemples de chaque intention.
        Renvoie (modèle, {nom d'intention: matrice des vecteurs normalisés}) ou (None, {})."""
        if os.getenv("EDUONTO_EMB") != "1":
            return None, {}
        try:
            from sentence_transformers import SentenceTransformer
            modele = SentenceTransformer(EMB_MODEL)
        except Exception as e:                            # bibliothèque absente, pas de réseau…
            print(f"[EduOnto] similarité sémantique désactivée : {premiere_ligne(e)}")
            return None, {}
        vecteurs = {}
        for intent in ALL_INTENTS:
            textes = [self.masquer(self.analyser(q)) for q in exemples(intent)]
            vecteurs[intent["name"]] = modele.encode(textes, normalize_embeddings=True)
        return modele, vecteurs

    # ---------- 3. lexique des entités, construit depuis l'ontologie ----------
    def build_lexicon(self):
        """Reconstruit le lexique à partir de zéro, puis remplace l'ancien d'un coup
        (une question traitée en parallèle utilise l'ancien ou le nouveau, jamais un lexique à moitié construit)."""
        matcher = PhraseMatcher(self.nlp.vocab, attr="LOWER")
        entity_types = {}                                 # id -> {classes de l'individu (et ancêtres)}
        rows = store.select("""
            SELECT ?i ?c WHERE { ?i a owl:NamedIndividual ; a ?t . ?t rdfs:subClassOf* ?c . FILTER(isIRI(?c)) }""")
        for r in rows:
            entity_types.setdefault(r["i"], set()).add(r["c"])
        labels = {}                                       # id -> libellés (prenom, intitule…), en une seule requête
        valeurs = " ".join(f"edu:{p}" for p in LABEL_PROPS)
        for r in store.select(f"SELECT ?i ?v WHERE {{ VALUES ?p {{ {valeurs} }} ?i ?p ?v }}"):
            labels.setdefault(r["i"], set()).add(normalize(str(r["v"])))
        for r in store.select("SELECT ?i ?code WHERE { ?i edu:codeFormation ?code }"):
            labels.setdefault(r["i"], set()).add(normalize(str(r["code"])))
        classes = store.select("SELECT ?c WHERE { ?c a owl:Class . FILTER(isIRI(?c)) }")
        noms_classes = {normalize(split_camel(r["c"])) for r in classes}
        libelles = {}                                     # libellé d'un seul mot -> id (pour la correction des fautes)
        for ident in entity_types:
            # « JavaScript » → « java script » ET « javascript » : l'identifiant collé est aussi reconnu
            phrases = {normalize(split_camel(ident)), normalize(ident.replace("_", " "))} | labels.get(ident, set())
            if "Formation" in entity_types[ident]:
                phrases |= self.alias_formation(ident, labels.get(ident, set())) - noms_classes
            patterns = [self.nlp.make_doc(ph) for ph in phrases if len(ph) > 2]
            if patterns:
                matcher.add("IND|" + ident, patterns)
            for ph in phrases:
                if " " not in ph and len(ph) >= 3:
                    libelles.setdefault(ph, ident)
        mots_connus = set()                               # mots à ne jamais « corriger » (mots-clés, classes, valeurs…)
        for r in classes:
            words = normalize(split_camel(r["c"]))
            matcher.add("CLS|" + r["c"], [self.nlp.make_doc(words), self.nlp.make_doc(words + "s")])
            mots_connus.update(words.split())
        for intent in ALL_INTENTS:
            for k in intent["keywords"]:
                mots_connus.update(k.split())
            for spec in intent.get("slots", {}).values():
                if isinstance(spec, dict):
                    mots_connus.update(normalize(v) for v in spec.get("enum", []))
        mots_connus.update(w for expr in OPERATEURS for w in expr.split())
        self.matcher, self.entity_types = matcher, entity_types
        self.libelles, self.mots_connus = libelles, mots_connus

    @staticmethod
    def alias_formation(ident, libelles):
        """Noms courts d'une formation : fin de l'identifiant (Ingenieur_TroncCommun → « tronc commun »)
        et fin du code (ING-TWIN → « twin »). Les noms de classes (« génie logiciel ») sont retirés par l'appelant."""
        alias = set()
        if "_" in ident:
            alias.add(normalize(split_camel(ident.split("_", 1)[1])))
        for lib in libelles:
            fin = lib.split()[-1]
            if len(lib.split()) == 2 and len(fin) >= 3:   # code « ing twin » → « twin »
                alias.add(fin)
        return {a for a in alias if len(a) >= 3}

    def entities(self, doc):
        """Entités trouvées par le PhraseMatcher. Renvoie (entités, positions [(début, fin, genre)])."""
        matcher = self.matcher                            # même lexique pendant toute l'analyse
        matches = [(*self.nlp.vocab.strings[mid].split("|", 1), s, e) for mid, s, e in matcher(doc)]
        choisis = []
        # les individus d'abord : dans « métier Data scientist », DataScientist l'emporte sur la classe MetierData
        for kind in ("IND", "CLS"):
            occupe = {i for _, _, s, e in choisis for i in range(s, e)}
            spans = [doc[s:e] for k, _, s, e in matches if k == kind and not occupe & set(range(s, e))]
            for span in filter_spans(spans):              # garde les correspondances les plus longues
                ident = next(i for k, i, s, e in matches if k == kind and (s, e) == (span.start, span.end))
                choisis.append((kind, ident, span.start, span.end))
        found, positions = [], []
        for kind, ident, s, e in sorted(choisis, key=lambda c: c[2]):
            genre = "individu" if kind == "IND" else "classe"
            found.append({"texte": doc[s:e].text, "id": ident, "genre": genre})
            positions.append((s, e, genre))
        return found, positions

    def corriger(self, question, doc, ents, positions):
        """Tolérance aux fautes de frappe (rapidfuzz) : un mot non reconnu d'au moins 4 lettres est comparé aux
        libellés du lexique ; au-dessus de SEUIL_FUZZY il devient une entité, avec la correction affichée."""
        if self.fuzzy is None:
            return
        process, fuzz = self.fuzzy["process"], self.fuzzy["fuzz"]
        libelles, mots_connus = self.libelles, self.mots_connus
        deja = {e["id"] for e in ents}
        couverts = {i for s, e, _ in positions for i in range(s, e)}
        for tok in doc:
            mot = tok.text
            if tok.i in couverts or len(mot) < 4 or not mot.isalpha() or tok.is_stop or mot in mots_connus:
                continue
            res = process.extractOne(mot, libelles.keys(), scorer=fuzz.ratio, score_cutoff=SEUIL_FUZZY)
            if res is None or res[0] == mot or libelles[res[0]] in deja:
                continue
            ident = libelles[res[0]]
            original = next((w for w in re.findall(r"\w+", question) if normalize(w) == mot), mot)
            ents.append({"texte": mot, "id": ident, "genre": "individu",
                         "correction": f"{original} → {ident}", "score_fuzzy": round(res[1])})
            positions.append((tok.i, tok.i + 1, "individu"))
            deja.add(ident)

    def analyser(self, question: str) -> dict:
        """Étapes 1 à 3 : normalisation, spaCy, entités (+ corrections)."""
        text = normalize(question)
        doc = self.nlp(text)
        ents, positions = self.entities(doc)
        self.corriger(question, doc, ents, positions)
        return {"text": text, "doc": doc, "ents": ents, "positions": positions}

    @staticmethod
    def masquer(a) -> str:
        """Texte où chaque individu est remplacé par « X » : la similarité porte sur la forme de la question
        (« qui enseigne X ») et non sur les noms propres."""
        debuts = {s: e for s, e, genre in a["positions"] if genre == "individu"}
        mots, i = [], 0
        while i < len(a["doc"]):
            if i in debuts:
                mots.append("X")
                i = debuts[i]
            else:
                mots.append(a["doc"][i].text)
                i += 1
        return " ".join(mots)

    # ---------- 4. intention ----------
    def keyword_score(self, intent, text, lemmas):
        # singulier et pluriel d'un même mot (« métier » via le lemme, « métiers » dans le texte) comptent une fois
        return len({k.rstrip("s") for k in intent["keywords"] if re.search(rf"\b{re.escape(k)}\b", text) or k in lemmas})

    @staticmethod
    def nombres(question: str) -> list[float]:
        """Nombres de la question, sauf les ordinaux (« 4e année »)."""
        return [float(m.group().replace(",", "."))
                for m in re.finditer(r"\d+(?:[.,]\d+)?", question)
                if not re.match(r"\s*(?:e|ème|eme|er|ère|ere)\b", question[m.end():], re.IGNORECASE)]

    @staticmethod
    def operateur(text: str):
        """Opérateur de comparaison exprimé dans la question (« inférieure à » → "<"), ou None."""
        for expr in sorted(OPERATEURS, key=len, reverse=True):
            if re.search(rf"\b{expr}\b", text):
                return OPERATEURS[expr]
        return None

    @staticmethod
    def valeur_enum(valeurs, texte):
        """Valeur d'énumération citée dans le texte (sans accents, pluriel / féminin tolérés), la première trouvée."""
        trouvees = []
        for v in valeurs:
            racine = normalize(v)
            racine = racine[:-1] if racine.endswith("e") else racine
            m = re.search(rf"\b{re.escape(racine)}\w{{0,3}}\b", texte)
            if m:
                trouvees.append((m.start(), v))
        return min(trouvees)[1] if trouvees else None

    def fill_slots(self, intent, ents, numbers, texte_libre, contexte):
        """Remplit les paramètres d'une intention. Renvoie (valeurs, paramètres pris dans le contexte) ou None."""
        values, du_contexte = {}, {}
        for slot, expected in intent.get("slots", {}).items():
            if isinstance(expected, dict):                # {"enum": [...]} : valeur d'une énumération
                v = self.valeur_enum(expected.get("enum", []), texte_libre)
                if v is None:
                    return None
                values[slot] = v
            elif expected == "number":
                if not numbers:
                    return None
                values[slot] = numbers[0]
            elif expected == "CLASS":
                cls = [e for e in ents if e["genre"] == "classe"]
                if not cls:
                    return None
                values[slot] = cls[0]["id"]
            else:
                match = [e for e in ents if e["genre"] == "individu" and expected in self.entity_types.get(e["id"], ())]
                if match:
                    values[slot] = match[0]["id"]
                    continue
                ctx = [i for i in contexte if expected in self.entity_types.get(i, ())]
                if not ctx:
                    return None
                values[slot] = du_contexte[slot] = ctx[0]
        return values, du_contexte

    def similarites(self, texte_masque):
        """Similarité cosinus entre la question et les exemples de chaque intention (la meilleure par intention)."""
        if self.embedder is None:
            return {}
        with self._verrou_emb:
            q = self.embedder.encode([texte_masque], normalize_embeddings=True)[0]
        return {nom: max(0.0, float((m @ q).max())) for nom, m in self.vecteurs.items()}

    def zero_shot_choice(self, question, candidates):
        """Repli optionnel (EDUONTO_HF=1) : classification zero-shot Hugging Face.
        Renvoie (meilleur candidat ou None, score, 3 meilleurs scores [{intention, score}])."""
        if self.zero_shot is None or not candidates:
            return None, 0.0, []
        labels = [c["intent"]["description"] for c in candidates]
        res = self.zero_shot(question, labels, hypothesis_template="Cette question porte sur {}.")
        top = [{"intention": candidates[labels.index(l)]["intent"]["name"], "score": round(float(s), 3)}
               for l, s in zip(res["labels"][:3], res["scores"][:3])]
        best = candidates[labels.index(res["labels"][0])]
        score = float(res["scores"][0])
        return (best if score > SEUIL_ZERO_SHOT else None), score, top

    def contexte_valide(self, contexte) -> list[str]:
        """Identifiants d'individus du contexte envoyé par le client : seuls ceux qui existent dans l'ontologie sont gardés."""
        ids = []
        for e in contexte or []:
            ident = e.get("id") if isinstance(e, dict) else e
            if not isinstance(ident, str):
                continue
            try:
                ident = store.check_id(ident)
            except ValueError:
                continue
            if ident in self.entity_types and ident not in ids:
                ids.append(ident)
        return ids

    @staticmethod
    def suggestions(classes, proches):
        """Première question-exemple des 3 meilleures intentions : les candidates d'abord, puis les plus proches
        de la question même si leurs paramètres manquent."""
        vus, res = set(), []
        for intent in [c["intent"] for c in classes] + proches:
            if intent["name"] not in vus and intent.get("exemples"):
                vus.add(intent["name"])
                res.append(intent["exemples"][0])
        return res[:3]

    # ---------- pipeline complet ----------
    def translate(self, question: str, contexte=None) -> dict:
        a = self.analyser(question)
        text, doc, ents = a["text"], a["doc"], a["ents"]
        lemmas = {normalize(t.lemma_) for t in doc if t.lemma_}
        numbers = self.nombres(question)
        op = self.operateur(text)
        # les valeurs d'énumération se cherchent hors des noms d'individus (« ingénieur DevOps » n'est pas un niveau)
        dans_individu = {i for s, e, genre in a["positions"] if genre == "individu" for i in range(s, e)}
        texte_libre = " ".join(t.text for t in doc if t.i not in dans_individu)
        ctx = self.contexte_valide(contexte)
        anaphore = bool(ANAPHORES & {t.text for t in doc}) or text.startswith("et ")
        sims = self.similarites(self.masquer(a))

        # types « utiles » des individus cités (Etudiant, Cours, Formation…)
        types_cites = [self.entity_types.get(e["id"], set()) & self.types_slots for e in ents if e["genre"] == "individu"]
        candidates = []
        for intent in ALL_INTENTS:
            # mots_requis : une liste (un de ces mots) ou une liste de groupes (un mot de CHAQUE groupe)
            requis = intent.get("mots_requis") or []
            groupes = requis if requis and isinstance(requis[0], list) else [requis] if requis else []
            if not all(any(re.search(rf"\b{re.escape(m)}\b", text) or m in lemmas for m in g) for g in groupes):
                continue                                  # ex. « combien » seul ne suffit pas à nb_competences_metier
            filled = self.fill_slots(intent, ents, numbers, texte_libre, ctx)
            if filled is None:
                continue
            slots, du_ctx = filled
            if "{op}" in intent["template"]:
                slots["op"] = op or intent.get("op_defaut", ">=")
            kw = self.keyword_score(intent, text, lemmas)
            kw_norm = 1 - 0.5 ** kw
            sem = sims.get(intent["name"], 0.0)
            base = POIDS["mots_cles"] * kw_norm + POIDS["semantique"] * sem if sims else kw_norm
            # une entité citée que l'intention n'utilise pas : elle répond probablement à une autre question
            types_intent = {t for t in intent.get("slots", {}).values() if isinstance(t, str)}
            orphelines = sum(1 for t in types_cites if t and not t & types_intent)
            base = max(0.0, base - PENALITE_ENTITE * orphelines)
            # un paramètre pris dans le contexte ne compte que si la question y renvoie (« ses », « sa »…)
            # (une classe, slot générique de lister_classe, ne rend pas l'intention plus précise)
            de_la_question = len([s for s, t in intent.get("slots", {}).items() if t != "CLASS"]) - len(du_ctx)
            precision = de_la_question + (len(du_ctx) if anaphore else -len(du_ctx))
            candidates.append({"intent": intent, "slots": slots, "du_ctx": du_ctx, "kw": kw, "sem": sem,
                               "base": base, "score": base + BONUS_PARAMETRE * precision, "precision": precision})
        candidates.sort(key=lambda c: (c["score"], c["precision"]), reverse=True)

        best, confiance, scores_zs = None, 0.0, []
        if candidates and (candidates[0]["kw"] > 0 or (sims and candidates[0]["sem"] >= SEUIL_SEMANTIQUE)):
            best, confiance = candidates[0], min(1.0, candidates[0]["base"])
            if not sims:
                methode = "mots-clés"
            else:
                par_mots_cles = max(candidates, key=lambda c: (c["kw"], c["precision"]))
                methode = ("mots-clés + sémantique" if best["kw"] > 0 and par_mots_cles is best
                           else "similarité sémantique")
        else:
            best, confiance, scores_zs = self.zero_shot_choice(question, candidates)
            methode = "zero-shot (Hugging Face)"

        autres = [c for c in candidates if c is not best]
        alternatives = [{"intention": c["intent"]["name"], "score": round(c["score"], 3)} for c in autres[:3]]
        egalite = best is not None and bool(autres) and abs(autres[0]["score"] - best["score"]) < EGALITE
        # contexte renvoyé au client : les individus de cette question, plus ceux du contexte d'un autre type
        nouveau_ctx = [{"id": e["id"], "texte": e["texte"], "genre": "individu"} for e in ents if e["genre"] == "individu"]
        types_vus = {t for e in nouveau_ctx for t in self.entity_types.get(e["id"], ()) if t in self.types_slots}
        nouveau_ctx += [{"id": i, "texte": i, "genre": "individu"} for i in ctx
                        if not (self.entity_types.get(i, set()) & self.types_slots & types_vus)]
        nouveau_ctx = nouveau_ctx[:5]
        proches = sorted(ALL_INTENTS, key=lambda i: (self.keyword_score(i, text, lemmas), sims.get(i["name"], 0)),
                         reverse=True)

        if best is None:
            rep = {"question": question, "intention": None, "entites": ents, "sparql": None,
                   "message": "Question non comprise. Reformulez avec un nom de l'ontologie (ex. Ahmed, Angular).",
                   "confiance": round(confiance, 3), "alternatives": alternatives,
                   "suggestions": self.suggestions(candidates, proches), "contexte": nouveau_ctx}
            if scores_zs:
                rep["scores_zero_shot"] = scores_zs
            return rep

        intent, slots = best["intent"], best["slots"]
        valeurs = {}
        for k, v in slots.items():
            spec = intent.get("slots", {}).get(k)
            if isinstance(v, float):
                valeurs[k] = int(v) if v.is_integer() else v
            elif k == "op" or isinstance(spec, dict):     # opérateur et énumération : valeurs d'une liste fermée
                valeurs[k] = v
            else:
                valeurs[k] = store.check_id(v)            # identifiant : anti-injection
        sparql = intent["template"].format(**valeurs)
        rep = {"question": question, "intention": intent["name"], "membre": intent["membre"],
               "methode": methode, "modele_spacy": self.model, "entites": ents,
               "parametres": slots, "sparql": sparql.strip(),
               "confiance": round(confiance, 3), "alternatives": alternatives, "contexte": nouveau_ctx}
        if best["du_ctx"]:
            rep["parametres_du_contexte"] = best["du_ctx"]
        if egalite:
            rep["ambigue"] = True
        if confiance < SEUIL_CONFIANCE or egalite:
            rep["suggestions"] = self.suggestions([best] + autres, proches)
        if scores_zs:
            rep["scores_zero_shot"] = scores_zs
        return rep


translator = None


def get_translator() -> Translator:
    global translator
    if translator is None:
        translator = Translator()
    return translator
