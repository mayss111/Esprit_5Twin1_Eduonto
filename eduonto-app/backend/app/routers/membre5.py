"""MEMBRE 5 — RessourcePedagogique + AgentPedagogiqueIA.

Déjà fait (exemples) :
  - GET /api/m5/agents-fiables → précision ≥ 0,9 ET explicable
  - GET /api/m5/recommandations/{etudiant} → ce que les agents IA recommandent à un étudiant

À faire par le membre 5 :
  - [ ] les ressources en libre accès d'une langue donnée
  - [ ] les ressources utilisées par un cours
  - [ ] les ressources de moins de N minutes
  - [ ] 2 intentions dans app/nlp/intents/membre5.py
"""
from fastapi import APIRouter

from ..store import check_id, select

router = APIRouter(prefix="/api/m5", tags=["Membre 5 · RessourcePedagogique + AgentPedagogiqueIA"])


@router.get("/agents-fiables")
def agents_fiables(seuil: float = 0.9):
    return select(f"""
        SELECT ?agent ?precision ?modele WHERE {{
          ?agent edu:tauxPrecision ?precision ; edu:estExplicable true .
          OPTIONAL {{ ?agent edu:modeleIA ?modele }}
          FILTER(?precision >= {float(seuil)})
        }} ORDER BY DESC(?precision)""")


@router.get("/recommandations/{etudiant}")
def recommandations(etudiant: str):
    return select(f"""
        SELECT ?agent ?recommandation WHERE {{
          ?agent edu:assiste edu:{check_id(etudiant)} ; edu:recommande ?recommandation .
        }}""")
