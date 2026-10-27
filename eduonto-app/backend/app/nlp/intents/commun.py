INTENTS = [
    {"name": "lister_classe", "membre": 0,
     "description": "la liste de tous les individus d'une classe de l'ontologie",
     "keywords": ["liste", "lister", "quels sont", "quelles sont", "tous les", "toutes les", "affiche"],
     "slots": {"classe": "CLASS"},
     "exemples": ["Liste les cours", "Affiche tous les métiers", "Quels sont les étudiants ?",
                  "Donne-moi toutes les compétences"],
     "template": """SELECT DISTINCT ?individu WHERE {{
  ?individu a/rdfs:subClassOf* edu:{classe} ; a owl:NamedIndividual .
}} ORDER BY ?individu"""},
]
