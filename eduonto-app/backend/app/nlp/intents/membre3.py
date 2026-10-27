# MEMBRE 3 — Competence + Metier.
INTENTS = [
    {"name": "competences_metier", "membre": 3, "description": "les compétences requises par un métier",
     "keywords": ["competence", "competences", "requiert", "faut", "necessaire", "devenir"],
     "slots": {"metier": "Metier"},
     "template": """SELECT ?competence ?libelle WHERE {{
  edu:{metier} edu:requiertCompetence ?competence .
  OPTIONAL {{ ?competence edu:libelleCompetence ?libelle }}
}} ORDER BY ?competence"""},
    {"name": "competences_manquantes", "membre": 3, "description": "les compétences qui manquent à un étudiant pour son métier visé",
     "keywords": ["manque", "manquent", "manquantes", "manquer", "lui manque"],
     "slots": {"etudiant": "Etudiant"},
     "template": """SELECT ?metier ?competence WHERE {{
  edu:{etudiant} edu:viseMetier ?metier .
  ?metier edu:requiertCompetence ?competence .
  FILTER NOT EXISTS {{ ?p edu:atteste ?competence ; edu:delivreA edu:{etudiant} ; edu:estVerifie true }}
}} ORDER BY ?competence"""},
    {"name": "metiers_en_tension", "membre": 3, "description": "les métiers en tension",
     "keywords": ["metier", "metiers", "tension", "recrutement", "recrute"],
     "slots": {},
     "template": """SELECT DISTINCT ?metier ?intituleMetier ?niveauEtudesRequis WHERE {{
  ?metier a/rdfs:subClassOf* edu:Metier ; a owl:NamedIndividual ; edu:estEnTension true .
  OPTIONAL {{ ?metier edu:intituleMetier ?intituleMetier }}
  OPTIONAL {{ ?metier edu:niveauEtudesRequis ?niveauEtudesRequis }}
}} ORDER BY ?intituleMetier ?metier"""},
    {"name": "cours_competence", "membre": 3, "description": "les cours qui développent une compétence donnée",
     "keywords": ["cours", "competence", "developpe", "apprend", "acquiert"],
     "slots": {"competence": "Competence"},
     "template": """SELECT DISTINCT ?cours ?intitule ?competence ?libelleCompetence WHERE {{
  ?cours a/rdfs:subClassOf* edu:Cours ; a owl:NamedIndividual ; edu:developpeCompetence ?competence .
  FILTER (?competence = edu:{competence})
  OPTIONAL {{ ?cours edu:intitule ?intitule }}
  OPTIONAL {{ edu:{competence} edu:libelleCompetence ?libelleCompetence }}
}} ORDER BY ?intitule ?cours"""},
]
