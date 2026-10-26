# MEMBRE 1 — Personne + Formation. Ajoutez vos intentions à la fin de la liste.
INTENTS = [
    {"name": "formation_etudiant", "membre": 1, "description": "la formation où est inscrit un étudiant",
     "keywords": ["inscrit", "formation", "etudie", "specialite"],
     "slots": {"etudiant": "Etudiant"},
     "template": """SELECT ?formation ?intitule WHERE {{
  edu:{etudiant} edu:inscritA ?formation .
  OPTIONAL {{ ?formation edu:intituleFormation ?intitule }}
}}"""},
    {"name": "etudiants_option", "membre": 1, "description": "les étudiants ingénieurs en option (4e et 5e année)",
     "keywords": ["option", "4e annee", "5e annee", "derniere annee"],
     "slots": {},
     "template": """SELECT ?etudiant ?annee WHERE {{
  ?etudiant edu:anneeEtude ?annee ; edu:inscritA ?formation .
  ?formation a/rdfs:subClassOf* edu:CycleIngenieur .
  FILTER(?annee >= 4)
}} ORDER BY ?etudiant"""},
    # TODO membre 1 : « Qui enseigne X ? », « Quels étudiants sont boursiers ? »
]
