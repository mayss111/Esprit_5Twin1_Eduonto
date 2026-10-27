# MEMBRE 3 — Competence + Metier.
# exemples : questions types, encodées par sentence-transformers pour la similarité sémantique.
INTENTS = [
    {"name": "competences_metier", "membre": 3,
     "description": "les compétences requises pour exercer un métier",
     "keywords": ["competence", "competences", "requiert", "faut", "necessaire", "devenir"],
     "slots": {"metier": "Metier"},
     "exemples": ["Quelles compétences requiert le métier de développeur full-stack ?",
                  "Que faut-il savoir faire pour devenir data scientist ?",
                  "Compétences nécessaires pour être ingénieur DevOps"],
     "template": """SELECT ?competence ?libelle WHERE {{
  edu:{metier} edu:requiertCompetence ?competence .
  OPTIONAL {{ ?competence edu:libelleCompetence ?libelle }}
}} ORDER BY ?competence"""},
    {"name": "competences_manquantes", "membre": 3,
     "description": "les compétences qui manquent à un étudiant pour son métier visé",
     "keywords": ["manque", "manquent", "manquantes", "manquer", "lui manque", "acquerir"],
     "slots": {"etudiant": "Etudiant"},
     "exemples": ["Quelles compétences manquent à Ahmed ?", "Que doit encore acquérir Sarra pour son métier ?",
                  "Quelles compétences n'a pas encore Yassine ?"],
     "template": """SELECT ?metier ?competence WHERE {{
  edu:{etudiant} edu:viseMetier ?metier .
  ?metier edu:requiertCompetence ?competence .
  FILTER NOT EXISTS {{ ?p edu:atteste ?competence ; edu:delivreA edu:{etudiant} ; edu:estVerifie true }}
}} ORDER BY ?competence"""},
    {"name": "metiers_en_tension", "membre": 3,
     "description": "les métiers en tension, qui recrutent beaucoup",
     "keywords": ["metier", "metiers", "tension", "recrutement", "recrute", "recrutent", "penurie"],
     "slots": {},
     "exemples": ["Quels sont les métiers en tension ?", "Quels métiers recrutent le plus ?",
                  "Quels emplois sont les plus recherchés par les entreprises ?"],
     "template": """SELECT DISTINCT ?metier ?intituleMetier ?niveauEtudesRequis WHERE {{
  ?metier a/rdfs:subClassOf* edu:Metier ; a owl:NamedIndividual ; edu:estEnTension true .
  OPTIONAL {{ ?metier edu:intituleMetier ?intituleMetier }}
  OPTIONAL {{ ?metier edu:niveauEtudesRequis ?niveauEtudesRequis }}
}} ORDER BY ?intituleMetier ?metier"""},
    {"name": "cours_competence", "membre": 3,
     "description": "les cours qui permettent de développer une compétence",
     "keywords": ["cours", "competence", "developpe", "apprend", "acquiert"],
     "slots": {"competence": "Competence"},
     "exemples": ["Quels cours développent la compétence Développer des interfaces web ?",
                  "Où apprendre le machine learning ?", "Quel module fait progresser en travail en équipe ?"],
     "template": """SELECT DISTINCT ?cours ?intitule ?competence ?libelleCompetence WHERE {{
  ?cours a/rdfs:subClassOf* edu:Cours ; a owl:NamedIndividual ; edu:developpeCompetence ?competence .
  FILTER (?competence = edu:{competence})
  OPTIONAL {{ ?cours edu:intitule ?intitule }}
  OPTIONAL {{ edu:{competence} edu:libelleCompetence ?libelleCompetence }}
}} ORDER BY ?intitule ?cours"""},

    # « Quels métiers peut viser un étudiant de niveau Master ? » — slot d'énumération (B3)
    {"name": "metiers_niveau", "membre": 3,
     "description": "les métiers accessibles avec un niveau d'études : licence, master, ingénieur ou doctorat",
     "keywords": ["niveau", "accessible", "accessibles", "viser", "diplome", "etudes", "acceder"],
     "slots": {"niveau": {"enum": ["Licence", "Master", "Ingénieur", "Doctorat"]}},
     "exemples": ["Quels métiers peut viser un étudiant de niveau Master ?",
                  "Quels métiers sont accessibles avec une licence ?",
                  "Avec un diplôme d'ingénieur, quels emplois puis-je viser ?"],
     "template": """SELECT DISTINCT ?metier ?intituleMetier ?niveauEtudesRequis ?estEnTension WHERE {{
  ?metier a/rdfs:subClassOf* edu:Metier ; a owl:NamedIndividual ; edu:niveauEtudesRequis ?niveauEtudesRequis .
  FILTER(STR(?niveauEtudesRequis) = "{niveau}")
  OPTIONAL {{ ?metier edu:intituleMetier ?intituleMetier }}
  OPTIONAL {{ ?metier edu:estEnTension ?estEnTension }}
}} ORDER BY ?intituleMetier ?metier"""},

    # « Combien de compétences demande chaque métier ? » — agrégat COUNT + GROUP BY
    {"name": "nb_competences_metier", "membre": 3,
     "description": "le nombre de compétences demandées par chaque métier",
     "keywords": ["combien", "nombre", "chaque", "par metier", "demande", "demandent", "exige"],
     # « combien » seul ne suffit pas : la question doit parler de compétences ou de métiers
     "mots_requis": ["competence", "competences", "metier", "metiers", "emploi", "emplois"],
     "slots": {},
     "exemples": ["Combien de compétences demande chaque métier ?", "Nombre de compétences requises par métier",
                  "Quel métier exige le plus de compétences ?"],
     "template": """SELECT ?metier (COUNT(DISTINCT ?competence) AS ?nbCompetences)
       (COUNT(DISTINCT ?etudiant) AS ?nbEtudiants) WHERE {{
  ?metier a/rdfs:subClassOf* edu:Metier ; a owl:NamedIndividual .
  OPTIONAL {{ ?metier edu:requiertCompetence ?competence }}
  OPTIONAL {{ ?etudiant edu:viseMetier ?metier }}
}} GROUP BY ?metier ORDER BY DESC(?nbCompetences) ?metier"""},
]
