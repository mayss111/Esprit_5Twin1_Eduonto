# MEMBRE 4 — Evaluation + PreuveDeCompetence.
# keywords : mots sans accents ; slots : ce que spaCy doit trouver dans la question.
# exemples : questions types, encodées par sentence-transformers pour la similarité sémantique.
INTENTS = [
    # « Quelles évaluations ont une note supérieure à 12 ? » / « … inférieure à 10 ? » : {op} vient de la question
    {"name": "evaluations_note", "membre": 4,
     "description": "les évaluations dont la note est au-dessus ou en dessous d'un seuil",
     "keywords": ["note", "notes", "evaluation", "evaluations", "examen", "examens"],   # « supérieure à »… : opérateur
     "slots": {"n": "number"}, "op_defaut": ">",
     "exemples": ["Quelles évaluations ont une note supérieure à 12 ?", "Examens notés en dessous de 10",
                  "Évaluations avec au moins 14 sur 20"],
     "template": """SELECT ?evaluation ?note WHERE {{
  ?evaluation edu:note ?note .
  FILTER(?note {op} {n})
}} ORDER BY DESC(?note)"""},

    {"name": "competences_certifiees", "membre": 4,
     "description": "les compétences validées par un badge ou une certification vérifiée",
     "keywords": ["certifiee", "certifiees", "certifie", "verifiee", "verifiees", "blockchain", "validees"],
     "slots": {},
     "exemples": ["Quelles compétences sont certifiées ?", "Quelles compétences ont été vérifiées par une preuve ?",
                  "Compétences validées par la blockchain"],
     "template": """SELECT DISTINCT ?competence ?preuve WHERE {{
  ?preuve edu:atteste ?competence ; edu:estVerifie true .
}} ORDER BY ?competence"""},

    # « Quelle est la moyenne des notes par cours ? »
    {"name": "moyenne_notes", "membre": 4,
     "description": "les résultats des examens et la moyenne des notes",
     "keywords": ["moyenne", "moyennes", "statistiques", "statistique", "resultats"],
     "slots": {},
     "exemples": ["Quelle est la moyenne des notes par cours ?", "Statistiques des notes de chaque cours",
                  "Comment se sont passés les examens ?"],
     "template": """SELECT ?cours (ROUND(AVG(?note) * 100) / 100 AS ?moyenne) (COUNT(?evaluation) AS ?nbEvaluations) WHERE {{
  ?cours edu:estEvaluePar ?evaluation .
  ?evaluation edu:note ?note .
}} GROUP BY ?cours ORDER BY DESC(?moyenne)"""},

    # « Quelle est la moyenne d'Ahmed ? » — même mot-clé que moyenne_notes, mais avec un slot rempli :
    # le traducteur la préfère dès qu'un étudiant est nommé.
    {"name": "moyenne_etudiant", "membre": 4,
     "description": "la moyenne pondérée d'un étudiant et sa décision (admis ou ajourné)",
     "keywords": ["moyenne", "ponderee", "generale", "admis", "admise", "ajourne"],
     "slots": {"etudiant": "Etudiant"},
     "exemples": ["Quelle est la moyenne d'Ahmed ?", "Sarra est-elle admise ?", "Moyenne générale de Yassine"],
     "template": """SELECT ?etudiant ?moyennePonderee ?nbEvaluations ?decision WHERE {{
  {{
    SELECT ?etudiant (ROUND(SUM(?note * ?coef) / SUM(?coef) * 100) / 100 AS ?moyennePonderee)
           (COUNT(?evaluation) AS ?nbEvaluations)
    WHERE {{
      VALUES ?etudiant {{ edu:{etudiant} }}
      ?etudiant edu:aPasse ?evaluation .
      ?evaluation edu:note ?note .
      OPTIONAL {{ ?evaluation edu:coefficient ?coefficient }}
      BIND(COALESCE(?coefficient, 1) AS ?coef)
    }} GROUP BY ?etudiant
  }}
  BIND(IF(?moyennePonderee >= 10, "Admis", "Ajourné") AS ?decision)
}}"""},

    # « Quelles évaluations sont en session de rattrapage ? »
    {"name": "evaluations_rattrapage", "membre": 4,
     "description": "les examens de rattrapage et les étudiants qui ont échoué",
     "keywords": ["rattrapage", "rattrapages", "session de rattrapage", "echoue", "echoues", "echec", "rattraper"],
     "slots": {},
     "exemples": ["Quelles évaluations sont en session de rattrapage ?", "Qui a passé un examen de rattrapage ?",
                  "Quels étudiants ont échoué ?"],
     "template": """SELECT ?evaluation ?note ?etudiant WHERE {{
  ?evaluation edu:session ?session ; edu:note ?note .
  FILTER(STR(?session) = "Rattrapage")
  OPTIONAL {{ ?etudiant edu:aPasse ?evaluation }}
}} ORDER BY ?note"""},

    # « Quelles sont les évaluations de la session principale ? » — slot d'énumération (B3)
    {"name": "evaluations_session", "membre": 4,
     "description": "les évaluations d'une session d'examens, principale ou de rattrapage",
     "keywords": ["session", "sessions", "principale"],
     "slots": {"session": {"enum": ["Principale", "Rattrapage"]}},
     "exemples": ["Quelles sont les évaluations de la session principale ?", "Examens passés en session principale",
                  "Liste des épreuves de la première session"],
     "template": """SELECT ?evaluation ?note ?etudiant WHERE {{
  ?evaluation edu:session ?session ; edu:note ?note .
  FILTER(STR(?session) = "{session}")
  OPTIONAL {{ ?etudiant edu:aPasse ?evaluation }}
}} ORDER BY DESC(?note)"""},

    # « Quels badges a obtenu Sarra ? » / « Quelles preuves de compétence a Ahmed ? »
    {"name": "preuves_etudiant", "membre": 4,
     "description": "les preuves de compétence (badges, certifications) obtenues par un étudiant",
     "keywords": ["badge", "badges", "preuve", "preuves", "certification", "certifications", "obtenu", "diplome"],
     "slots": {"etudiant": "Etudiant"},
     "exemples": ["Quels badges a obtenu Sarra ?", "Quelles certifications possède Ahmed ?",
                  "Preuves de compétence de Yassine"],
     "template": """SELECT ?preuve ?competence ?verifiee WHERE {{
  ?preuve edu:delivreA edu:{etudiant} .
  OPTIONAL {{ ?preuve edu:atteste ?competence }}
  OPTIONAL {{ ?preuve edu:estVerifie ?verifiee }}
}} ORDER BY ?preuve"""},

    # « Quelles sont les notes d'Omar ? »
    {"name": "notes_etudiant", "membre": 4,
     "description": "le relevé des notes obtenues par un étudiant",
     "keywords": ["note", "notes", "resultat", "resultats", "releve"],
     "slots": {"etudiant": "Etudiant"},
     "exemples": ["Quelles sont les notes d'Omar ?", "Relevé de notes de Sarra", "Quels résultats a eu Ahmed ?"],
     "template": """SELECT ?evaluation ?note ?session WHERE {{
  edu:{etudiant} edu:aPasse ?evaluation .
  ?evaluation edu:note ?note .
  OPTIONAL {{ ?evaluation edu:session ?session }}
}} ORDER BY DESC(?note)"""},
]
