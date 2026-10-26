"""MEMBRE 4 — Evaluation + PreuveDeCompetence.

Déjà fait (exemples) :
  - GET /api/m4/evaluations?noteMin=12 → filtre numérique sur la note
  - GET /api/m4/competences-certifiees → compétences attestées par une preuve vérifiée

À faire par le membre 4 :
  - [ ] les évaluations d'une session donnée (Principale / Rattrapage)
  - [ ] la moyenne des notes (AVG) par cours
  - [ ] les preuves expirées (dateExpiration < NOW())
  - [ ] 2 intentions dans app/nlp/intents/membre4.py
"""
from fastapi import APIRouter

from ..store import select

router = APIRouter(prefix="/api/m4", tags=["Membre 4 · Evaluation + PreuveDeCompetence"])


@router.get("/evaluations")
def evaluations(noteMin: float | None = None):
    filtre = f"FILTER(?note >= {float(noteMin)})" if noteMin is not None else ""
    return select(f"""
        SELECT ?evaluation ?note ?session ?cours WHERE {{
          ?evaluation edu:note ?note .
          OPTIONAL {{ ?evaluation edu:session ?session }}
          OPTIONAL {{ ?cours edu:estEvaluePar ?evaluation }}
          {filtre}
        }} ORDER BY DESC(?note)""")


@router.get("/competences-certifiees")
def competences_certifiees():
    return select("""
        SELECT DISTINCT ?competence ?preuve ?etudiant WHERE {
          ?preuve edu:atteste ?competence ; edu:estVerifie true .
          OPTIONAL { ?preuve edu:delivreA ?etudiant }
        } ORDER BY ?competence""")
