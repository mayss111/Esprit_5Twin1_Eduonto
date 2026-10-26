"""Module langage naturel : POST /api/ask {"question": "..."}"""
from fastapi import APIRouter
from pydantic import BaseModel

from ..nlp.intents import ALL_INTENTS
from ..nlp.translator import get_translator
from ..store import select

router = APIRouter(prefix="/api", tags=["Langage naturel → SPARQL"])


class Question(BaseModel):
    question: str


@router.post("/ask")
def ask(q: Question):
    result = get_translator().translate(q.question)
    result["resultats"] = select(result["sparql"]) if result.get("sparql") else []
    return result


@router.get("/ask/intentions")
def intentions():
    return [{"name": i["name"], "membre": i["membre"], "description": i["description"]} for i in ALL_INTENTS]
