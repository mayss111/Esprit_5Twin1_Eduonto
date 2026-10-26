# MEMBRE 5 — RessourcePedagogique + AgentPedagogiqueIA.
INTENTS = [
    {"name": "agents_fiables", "membre": 5, "description": "les agents d'IA fiables",
     "keywords": ["fiable", "fiables", "confiance", "agent", "agents", "ia"],
     "slots": {},
     "template": """SELECT ?agent ?precision WHERE {{
  ?agent edu:tauxPrecision ?precision ; edu:estExplicable true .
  FILTER(?precision >= 0.9)
}} ORDER BY DESC(?precision)"""},
    {"name": "recommandations_etudiant", "membre": 5, "description": "ce qui est recommandé à un étudiant",
     "keywords": ["recommande", "recommandation", "recommandations", "conseille", "propose"],
     "slots": {"etudiant": "Etudiant"},
     "template": """SELECT ?agent ?recommandation WHERE {{
  ?agent edu:assiste edu:{etudiant} ; edu:recommande ?recommandation .
}}"""},
    # TODO membre 5 : « Ressources en libre accès », « Ressources du cours X »
]
