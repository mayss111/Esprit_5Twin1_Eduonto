INTENTS = [
    {"name": "lister_classe", "membre": 0, "description": "la liste des individus d'une classe",
     "keywords": ["liste", "lister", "quels sont", "quelles sont", "tous les", "toutes les", "affiche"],
     "slots": {"classe": "CLASS"},
     "template": """SELECT DISTINCT ?individu WHERE {{
  ?individu a/rdfs:subClassOf* edu:{classe} ; a owl:NamedIndividual .
}} ORDER BY ?individu"""},
]
