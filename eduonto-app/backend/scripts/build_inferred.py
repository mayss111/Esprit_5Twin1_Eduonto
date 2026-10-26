"""Lance le raisonneur HermiT sur EduOnto.owl et enregistre une copie
contenant les connaissances déduites (EduOnto_inferred.owl).

Le moteur SPARQL (rdflib) ne raisonne pas : sans ce fichier, des questions
comme « Quels étudiants sont à risque ? » ne renverraient rien.

Usage (depuis le dossier backend) :
    python scripts/build_inferred.py
Prérequis : Java installé (HermiT est un programme Java) et `pip install owlready2`.
"""
from pathlib import Path

from owlready2 import get_ontology, sync_reasoner

ROOT = Path(__file__).resolve().parents[2] / "ontology"
SRC = ROOT / "EduOnto.owl"
DST = ROOT / "EduOnto_inferred.owl"

onto = get_ontology(SRC.as_uri()).load()
with onto:
    sync_reasoner(infer_property_values=True, debug=0)
onto.save(file=str(DST), format="rdfxml")
print(f"Ontologie avec inférences enregistrée : {DST}")
