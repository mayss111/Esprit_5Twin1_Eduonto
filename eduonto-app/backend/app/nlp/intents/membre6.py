# MEMBRE 6 — ParcoursApprentissage + IndicateurApprentissage.
INTENTS = [
    {"name": "etudiants_a_risque", "membre": 6, "description": "les étudiants à risque de décrochage",
     "keywords": ["risque", "decrochage", "decroche", "decrocher", "assiduite", "difficulte"],
     "slots": {},
     "template": """SELECT ?etudiant ?valeur ?seuil WHERE {{
  ?indicateur a/rdfs:subClassOf* edu:TauxAssiduite ;
              edu:concerne ?etudiant ; edu:valeur ?valeur ; edu:seuilAlerte ?seuil .
  FILTER(?valeur < ?seuil)
}} ORDER BY ?valeur"""},
    {"name": "cours_parcours", "membre": 6, "description": "les cours d'un parcours",
     "keywords": ["parcours", "comprend", "contient"],
     "slots": {"parcours": "ParcoursApprentissage"},
     "template": """SELECT ?cours WHERE {{
  edu:{parcours} edu:comprendCours ?cours .
}} ORDER BY ?cours"""},
    # TODO membre 6 : « Indicateurs de X », « Qui suit le parcours X ? »
]
