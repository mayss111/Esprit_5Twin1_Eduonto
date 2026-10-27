# MEMBRE 1 — Personne + Formation.
# keywords : mots sans accents ; slots : ce que spaCy doit trouver dans la question.
# description : sert aussi de label au zero-shot Hugging Face (« Cette question porte sur {description}. »).
# exemples : questions types, encodées par sentence-transformers pour la similarité sémantique.
INTENTS = [
    # « Quelle est la formation d'Ahmed ? »
    {"name": "formation_etudiant", "membre": 1,
     "description": "la formation ou la filière dans laquelle un étudiant est inscrit",
     "keywords": ["inscrit", "formation", "etudie", "specialite", "filiere"],
     "slots": {"etudiant": "Etudiant"},
     "exemples": ["Quelle est la formation d'Ahmed ?", "Dans quelle filière est inscrite Sarra ?",
                  "Omar étudie dans quelle formation ?", "À quel programme Lina est-elle inscrite ?"],
     "template": """SELECT ?formation ?intitule WHERE {{
  edu:{etudiant} edu:inscritA ?formation .
  OPTIONAL {{ ?formation edu:intituleFormation ?intitule }}
}}"""},

    # « Quels étudiants sont en option ? » (classe définie, remplie par le raisonneur)
    {"name": "etudiants_option", "membre": 1,
     "description": "les étudiants ingénieurs en option, en 4e ou 5e année",
     "keywords": ["option", "4e annee", "5e annee", "derniere annee"],
     "slots": {},
     "exemples": ["Quels étudiants sont en option ?", "Qui est en dernière année du cycle ingénieur ?",
                  "Liste des étudiants de 4e et 5e année"],
     "template": """SELECT ?etudiant ?annee WHERE {{
  ?etudiant a edu:EtudiantOption ; edu:anneeEtude ?annee .
}} ORDER BY ?etudiant"""},

    # « Quels étudiants sont boursiers ? »
    {"name": "etudiants_boursiers", "membre": 1,
     "description": "les étudiants qui bénéficient d'une bourse d'études",
     "keywords": ["boursier", "boursiers", "boursiere", "bourse", "bourses"],
     "slots": {},
     "exemples": ["Quels étudiants sont boursiers ?", "Qui a une bourse ?", "Liste des boursiers de l'école"],
     "template": """SELECT ?etudiant ?prenom ?nom ?formation WHERE {{
  ?etudiant edu:estBoursier true .
  OPTIONAL {{ ?etudiant edu:prenom ?prenom }}
  OPTIONAL {{ ?etudiant edu:nom ?nom }}
  OPTIONAL {{ ?etudiant edu:inscritA ?formation }}
}} ORDER BY ?nom"""},

    # « Qui enseigne SQL ? »
    {"name": "enseignant_cours", "membre": 1,
     "description": "l'enseignant ou le professeur qui donne un cours",
     "keywords": ["enseigne", "enseignant", "enseignante", "professeur", "prof", "donne", "assure"],
     "slots": {"cours": "Cours"},
     "exemples": ["Qui enseigne JavaScript ?", "Quel professeur assure le cours de SQL ?",
                  "Qui donne le module Angular ?"],
     "template": """SELECT ?enseignant ?prenom ?nom ?specialite WHERE {{
  ?enseignant edu:enseigne edu:{cours} .
  OPTIONAL {{ ?enseignant edu:prenom ?prenom }}
  OPTIONAL {{ ?enseignant edu:nom ?nom }}
  OPTIONAL {{ ?enseignant edu:specialite ?specialite }}
}}"""},

    # « Quels étudiants sont inscrits en Data Science ? »
    {"name": "etudiants_formation", "membre": 1,
     "description": "les étudiants inscrits dans une formation donnée",
     "keywords": ["etudiants", "inscrits", "inscrit", "qui suit", "promotion"],
     "slots": {"formation": "Formation"},
     "exemples": ["Quels étudiants sont inscrits en Data Science ?", "Qui suit la formation Data Science ?",
                  "Liste les étudiants de la licence en génie logiciel"],
     "template": """SELECT ?etudiant ?prenom ?nom ?annee WHERE {{
  ?etudiant edu:inscritA edu:{formation} .
  OPTIONAL {{ ?etudiant edu:prenom ?prenom }}
  OPTIONAL {{ ?etudiant edu:nom ?nom }}
  OPTIONAL {{ ?etudiant edu:anneeEtude ?annee }}
}} ORDER BY ?annee ?nom"""},

    # « Combien d'étudiants sont inscrits en TWIN ? » — agrégat COUNT sur une formation
    {"name": "nb_etudiants_formation", "membre": 1,
     "description": "le nombre d'étudiants inscrits dans une formation donnée",
     "keywords": ["combien", "nombre", "effectif", "etudiants", "inscrits", "inscrit"],
     "mots_requis": ["combien", "nombre", "effectif", "effectifs"],
     "slots": {"formation": "Formation"},
     "exemples": ["Combien d'étudiants sont inscrits en Data Science ?", "Quel est l'effectif de la formation TWIN ?",
                  "Nombre d'inscrits en licence génie logiciel"],
     "template": """SELECT ?formation (COUNT(DISTINCT ?etudiant) AS ?nbEtudiants) WHERE {{
  VALUES ?formation {{ edu:{formation} }}
  OPTIONAL {{ ?etudiant edu:inscritA ?formation }}
}} GROUP BY ?formation"""},

    # « Combien d'étudiants par formation ? » — même agrégat, pour toutes les formations
    {"name": "nb_etudiants_par_formation", "membre": 1,
     "description": "le nombre d'étudiants de chaque formation",
     "keywords": ["combien", "nombre", "effectif", "effectifs", "etudiants", "par formation", "chaque"],
     "mots_requis": [["combien", "nombre", "effectif", "effectifs"],
                     ["etudiant", "etudiants", "inscrit", "inscrits", "effectif", "effectifs",
                      "formation", "formations", "filiere", "filieres"]],
     "slots": {},
     "exemples": ["Combien d'étudiants par formation ?", "Effectif de chaque formation",
                  "Nombre d'étudiants dans chaque filière"],
     "template": """SELECT ?formation (COUNT(DISTINCT ?etudiant) AS ?nbEtudiants) WHERE {{
  ?formation a/rdfs:subClassOf* edu:Formation ; a owl:NamedIndividual .
  OPTIONAL {{ ?etudiant edu:inscritA ?formation }}
}} GROUP BY ?formation ORDER BY DESC(?nbEtudiants) ?formation"""},

    # « Quels enseignants ont plus de 10 ans d'expérience ? »
    {"name": "enseignants_experience", "membre": 1,
     "description": "les enseignants qui ont au moins un certain nombre d'années d'expérience",
     "keywords": ["experience", "anciennete", "annees", "enseignant", "enseignants", "professeur"],
     "slots": {"n": "number"}, "op_defaut": ">=",
     "exemples": ["Quels enseignants ont plus de 10 ans d'expérience ?",
                  "Professeurs avec au moins 10 années d'expérience",
                  "Qui a plus de 15 ans d'ancienneté ?"],
     "template": """SELECT DISTINCT ?enseignant ?prenom ?nom ?experience WHERE {{
  ?enseignant a/rdfs:subClassOf* edu:Enseignant ; edu:anneesExperience ?experience .
  FILTER(?experience {op} {n})
  OPTIONAL {{ ?enseignant edu:prenom ?prenom }}
  OPTIONAL {{ ?enseignant edu:nom ?nom }}
}} ORDER BY DESC(?experience)"""},

    # « Qui encadre Ahmed ? »
    {"name": "encadrant_etudiant", "membre": 1,
     "description": "l'enseignant qui encadre ou supervise un étudiant (son tuteur)",
     "keywords": ["encadre", "encadrant", "encadrante", "encadreur", "tuteur", "supervise"],
     "slots": {"etudiant": "Etudiant"},
     "exemples": ["Qui encadre Ahmed ?", "Quel est le tuteur de Sarra ?", "Par qui Yassine est-il supervisé ?"],
     "template": """SELECT DISTINCT ?encadrant ?prenom ?nom WHERE {{
  {{ ?encadrant edu:encadre edu:{etudiant} }} UNION {{ edu:{etudiant} edu:estEncadrePar ?encadrant }}
  OPTIONAL {{ ?encadrant edu:prenom ?prenom }}
  OPTIONAL {{ ?encadrant edu:nom ?nom }}
}}"""},
]
