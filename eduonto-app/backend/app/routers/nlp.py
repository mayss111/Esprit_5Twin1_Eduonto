"""Module langage naturel : POST /api/ask {"question": "...", "contexte": [entités de la question précédente]}"""
from fastapi import APIRouter
from pydantic import BaseModel
from rdflib.plugins.sparql import prepareQuery

from ..nlp.intents import ALL_INTENTS
from ..nlp.translator import get_translator
from ..store import PREFIXES, select

router = APIRouter(prefix="/api", tags=["Langage naturel → SPARQL"])


class Question(BaseModel):
    question: str
    contexte: list[dict] | None = None    # le champ "contexte" renvoyé par la réponse précédente (optionnel)


def verifier_select(sparql: str):
    """Sécurité : la requête générée doit être un SELECT syntaxiquement valide (analysé par rdflib),
    jamais un INSERT / DELETE. Lève ValueError sinon."""
    try:
        requete = prepareQuery(PREFIXES + sparql)
    except Exception as e:                # erreur de syntaxe, ou mise à jour (non acceptée par prepareQuery)
        raise ValueError(f"Requête générée refusée : {str(e).splitlines()[0]}")
    if requete.algebra.name != "SelectQuery":
        raise ValueError("Requête générée refusée : seules les requêtes SELECT sont exécutées")


@router.post("/ask")
def ask(q: Question):
    result = get_translator().translate(q.question, q.contexte)
    result["resultats"] = []
    if result.get("sparql"):
        try:
            verifier_select(result["sparql"])
        except ValueError as e:
            result["erreur"] = str(e)
            return result
        result["resultats"] = select(result["sparql"])
    return result


@router.get("/ask/intentions")
def intentions():
    return [{"name": i["name"], "membre": i["membre"], "description": i["description"],
             "exemples": i.get("exemples", [])} for i in ALL_INTENTS]
