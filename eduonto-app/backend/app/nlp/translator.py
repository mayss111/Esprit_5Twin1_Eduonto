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
        self.zero_shot = None
        self.build_lexicon()

    # ---------- 3. lexique des entités, construit depuis l'ontologie ----------
    def build_lexicon(self):
        self.matcher = PhraseMatcher(self.nlp.vocab, attr="LOWER")
        self.entity_types = {}                            # id -> {classes de l'individu (et ancêtres)}
        rows = store.select("""
            SELECT ?i ?c WHERE { ?i a owl:NamedIndividual ; a ?t . ?t rdfs:subClassOf* ?c . FILTER(isIRI(?c)) }""")
        for r in rows:
            self.entity_types.setdefault(r["i"], set()).add(r["c"])
        for ident in self.entity_types:
            phrases = {normalize(split_camel(ident))}
            for p in LABEL_PROPS:
                for r in store.select(f"SELECT ?v WHERE {{ edu:{ident} edu:{p} ?v }}"):
                    phrases.add(normalize(str(r["v"])))
            self.matcher.add("IND|" + ident, [self.nlp.make_doc(ph) for ph in phrases if len(ph) > 2])
        for r in store.select("SELECT ?c WHERE { ?c a owl:Class . FILTER(isIRI(?c)) }"):
            words = normalize(split_camel(r["c"]))
            self.matcher.add("CLS|" + r["c"], [self.nlp.make_doc(words), self.nlp.make_doc(words + "s")])

    def entities(self, doc):
        spans = [doc[s:e] for _, s, e in self.matcher(doc)]
        found = []
        for span in filter_spans(spans):                  # garde les correspondances les plus longues
            for mid, s, e in self.matcher(doc):
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
        """Repli optionnel (EDUONTO_HF=1) : classification zero-shot Hugging Face."""
        if os.getenv("EDUONTO_HF") != "1" or not candidates:
            return None
        if self.zero_shot is None:
            from transformers import pipeline
            self.zero_shot = pipeline("zero-shot-classification", model="MoritzLaurer/mDeBERTa-v3-base-mnli-xnli")
        labels = [c[0]["description"] for c in candidates]
        res = self.zero_shot(question, labels, hypothesis_template="Cette question porte sur {}.")
        best = labels.index(res["labels"][0])
        return candidates[best] if res["scores"][0] > 0.4 else None

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
        candidates.sort(key=lambda c: c[2], reverse=True)

        methode = "mots-clés"
        best = candidates[0] if candidates and candidates[0][2] > 0 else None
        if best is None:
            best = self.zero_shot_choice(question, candidates)
            methode = "zero-shot (Hugging Face)"
        if best is None:
            return {"question": question, "intention": None, "entites": ents, "sparql": None,
                    "message": "Question non comprise. Reformulez avec un nom de l'ontologie (ex. Ahmed, Angular)."}

        intent, slots = best[0], best[1]
        sparql = intent["template"].format(**{k: (int(v) if isinstance(v, float) and v.is_integer() else v)
                                              for k, v in slots.items()})
        return {"question": question, "intention": intent["name"], "membre": intent["membre"],
                "methode": methode, "modele_spacy": self.model, "entites": ents,
                "parametres": slots, "sparql": sparql.strip()}


translator = None


def get_translator() -> Translator:
    global translator
    if translator is None:
        translator = Translator()
    return translator
