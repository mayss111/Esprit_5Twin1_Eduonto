"""MEMBRE 2 — Cours + Domaine.

Déjà fait (exemples) :
  - GET /api/m2/cours/{id}/prerequis → tous les prérequis, directs et indirects (chemin aPourPrerequis+)
  - GET /api/m2/cours?domaine=GenieLogiciel → cours d'une classe de domaine

À faire par le membre 2 :
  - [ ] les cours d'un niveau donné (Débutant / Intermédiaire / Avancé)
  - [ ] les cours de plus de N crédits (FILTER)
  - [ ] les cours suivants d'un cours (estPrerequisDe)
  - [ ] 2 intentions dans app/nlp/intents/membre2.py
"""
from fastapi import APIRouter

from ..store import check_id, select

router = APIRouter(prefix="/api/m2", tags=["Membre 2 · Cours + Domaine"])


@router.get("/cours/{ident}/prerequis")
def prerequis(ident: str):
    return select(f"""
        SELECT DISTINCT ?prerequis ?intitule WHERE {{
          edu:{check_id(ident)} edu:aPourPrerequis+ ?prerequis .
          OPTIONAL {{ ?prerequis edu:intitule ?intitule }}
        }} ORDER BY ?prerequis""")


@router.get("/cours")
def cours(domaine: str | None = None):
    filtre = f"?domaine a/rdfs:subClassOf* edu:{check_id(domaine)} ." if domaine else ""
    return select(f"""
        SELECT DISTINCT ?cours ?intitule ?credits ?domaine WHERE {{
          ?cours a/rdfs:subClassOf* edu:Cours ; a owl:NamedIndividual .
          OPTIONAL {{ ?cours edu:intitule ?intitule }}
          OPTIONAL {{ ?cours edu:nbCredits ?credits }}
          ?cours edu:appartientADomaine ?domaine .
          {filtre}
        }} ORDER BY ?cours""")
