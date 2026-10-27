# MEMBRE 2 — Cours + Domaine.
# keywords : mots sans accents ; slots : ce que spaCy doit trouver dans la question.
# description : sert aussi de label au zero-shot Hugging Face (« Cette question porte sur {description}. »).
# exemples : questions types, encodées par sentence-transformers pour la similarité sémantique.
INTENTS = [
    # « Quels sont les prérequis d'Angular ? »
    {"name": "prerequis_cours", "membre": 2,
     "description": "les cours à suivre avant un cours (ses prérequis)",
     "keywords": ["prerequis", "avant de suivre", "necessaire pour suivre", "requis", "avant"],
     "slots": {"cours": "Cours"},
     "exemples": ["Quels sont les prérequis d'Angular ?", "Que faut-il suivre avant TypeScript ?",
                  "Quels cours sont nécessaires pour suivre le Web sémantique ?"],
     "template": """SELECT DISTINCT ?prerequis ?semestre WHERE {{
  edu:{cours} edu:aPourPrerequis+ ?prerequis .
  OPTIONAL {{ ?prerequis edu:semestre ?semestre }}
}} ORDER BY ?semestre"""},

    # « Quels cours appartiennent au domaine Développement web ? »
    {"name": "cours_domaine", "membre": 2,
     "description": "les cours qui appartiennent à un domaine",
     "keywords": ["cours", "domaine", "modules", "appartient", "appartiennent"],
     "slots": {"domaine": "Domaine"},
     "exemples": ["Quels cours appartiennent au domaine Développement web ?",
                  "Liste les modules du domaine Bases de données", "Quels cours relèvent de l'intelligence artificielle ?"],
     "template": """SELECT ?cours ?intitule WHERE {{
  ?cours edu:appartientADomaine edu:{domaine} .
  OPTIONAL {{ ?cours edu:intitule ?intitule }}
}} ORDER BY ?cours"""},

    # « Que puis-je suivre après JavaScript ? »
    {"name": "cours_suivants", "membre": 2,
     "description": "les cours que l'on peut suivre après un cours",
     "keywords": ["apres", "ensuite", "suite", "debouche", "debouchent", "mene", "ouvre"],
     "slots": {"cours": "Cours"},
     "exemples": ["Que puis-je suivre après JavaScript ?", "Quels cours viennent ensuite après TypeScript ?",
                  "À quoi mène le cours de SQL ?"],
     "template": """SELECT DISTINCT ?coursSuivant ?semestre WHERE {{
  ?coursSuivant edu:aPourPrerequis+ edu:{cours} .
  OPTIONAL {{ ?coursSuivant edu:semestre ?semestre }}
}} ORDER BY ?semestre"""},

    # « Quels cours ont au moins 4 crédits ? » / « … moins de 4 crédits ? » : {op} vient de la question
    {"name": "cours_credits", "membre": 2,
     "description": "les cours selon leur nombre de crédits ECTS",
     "keywords": ["credit", "credits", "ects"],          # « au moins », « moins de »… : lus comme opérateur
     "slots": {"n": "number"}, "op_defaut": ">=",
     "exemples": ["Quels cours ont au moins 4 crédits ?", "Cours de plus de 3 crédits",
                  "Quels modules valent moins de 4 ECTS ?"],
     "template": """SELECT ?cours ?credits WHERE {{
  ?cours edu:nbCredits ?credits .
  FILTER(?credits {op} {n})
}} ORDER BY DESC(?credits)"""},

    # « Quels sont les cours avancés ? » — classe définie CoursAvance ≡ Cours ⊓ ∃aPourPrerequis.Cours
    # (un cours est « avancé » s'il a au moins un prérequis) : c'est HermiT qui la remplit.
    {"name": "cours_avances", "membre": 2,
     "description": "les cours avancés, qui demandent au moins un prérequis",
     "keywords": ["avance", "avances", "difficile", "difficiles", "exigeant", "exigeants"],
     "slots": {},
     "exemples": ["Quels sont les cours avancés ?", "Quels cours sont difficiles ?",
                  "Quels cours demandent des prérequis ?"],
     "template": """SELECT ?cours ?intitule ?semestre WHERE {{
  ?cours a edu:CoursAvance .
  OPTIONAL {{ ?cours edu:intitule ?intitule }}
  OPTIONAL {{ ?cours edu:semestre ?semestre }}
}} ORDER BY ?semestre"""},

    # « Quels sont les cours de niveau intermédiaire ? » — valeur de l'énumération niveau
    {"name": "cours_niveau", "membre": 2,
     "description": "les cours d'un niveau de difficulté donné : débutant, intermédiaire ou avancé",
     "keywords": ["niveau", "debutant", "debutants", "intermediaire", "intermediaires"],
     "slots": {"niveau": {"enum": ["Débutant", "Intermédiaire", "Avancé"]}},
     "exemples": ["Quels sont les cours de niveau intermédiaire ?", "Cours pour débutants",
                  "Quels modules sont de niveau avancé ?"],
     "template": """SELECT ?cours ?intitule ?semestre WHERE {{
  ?cours edu:niveau ?niveau .
  FILTER(STR(?niveau) = "{niveau}")
  OPTIONAL {{ ?cours edu:intitule ?intitule }}
  OPTIONAL {{ ?cours edu:semestre ?semestre }}
}} ORDER BY ?semestre ?cours"""},

    # « Que manque-t-il à Ahmed pour suivre Angular ? » / « Ahmed peut-il suivre Angular ? »
    {"name": "prerequis_manquants", "membre": 2,
     "description": "les prérequis qu'un étudiant n'a pas encore validés pour suivre un cours",
     "keywords": ["peut", "peut il", "peut elle", "suivre", "pret", "manque", "manquent", "inscrire"],
     "slots": {"etudiant": "Etudiant", "cours": "Cours"},
     "exemples": ["Ahmed peut-il suivre Angular ?", "Que manque-t-il à Sarra pour suivre TypeScript ?",
                  "Omar est-il prêt pour le cours de SQL ?"],
     "template": """SELECT DISTINCT ?prerequisManquant ?semestre WHERE {{
  edu:{cours} edu:aPourPrerequis+ ?prerequisManquant .
  FILTER NOT EXISTS {{ edu:{etudiant} edu:aValide ?prerequisManquant }}
  OPTIONAL {{ ?prerequisManquant edu:semestre ?semestre }}
}} ORDER BY ?semestre"""},
]
