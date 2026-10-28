# MEMBRE 6 — ParcoursApprentissage + IndicateurApprentissage.
# exemples : questions types, encodées par sentence-transformers pour la similarité sémantique.
# Sens d'une alerte : valeur HAUTE pour le bien-être (stress, charge), valeur BASSE pour le reste.
INTENTS = [
    {"name": "etudiants_a_risque", "membre": 6, "description": "les étudiants à risque de décrochage",
     "keywords": ["risque", "decrochage", "decroche", "decrocher", "assiduite", "difficulte"],
     "slots": {},
     "exemples": ["Quels étudiants sont à risque de décrochage ?", "Qui risque de décrocher ?",
                  "Étudiants en difficulté d'assiduité"],
     "template": """SELECT ?etudiant ?valeur ?seuil WHERE {{
  ?indicateur a/rdfs:subClassOf* edu:TauxAssiduite ;
              edu:concerne ?etudiant ; edu:valeur ?valeur ; edu:seuilAlerte ?seuil .
  FILTER(?valeur < ?seuil)
}} ORDER BY ?valeur"""},

    {"name": "cours_parcours", "membre": 6, "description": "les cours d'un parcours",
     "keywords": ["parcours", "comprend", "contient", "cours"],
     "mots_requis": [["cours", "comprend", "contient", "matiere", "matieres", "modules"]],
     "slots": {"parcours": "ParcoursApprentissage"},
     "exemples": ["Quels cours comprend le parcours Full-Stack ?", "Que contient le Rattrapage SQL ?",
                  "Les matières du parcours Données"],
     "template": """SELECT ?cours ?intitule WHERE {{
  edu:{parcours} edu:comprendCours ?cours .
  OPTIONAL {{ ?cours edu:intitule ?intitule }}
}} ORDER BY ?cours"""},

    {"name": "etudiants_parcours", "membre": 6, "description": "les étudiants qui suivent un parcours",
     "keywords": ["parcours", "suit", "suivent", "qui", "etudiants", "inscrits"],
     "mots_requis": [["suit", "suivent", "qui", "etudiants", "inscrits", "inscrit"]],
     "slots": {"parcours": "ParcoursApprentissage"},
     "exemples": ["Qui suit le parcours Full-Stack ?", "Quels étudiants suivent le parcours Données ?",
                  "Les inscrits du Rattrapage SQL"],
     "template": """SELECT ?etudiant ?prenom ?nom WHERE {{
  ?etudiant edu:suitParcours edu:{parcours} .
  OPTIONAL {{ ?etudiant edu:prenom ?prenom }}
  OPTIONAL {{ ?etudiant edu:nom ?nom }}
}} ORDER BY ?etudiant"""},

    {"name": "parcours_etudiant", "membre": 6, "description": "le parcours suivi par un étudiant",
     "keywords": ["parcours", "suit", "suivi"],
     "mots_requis": [["parcours"]],
     "slots": {"etudiant": "Etudiant"},
     "exemples": ["Quel parcours suit Ahmed ?", "Dans quel parcours est Sarra ?", "Le parcours de Yassine"],
     "template": """SELECT ?parcours ?nomParcours ?cours WHERE {{
  edu:{etudiant} edu:suitParcours ?parcours .
  OPTIONAL {{ ?parcours edu:nomParcours ?nomParcours }}
  OPTIONAL {{ ?parcours edu:comprendCours ?cours }}
}} ORDER BY ?cours"""},

    {"name": "indicateurs_etudiant", "membre": 6,
     "description": "les indicateurs d'apprentissage d'un étudiant (assiduité, réussite, stress)",
     "keywords": ["indicateur", "indicateurs", "comment va", "situation", "suivi", "mesures", "assiduite",
                  "stress", "reussite", "participation"],
     "mots_requis": [["indicateur", "indicateurs", "comment", "situation", "suivi", "mesures", "assiduite",
                      "stress", "reussite", "participation"]],
     "slots": {"etudiant": "Etudiant"},
     "exemples": ["Quels sont les indicateurs d'Omar ?", "Comment va Sarra ?",
                  "Quelle est la situation de Lina ?"],
     "template": """SELECT ?indicateur ?type ?valeur ?seuil ?alerte WHERE {{
  ?indicateur edu:concerne edu:{etudiant} ; edu:valeur ?valeur ; edu:seuilAlerte ?seuil ; a ?t .
  ?t rdfs:subClassOf+ edu:IndicateurApprentissage .
  BIND(STRAFTER(STR(?t), "#") AS ?type)
  BIND(IF(EXISTS {{ ?t rdfs:subClassOf* edu:IndicateurBienEtre }}, ?valeur > ?seuil, ?valeur < ?seuil) AS ?alerte)
}} ORDER BY DESC(?alerte) ?type"""},

    {"name": "alertes_indicateurs", "membre": 6,
     "description": "les indicateurs qui dépassent leur seuil d'alerte",
     "keywords": ["alerte", "alertes", "seuil", "depasse", "depassent", "indicateur", "indicateurs"],
     "mots_requis": [["alerte", "alertes", "seuil", "depasse", "depassent", "depassement"]],
     "slots": {},
     "exemples": ["Quels indicateurs dépassent leur seuil d'alerte ?", "Quelles sont les alertes ?",
                  "Liste des alertes d'apprentissage"],
     "template": """SELECT ?etudiant ?indicateur ?type ?valeur ?seuil WHERE {{
  ?indicateur edu:concerne ?etudiant ; edu:valeur ?valeur ; edu:seuilAlerte ?seuil ; a ?t .
  ?t rdfs:subClassOf+ edu:IndicateurApprentissage .
  BIND(STRAFTER(STR(?t), "#") AS ?type)
  FILTER(IF(EXISTS {{ ?t rdfs:subClassOf* edu:IndicateurBienEtre }}, ?valeur > ?seuil, ?valeur < ?seuil))
}} ORDER BY ?etudiant ?type"""},

    {"name": "recommandation_parcours", "membre": 6,
     "description": "le parcours de rattrapage à conseiller à un étudiant en difficulté",
     "keywords": ["parcours", "conseiller", "recommander", "conseille", "recommande", "rattrapage", "adapte",
                  "orienter"],
     "mots_requis": [["parcours", "rattrapage"],
                     ["conseiller", "recommander", "conseille", "recommande", "conseilles", "recommandes",
                      "adapte", "orienter", "suggerer", "rattrapage"]],
     "slots": {"etudiant": "Etudiant"},
     "exemples": ["Quel parcours conseiller à Omar ?", "Quel rattrapage recommander à Lina ?",
                  "Vers quel parcours orienter Omar ?"],
     "template": """SELECT ?parcours ?nomParcours ?cours ?note WHERE {{
  ?parcours a/rdfs:subClassOf* edu:ParcoursRattrapage ; edu:comprendCours ?cours .
  OPTIONAL {{ ?parcours edu:nomParcours ?nomParcours }}
  OPTIONAL {{ edu:{etudiant} edu:aPasse ?evaluation . ?cours edu:estEvaluePar ?evaluation .
             ?evaluation edu:note ?note }}
  FILTER NOT EXISTS {{ edu:{etudiant} edu:aValide ?cours }}
}} ORDER BY ?note ?parcours"""},
]
