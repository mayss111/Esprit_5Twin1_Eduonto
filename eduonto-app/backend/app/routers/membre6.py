"""MEMBRE 6 — ParcoursApprentissage + IndicateurApprentissage.

Déjà fait (exemples) :
  - GET /api/m6/etudiants-a-risque?seuil=0.6 → assiduité sous le seuil (calcul en SPARQL, sans raisonneur)
  - GET /api/m6/parcours/{id}/cours → cours d'un parcours

À faire par le membre 6 :
  - [ ] tous les indicateurs d'un étudiant
  - [ ] les étudiants qui suivent un parcours donné
  - [ ] comparer la valeur de chaque indicateur à son propre seuilAlerte
  - [ ] 2 intentions dans app/nlp/intents/membre6.py
"""
from fastapi import APIRouter

from ..store import check_id, select

router = APIRouter(prefix="/api/m6", tags=["Membre 6 · ParcoursApprentissage + IndicateurApprentissage"])


@router.get("/etudiants-a-risque")
def etudiants_a_risque(seuil: float = 0.6):
    return select(f"""
        SELECT ?etudiant ?indicateur ?valeur WHERE {{
          ?indicateur a/rdfs:subClassOf* edu:TauxAssiduite ;
                      edu:concerne ?etudiant ; edu:valeur ?valeur .
          FILTER(?valeur < {float(seuil)})
        }} ORDER BY ?valeur""")


@router.get("/parcours/{ident}/cours")
def cours_parcours(ident: str):
    return select(f"""
        SELECT ?cours ?intitule WHERE {{
          edu:{check_id(ident)} edu:comprendCours ?cours .
          OPTIONAL {{ ?cours edu:intitule ?intitule }}
        }} ORDER BY ?cours""")
