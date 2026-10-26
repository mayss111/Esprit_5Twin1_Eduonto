"""MEMBRE 3 — Competence + Metier.

Déjà fait (exemples) :
  - GET /api/m3/metiers/{id}/competences → compétences requises par un métier
  - GET /api/m3/etudiants/{id}/competences-manquantes → compétences du métier visé non certifiées

À faire par le membre 3 :
  - [ ] les métiers en tension (estEnTension = true)
  - [ ] les cours qui développent une compétence donnée
  - [ ] les métiers accessibles avec un niveau d'études donné
  - [ ] 2 intentions dans app/nlp/intents/membre3.py
"""
from fastapi import APIRouter

from ..store import check_id, select

router = APIRouter(prefix="/api/m3", tags=["Membre 3 · Competence + Metier"])


@router.get("/metiers/{ident}/competences")
def competences_metier(ident: str):
    return select(f"""
        SELECT ?competence ?libelle WHERE {{
          edu:{check_id(ident)} edu:requiertCompetence ?competence .
          OPTIONAL {{ ?competence edu:libelleCompetence ?libelle }}
        }} ORDER BY ?competence""")


@router.get("/etudiants/{ident}/competences-manquantes")
def competences_manquantes(ident: str):
    e = check_id(ident)
    return select(f"""
        SELECT ?metier ?competence WHERE {{
          edu:{e} edu:viseMetier ?metier .
          ?metier edu:requiertCompetence ?competence .
          FILTER NOT EXISTS {{
            ?preuve edu:atteste ?competence ; edu:delivreA edu:{e} ; edu:estVerifie true .
          }}
        }} ORDER BY ?competence""")
