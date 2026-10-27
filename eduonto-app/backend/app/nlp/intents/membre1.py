# MEMBRE 1 — Personne + Formation.
# keywords : mots sans accents ; slots : ce que spaCy doit trouver dans la question.
# description : sert aussi de label au zero-shot Hugging Face (« Cette question porte sur {description}. »).
INTENTS = [
    # « Quelle est la formation d'Ahmed ? »
    {"name": "formation_etudiant", "membre": 1, "description": "la formation dans laquelle un étudiant est inscrit",
     "keywords": ["inscrit", "formation", "etudie", "specialite", "filiere"],
     "slots": {"etudiant": "Etudiant"},
     "template": """SELECT ?formation ?intitule WHERE {{
  edu:{etudiant} edu:inscritA ?formation .
  OPTIONAL {{ ?formation edu:intituleFormation ?intitule }}
}}"""},

    # « Quels étudiants sont en option ? » (classe définie, remplie par le raisonneur)
    {"name": "etudiants_option", "membre": 1, "description": "les étudiants ingénieurs en option, en 4e ou 5e année",
     "keywords": ["option", "4e annee", "5e annee", "derniere annee"],
     "slots": {},
     "template": """SELECT ?etudiant ?annee WHERE {{
  ?etudiant a edu:EtudiantOption ; edu:anneeEtude ?annee .
}} ORDER BY ?etudiant"""},

    # « Quels étudiants sont boursiers ? »
    {"name": "etudiants_boursiers", "membre": 1, "description": "les étudiants qui ont une bourse",
     "keywords": ["boursier", "boursiers", "boursiere", "bourse", "bourses"],
     "slots": {},
     "template": """SELECT ?etudiant ?prenom ?nom ?formation WHERE {{
  ?etudiant edu:estBoursier true .
  OPTIONAL {{ ?etudiant edu:prenom ?prenom }}
  OPTIONAL {{ ?etudiant edu:nom ?nom }}
  OPTIONAL {{ ?etudiant edu:inscritA ?formation }}
}} ORDER BY ?nom"""},

    # « Qui enseigne SQL ? »
    {"name": "enseignant_cours", "membre": 1, "description": "l'enseignant qui donne un cours",
     "keywords": ["enseigne", "enseignant", "enseignante", "professeur", "prof", "donne", "assure"],
     "slots": {"cours": "Cours"},
     "template": """SELECT ?enseignant ?prenom ?nom ?specialite WHERE {{
  ?enseignant edu:enseigne edu:{cours} .
  OPTIONAL {{ ?enseignant edu:prenom ?prenom }}
  OPTIONAL {{ ?enseignant edu:nom ?nom }}
  OPTIONAL {{ ?enseignant edu:specialite ?specialite }}
}}"""},

    # « Quels étudiants sont inscrits en Data Science ? »
    {"name": "etudiants_formation", "membre": 1, "description": "les étudiants inscrits dans une formation",
     "keywords": ["etudiants", "inscrits", "inscrit", "qui suit", "promotion"],
     "slots": {"formation": "Formation"},
     "template": """SELECT ?etudiant ?prenom ?nom ?annee WHERE {{
  ?etudiant edu:inscritA edu:{formation} .
  OPTIONAL {{ ?etudiant edu:prenom ?prenom }}
  OPTIONAL {{ ?etudiant edu:nom ?nom }}
  OPTIONAL {{ ?etudiant edu:anneeEtude ?annee }}
}} ORDER BY ?annee ?nom"""},

    # « Qui encadre Ahmed ? »
    {"name": "encadrant_etudiant", "membre": 1, "description": "l'enseignant qui encadre un étudiant",
     "keywords": ["encadre", "encadrant", "encadrante", "encadreur", "tuteur"],
     "slots": {"etudiant": "Etudiant"},
     "template": """SELECT DISTINCT ?encadrant ?prenom ?nom WHERE {{
  {{ ?encadrant edu:encadre edu:{etudiant} }} UNION {{ edu:{etudiant} edu:estEncadrePar ?encadrant }}
  OPTIONAL {{ ?encadrant edu:prenom ?prenom }}
  OPTIONAL {{ ?encadrant edu:nom ?nom }}
}}"""},
]
