# MEMBRE 2 — Cours + Domaine.
INTENTS = [
    {"name": "prerequis_cours", "membre": 2, "description": "les prérequis d'un cours",
     "keywords": ["prerequis", "avant de suivre", "necessaire pour suivre", "requis"],
     "slots": {"cours": "Cours"},
     "template": """SELECT DISTINCT ?prerequis WHERE {{
  edu:{cours} edu:aPourPrerequis+ ?prerequis .
}} ORDER BY ?prerequis"""},
    {"name": "cours_domaine", "membre": 2, "description": "les cours d'un domaine",
     "keywords": ["cours", "domaine", "modules"],
     "slots": {"domaine": "Domaine"},
     "template": """SELECT ?cours ?intitule WHERE {{
  ?cours edu:appartientADomaine edu:{domaine} .
  OPTIONAL {{ ?cours edu:intitule ?intitule }}
}} ORDER BY ?cours"""},
    # TODO membre 2 : « Cours de plus de N crédits », « Cours de niveau avancé »
]
