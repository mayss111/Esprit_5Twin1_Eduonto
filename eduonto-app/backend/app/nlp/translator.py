"""Traducteur « question en français → requête SPARQL », sans LLM.

Pipeline (outils à citer dans la présentation) :
  1. Normalisation du texte (minuscules, accents retirés)                      — Python / unicodedata
  2. Tokenisation et lemmatisation                                              — spaCy (fr_core_news_sm)
  3. Reconnaissance des entités de l'ontologie (Ahmed, Angular, DataScientist…)  — spaCy PhraseMatcher
  4. Détection de l'intention par mots-clés (+ repli optionnel zero-shot)       — règles / Hugging Face Transformers
  5. Remplissage d'un modèle de requête SPARQL avec les entités et les nombres  — templates
"""
import os
import re
import unicodedata

import spacy
from spacy.matcher import PhraseMatcher
from spacy.util import filter_spans

from .. import store
from .intents import ALL_INTENTS

HF_MODEL = "MoritzLaurer/mDeBERTa-v3-base-mnli-xnli"   # zero-shot multilingue (français compris)
LABEL_PROPS = ["prenom", "nom", "intitule", "intituleFormation", "libelleCompetence",
               "intituleMetier", "libelleDomaine", "titre", "nomParcours"]


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFD", text.lower())
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = re.sub(r"[-_'’?!.,;:]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def split_camel(name: str) -> str:
    return re.sub(r"(?<=[a-z])(?=[A-Z])", " ", name.replace("_", " "))


class Translator:
    def __init__(self):
        try:
            self.nlp = spacy.load("fr_core_news_sm")
            self.model = "fr_core_news_sm"
        except OSError:                                   # modèle non installé : tokeniseur seul
            self.nlp = spacy.blank("fr")
            self.model = "spacy.blank('fr')"
        self.zero_shot = self.load_zero_shot()
        self.build_lexicon()
        store.on_change(self.build_lexicon)               # lexique à jour après chaque INSERT / DELETE / rechargement

    def load_zero_shot(self):
        """Charge le modèle zero-shot dès le démarrage si EDUONTO_HF=1 (sinon, ou si transformers manque : None)."""
        if os.getenv("EDUONTO_HF") != "1":
            return None
        try:
            from transformers import pipeline
            return pipeline("zero-shot-classification", model=HF_MODEL)
        except Exception as e:                            # transformers absent, pas de réseau…
            print(f"[EduOnto] zero-shot désactivé : {str(e).splitlines()[0]}")
            return None

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
        for ident in entity_types:
            # « JavaScript » → « java script » ET « javascript » : l'identifiant collé est aussi reconnu
            phrases = {normalize(split_camel(ident)), normalize(ident.replace("_", " "))} | labels.get(ident, set())
            patterns = [self.nlp.make_doc(ph) for ph in phrases if len(ph) > 2]
            if patterns:
                matcher.add("IND|" + ident, patterns)
        for r in store.select("SELECT ?c WHERE { ?c a owl:Class . FILTER(isIRI(?c)) }"):
            words = normalize(split_camel(r["c"]))
            matcher.add("CLS|" + r["c"], [self.nlp.make_doc(words), self.nlp.make_doc(words + "s")])
        self.matcher, self.entity_types = matcher, entity_types

    def entities(self, doc):
        matcher = self.matcher                            # même lexique pendant toute l'analyse
        spans = [doc[s:e] for _, s, e in matcher(doc)]
        found = []
        for span in filter_spans(spans):                  # garde les correspondances les plus longues
            for mid, s, e in matcher(doc):
                if s == span.start and e == span.end:
                    kind, ident = self.nlp.vocab.strings[mid].split("|", 1)
                    found.append({"texte": span.text, "id": ident,
                                  "genre": "individu" if kind == "IND" else "classe"})
                    break
        return found

    # ---------- 4. intention ----------
    def keyword_score(self, intent, text, lemmas):
        return sum(1 for k in intent["keywords"] if re.search(rf"\b{re.escape(k)}\b", text) or k in lemmas)

    def fill_slots(self, intent, ents, numbers):
        values = {}
        for slot, expected in intent.get("slots", {}).items():
            if expected == "number":
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
                if not match:
                    return None
                values[slot] = match[0]["id"]
        return values

    def zero_shot_choice(self, question, candidates):
        """Repli optionnel (EDUONTO_HF=1) : classification zero-shot Hugging Face.
        Renvoie (meilleur candidat ou None, 3 meilleurs scores [{intention, score}])."""
        if self.zero_shot is None or not candidates:
            return None, []
        labels = [c[0]["description"] for c in candidates]
        res = self.zero_shot(question, labels, hypothesis_template="Cette question porte sur {}.")
        top = [{"intention": candidates[labels.index(l)][0]["name"], "score": round(float(s), 3)}
               for l, s in zip(res["labels"][:3], res["scores"][:3])]
        best = labels.index(res["labels"][0])
        return (candidates[best] if res["scores"][0] > 0.4 else None), top

    # ---------- pipeline complet ----------
    def translate(self, question: str) -> dict:
        text = normalize(question)
        doc = self.nlp(text)
        lemmas = {normalize(t.lemma_) for t in doc if t.lemma_}
        ents = self.entities(doc)
        numbers = [float(n.replace(",", ".")) for n in re.findall(r"\d+(?:[.,]\d+)?", question)]

        candidates = []
        for intent in ALL_INTENTS:
            slots = self.fill_slots(intent, ents, numbers)
            if slots is None:
                continue
            candidates.append((intent, slots, self.keyword_score(intent, text, lemmas)))
        # à score égal, l'intention la plus précise (le plus de slots remplis) passe devant :
        # « moyenne d'Ahmed » -> moyenne_etudiant plutôt que moyenne_notes
        candidates.sort(key=lambda c: (c[2], len(c[1])), reverse=True)

        methode = "mots-clés"
        scores_zs = []
        best = candidates[0] if candidates and candidates[0][2] > 0 else None
        if best is None:
            best, scores_zs = self.zero_shot_choice(question, candidates)
            methode = "zero-shot (Hugging Face)"
        if best is None:
            rep = {"question": question, "intention": None, "entites": ents, "sparql": None,
                   "message": "Question non comprise. Reformulez avec un nom de l'ontologie (ex. Ahmed, Angular)."}
            if scores_zs:
                rep["scores_zero_shot"] = scores_zs
            return rep

        intent, slots = best[0], best[1]
        sparql = intent["template"].format(**{k: (int(v) if isinstance(v, float) and v.is_integer() else v)
                                              for k, v in slots.items()})
        rep = {"question": question, "intention": intent["name"], "membre": intent["membre"],
               "methode": methode, "modele_spacy": self.model, "entites": ents,
               "parametres": slots, "sparql": sparql.strip()}
        if scores_zs:
            rep["scores_zero_shot"] = scores_zs
        return rep


translator = None


def get_translator() -> Translator:
    global translator
    if translator is None:
        translator = Translator()
    return translator
