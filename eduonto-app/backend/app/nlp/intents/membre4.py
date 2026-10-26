# MEMBRE 4 — Evaluation + PreuveDeCompetence.
# keywords : mots sans accents ; slots : ce que spaCy doit trouver dans la question.
INTENTS = [
    {"name": "evaluations_note_superieure", "membre": 4, "description": "les évaluations avec une note supérieure à un nombre",
     "keywords": ["note", "notes", "superieure", "superieur", "plus de", "au dessus", "depasse"],
     "slots": {"n": "number"},
     "template": """SELECT ?evaluation ?note WHERE {{
  ?evaluation edu:note ?note .
  FILTER(?note > {n})
}} ORDER BY DESC(?note)"""},

    {"name": "competences_certifiees", "membre": 4, "description": "les compétences certifiées par une preuve vérifiée",
     "keywords": ["certifiee", "certifiees", "certifie", "verifiee", "verifiees", "blockchain"],
     "slots": {},
     "template": """SELECT DISTINCT ?competence ?preuve WHERE {{
  ?preuve edu:atteste ?competence ; edu:estVerifie true .
}} ORDER BY ?competence"""},

    # « Quelle est la moyenne des notes par cours ? »
    {"name": "moyenne_notes", "membre": 4, "description": "la moyenne des notes par cours",
     "keywords": ["moyenne", "moyennes", "statistiques", "statistique"],
     "slots": {},
     "template": """SELECT ?cours (ROUND(AVG(?note) * 100) / 100 AS ?moyenne) (COUNT(?evaluation) AS ?nbEvaluations) WHERE {{
  ?cours edu:estEvaluePar ?evaluation .
  ?evaluation edu:note ?note .
}} GROUP BY ?cours ORDER BY DESC(?moyenne)"""},

    # « Quelles évaluations sont en session de rattrapage ? »
    {"name": "evaluations_rattrapage", "membre": 4, "description": "les évaluations de la session de rattrapage",
     "keywords": ["rattrapage", "rattrapages", "session"],
     "slots": {},
     "template": """SELECT ?evaluation ?note ?etudiant WHERE {{
  ?evaluation edu:session ?session ; edu:note ?note .
  FILTER(STR(?session) = "Rattrapage")
  OPTIONAL {{ ?etudiant edu:aPasse ?evaluation }}
}} ORDER BY ?note"""},

    # « Quels badges a obtenu Sarra ? » / « Quelles preuves de compétence a Ahmed ? »
    {"name": "preuves_etudiant", "membre": 4, "description": "les preuves de compétence (badges, certifications) d'un étudiant",
     "keywords": ["badge", "badges", "preuve", "preuves", "certification", "certifications", "obtenu", "diplome"],
     "slots": {"etudiant": "Etudiant"},
     "template": """SELECT ?preuve ?competence ?verifiee WHERE {{
  ?preuve edu:delivreA edu:{etudiant} .
  OPTIONAL {{ ?preuve edu:atteste ?competence }}
  OPTIONAL {{ ?preuve edu:estVerifie ?verifiee }}
}} ORDER BY ?preuve"""},

    # « Quelles sont les notes d'Omar ? »
    {"name": "notes_etudiant", "membre": 4, "description": "les notes d'un étudiant",
     "keywords": ["note", "notes", "resultat", "resultats", "releve"],
     "slots": {"etudiant": "Etudiant"},
     "template": """SELECT ?evaluation ?note ?session WHERE {{
  edu:{etudiant} edu:aPasse ?evaluation .
  ?evaluation edu:note ?note .
  OPTIONAL {{ ?evaluation edu:session ?session }}
}} ORDER BY DESC(?note)"""},
]
