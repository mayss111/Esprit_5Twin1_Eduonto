"""MEMBRE 1 — Personne + Formation.

Déjà fait (exemples) :
  - GET /api/m1/etudiants?annee=4        → filtre par année d'étude
  - GET /api/m1/etudiants/{id}/formation → jointure Etudiant → Formation

À faire par le membre 1 :
  - [ ] une recherche d'enseignants par spécialité (FILTER + CONTAINS)
  - [ ] les étudiants d'une formation donnée
  - [ ] les classes déduites d'un étudiant (EtudiantOption, EtudiantActif...)
  - [ ] 2 intentions dans app/nlp/intents/membre1.py
"""
from fastapi import APIRouter

from ..store import check_id, select

router = APIRouter(prefix="/api/m1", tags=["Membre 1 · Personne + Formation"])


@router.get("/etudiants")
def etudiants(annee: int | None = None):
    filtre = f"FILTER(?annee = {int(annee)})" if annee is not None else ""
    return select(f"""
        SELECT ?etudiant ?prenom ?nom ?annee ?formation WHERE {{
          ?etudiant a edu:Etudiant ; edu:anneeEtude ?annee .
          OPTIONAL {{ ?etudiant edu:prenom ?prenom }}
          OPTIONAL {{ ?etudiant edu:nom ?nom }}
          OPTIONAL {{ ?etudiant edu:inscritA ?formation }}
          {filtre}
        }} ORDER BY ?etudiant""")


@router.get("/etudiants/{ident}/formation")
def formation_etudiant(ident: str):
    return select(f"""
        SELECT ?formation ?intitule ?duree WHERE {{
          edu:{check_id(ident)} edu:inscritA ?formation .
          OPTIONAL {{ ?formation edu:intituleFormation ?intitule }}
          OPTIONAL {{ ?formation edu:dureeAnnees ?duree }}
        }}""")
