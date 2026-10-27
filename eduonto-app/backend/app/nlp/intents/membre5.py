# MEMBRE 5 — RessourcePedagogique + AgentPedagogiqueIA.
# exemples : questions types, encodées par sentence-transformers pour la similarité sémantique.
INTENTS = [
    {"name": "agents_fiables", "membre": 5, "description": "les agents d'IA fiables et explicables",
     "keywords": ["fiable", "fiables", "confiance", "precision", "agent", "agents"],
     "slots": {},
     "exemples": ["Quels agents IA sont fiables ?", "Quels agents pédagogiques peut-on faire confiance ?",
                  "Agents dont la précision dépasse 90 %"],
     "template": """SELECT ?agent ?precision ?modele WHERE {{
  ?agent edu:tauxPrecision ?precision ; edu:estExplicable true .
  FILTER(?precision >= 0.9)
  OPTIONAL {{ ?agent edu:modeleIA ?modele }}
}} ORDER BY DESC(?precision)"""},

    {"name": "recommandations_etudiant", "membre": 5,
     "description": "ce qu'un agent pédagogique recommande à un étudiant",
     "keywords": ["recommande", "recommandation", "recommandations", "conseille", "propose"],
     "slots": {"etudiant": "Etudiant"},
     "exemples": ["Que recommande-t-on à Omar ?", "Quelles recommandations pour Ahmed ?",
                  "Que conseille l'agent à Sarra ?"],
     "template": """SELECT ?agent ?recommandation WHERE {{
  ?agent edu:assiste edu:{etudiant} ; edu:recommande ?recommandation .
}} ORDER BY ?agent ?recommandation"""},

    {"name": "ressources_libres", "membre": 5,
     "description": "les ressources pédagogiques en libre accès",
     "keywords": ["libre", "libres", "acces", "ouverte", "ouvertes", "gratuit", "gratuite"],
     "mots_requis": [["libre", "libres", "acces", "ouverte", "ouvertes", "gratuit", "gratuite"]],
     "slots": {},
     "exemples": ["Quelles ressources sont en libre accès ?", "Ressources pédagogiques ouvertes",
                  "Quels supports sont gratuits ?"],
     "template": """SELECT DISTINCT ?ressource ?titre ?langue ?dureeMinutes WHERE {{
  ?ressource a/rdfs:subClassOf* edu:RessourcePedagogique ; a owl:NamedIndividual ;
             edu:estLibreAcces true ; edu:langue ?langue .
  OPTIONAL {{ ?ressource edu:titre ?titre }}
  OPTIONAL {{ ?ressource edu:dureeMinutes ?dureeMinutes }}
}} ORDER BY ?langue ?titre"""},

    {"name": "ressources_libres_langue", "membre": 5,
     "description": "les ressources en libre accès d'une langue : français, anglais ou arabe",
     "keywords": ["libre", "libres", "acces", "francais", "anglais", "arabe", "ouverte", "ouvertes"],
     "mots_requis": [["libre", "libres", "acces", "ouverte", "ouvertes"]],
     "slots": {"langue": {"enum": ["français", "anglais", "arabe"]}},
     "exemples": ["Quelles ressources en français sont en libre accès ?",
                  "Ressources ouvertes en anglais", "Supports gratuits en arabe"],
     "template": """SELECT DISTINCT ?ressource ?titre ?langue ?dureeMinutes WHERE {{
  ?ressource a/rdfs:subClassOf* edu:RessourcePedagogique ; a owl:NamedIndividual ;
             edu:estLibreAcces true ; edu:langue ?langue .
  BIND(IF("{langue}" = "français", "FR", IF("{langue}" = "anglais", "EN", "AR")) AS ?code)
  FILTER(STR(?langue) = ?code)
  OPTIONAL {{ ?ressource edu:titre ?titre }}
  OPTIONAL {{ ?ressource edu:dureeMinutes ?dureeMinutes }}
}} ORDER BY ?titre"""},

    {"name": "ressources_cours", "membre": 5,
     "description": "les ressources pédagogiques utilisées par un cours",
     "keywords": ["ressource", "ressources", "support", "supports", "utilise", "utilisee", "utilisees"],
     "mots_requis": [["ressource", "ressources", "support", "supports"]],
     "slots": {"cours": "Cours"},
     "exemples": ["Quelles ressources utilise le cours Angular ?", "Supports du cours Web sémantique",
                  "Ressources du cours SQL"],
     "template": """SELECT ?ressource ?titre ?langue ?dureeMinutes ?estLibreAcces WHERE {{
  edu:{cours} edu:utiliseRessource ?ressource .
  OPTIONAL {{ ?ressource edu:titre ?titre }}
  OPTIONAL {{ ?ressource edu:langue ?langue }}
  OPTIONAL {{ ?ressource edu:dureeMinutes ?dureeMinutes }}
  OPTIONAL {{ ?ressource edu:estLibreAcces ?estLibreAcces }}
}} ORDER BY ?titre"""},

    {"name": "ressources_courtes", "membre": 5,
     "description": "les ressources pédagogiques de moins de N minutes",
     "keywords": ["minute", "minutes", "duree", "courte", "courtes", "court"],
     "mots_requis": [["minute", "minutes", "duree", "courte", "courtes"]],
     "slots": {"n": "number"}, "op_defaut": "<",
     "exemples": ["Ressources de moins de 30 minutes", "Quels supports durent au plus 20 minutes ?",
                  "Vidéos plus courtes que 60 minutes"],
     "template": """SELECT ?ressource ?titre ?dureeMinutes ?langue ?estLibreAcces WHERE {{
  ?ressource a/rdfs:subClassOf* edu:RessourcePedagogique ; a owl:NamedIndividual ;
             edu:dureeMinutes ?dureeMinutes .
  FILTER(?dureeMinutes {op} {n})
  OPTIONAL {{ ?ressource edu:titre ?titre }}
  OPTIONAL {{ ?ressource edu:langue ?langue }}
  OPTIONAL {{ ?ressource edu:estLibreAcces ?estLibreAcces }}
}} ORDER BY ?dureeMinutes"""},

    {"name": "ressources_parcours_etudiant", "membre": 5,
     "description": "les ressources des cours du parcours suivi par un étudiant",
     "keywords": ["ressource", "ressources", "support", "supports", "parcours"],
     "mots_requis": [["ressource", "ressources", "support", "supports"], ["parcours"]],
     "slots": {"etudiant": "Etudiant"},
     "exemples": ["Quelles ressources du parcours d'Ahmed ?", "Supports du parcours suivi par Yassine",
                  "Ressources pédagogiques du parcours de Sarra"],
     "template": """SELECT DISTINCT ?ressource ?titre ?cours ?parcours WHERE {{
  edu:{etudiant} edu:suitParcours/edu:comprendCours/edu:utiliseRessource ?ressource .
  edu:{etudiant} edu:suitParcours ?parcours .
  ?parcours edu:comprendCours ?cours .
  ?cours edu:utiliseRessource ?ressource .
  OPTIONAL {{ ?ressource edu:titre ?titre }}
}} ORDER BY ?cours ?titre"""},
]
