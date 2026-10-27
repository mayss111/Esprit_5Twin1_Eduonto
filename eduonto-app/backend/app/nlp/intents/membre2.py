# MEMBRE 2 — Cours + Domaine.
# keywords : mots sans accents ; slots : ce que spaCy doit trouver dans la question.
# description : sert aussi de label au zero-shot Hugging Face (« Cette question porte sur {description}. »).
INTENTS = [
    # « Quels sont les prérequis d'Angular ? »
    {"name": "prerequis_cours", "membre": 2, "description": "les cours à suivre avant un cours (ses prérequis)",
     "keywords": ["prerequis", "avant de suivre", "necessaire pour suivre", "requis", "avant"],
     "slots": {"cours": "Cours"},
     "template": """SELECT DISTINCT ?prerequis ?semestre WHERE {{
  edu:{cours} edu:aPourPrerequis+ ?prerequis .
  OPTIONAL {{ ?prerequis edu:semestre ?semestre }}
}} ORDER BY ?semestre"""},

    # « Quels cours appartiennent au domaine Développement web ? »
    {"name": "cours_domaine", "membre": 2, "description": "les cours d'un domaine",
     "keywords": ["cours", "domaine", "modules", "appartient", "appartiennent"],
     "slots": {"domaine": "Domaine"},
     "template": """SELECT ?cours ?intitule WHERE {{
  ?cours edu:appartientADomaine edu:{domaine} .
  OPTIONAL {{ ?cours edu:intitule ?intitule }}
}} ORDER BY ?cours"""},

    # « Que puis-je suivre après JavaScript ? »
    {"name": "cours_suivants", "membre": 2, "description": "les cours que l'on peut suivre après un cours",
     "keywords": ["apres", "ensuite", "suite", "debouche", "debouchent", "mene", "ouvre"],
     "slots": {"cours": "Cours"},
     "template": """SELECT DISTINCT ?coursSuivant ?semestre WHERE {{
  ?coursSuivant edu:aPourPrerequis+ edu:{cours} .
  OPTIONAL {{ ?coursSuivant edu:semestre ?semestre }}
}} ORDER BY ?semestre"""},

    # « Quels cours ont au moins 4 crédits ? »
    {"name": "cours_credits", "membre": 2, "description": "les cours ayant au moins un nombre de crédits",
     "keywords": ["credit", "credits", "ects", "au moins", "plus de"],
     "slots": {"n": "number"},
     "template": """SELECT ?cours ?credits WHERE {{
  ?cours edu:nbCredits ?credits .
  FILTER(?credits >= {n})
}} ORDER BY DESC(?credits)"""},

    # « Quels sont les cours avancés ? » — classe définie CoursAvance ≡ Cours ⊓ ∃aPourPrerequis.Cours
    # (un cours est « avancé » s'il a au moins un prérequis) : c'est HermiT qui la remplit.
    {"name": "cours_avances", "membre": 2, "description": "les cours avancés, qui demandent au moins un prérequis",
     "keywords": ["avance", "avances", "difficile", "difficiles", "niveau avance"],
     "slots": {},
     "template": """SELECT ?cours ?intitule ?semestre WHERE {{
  ?cours a edu:CoursAvance .
  OPTIONAL {{ ?cours edu:intitule ?intitule }}
  OPTIONAL {{ ?cours edu:semestre ?semestre }}
}} ORDER BY ?semestre"""},

    # « Que manque-t-il à Ahmed pour suivre Angular ? » / « Ahmed peut-il suivre Angular ? »
    {"name": "prerequis_manquants", "membre": 2, "description": "les prérequis qu'un étudiant n'a pas encore validés pour suivre un cours",
     "keywords": ["peut", "peut il", "peut elle", "suivre", "pret", "manque", "manquent", "inscrire"],
     "slots": {"etudiant": "Etudiant", "cours": "Cours"},
     "template": """SELECT DISTINCT ?prerequisManquant ?semestre WHERE {{
  edu:{cours} edu:aPourPrerequis+ ?prerequisManquant .
  FILTER NOT EXISTS {{ edu:{etudiant} edu:aValide ?prerequisManquant }}
  OPTIONAL {{ ?prerequisManquant edu:semestre ?semestre }}
}} ORDER BY ?semestre"""},
]
