"""Chaque membre ajoute ses intentions dans son propre fichier.

Format d'une intention :
    {
      "name": "prerequis_cours",                # identifiant unique
      "membre": 2,
      "description": "les prérequis d'un cours",  # utilisé par le repli zero-shot
      "keywords": ["prerequis", "avant"],       # mots SANS accents, en minuscules
      "slots": {"cours": "Cours"},              # trou -> classe attendue, "number", "CLASS"
                                                #   ou {"enum": ["Principale", "Rattrapage"]} (valeur citée dans la question)
      "exemples": ["Quels sont les prérequis d'Angular ?", ...],  # optionnel : similarité sémantique
      "op_defaut": ">=",                        # optionnel : opérateur si la question n'en exprime pas ({op})
      "mots_requis": ["combien", "nombre"],     # optionnel : au moins un de ces mots doit être dans la question
                                                #   ([[...], [...]] : un mot de chaque groupe)
      "template": "SELECT ... edu:{cours} ...", # requête SPARQL avec les trous entre {}
    }
Dans les templates, doubler les accolades SPARQL : {{ et }}.
Avec un slot "number", le trou {op} reçoit l'opérateur lu dans la question (« moins de » → "<").
"""
from .commun import INTENTS as COMMUN
from .membre1 import INTENTS as M1
from .membre2 import INTENTS as M2
from .membre3 import INTENTS as M3
from .membre4 import INTENTS as M4
from .membre5 import INTENTS as M5
from .membre6 import INTENTS as M6

ALL_INTENTS = M1 + M2 + M3 + M4 + M5 + M6 + COMMUN
