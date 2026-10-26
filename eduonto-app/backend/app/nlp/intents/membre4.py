# MEMBRE 4 — Evaluation + PreuveDeCompetence.
INTENTS = [
    {"name": "evaluations_note_superieure", "membre": 4, "description": "les évaluations avec une note supérieure à un nombre",
     "keywords": ["note", "notes", "superieure", "superieur", "plus de", "au dessus", "depasse"],
     "slots": {"n": "number"},
     "template": """SELECT ?evaluation ?note WHERE {{
  ?evaluation edu:note ?note .
  FILTER(?note > {n})
}} ORDER BY DESC(?note)"""},
    {"name": "competences_certifiees", "membre": 4, "description": "les compétences certifiées par une preuve vérifiée",
     "keywords": ["certifiee", "certifiees", "certifie", "badge", "badges", "verifiee", "blockchain"],
     "slots": {},
     "template": """SELECT DISTINCT ?competence ?preuve WHERE {{
  ?preuve edu:atteste ?competence ; edu:estVerifie true .
}} ORDER BY ?competence"""},
    # TODO membre 4 : « Moyenne des notes », « Évaluations de rattrapage »
]
