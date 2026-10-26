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
    # TODO membre 3 : « Métiers en tension », « Cours qui développent la compétence X »
]
