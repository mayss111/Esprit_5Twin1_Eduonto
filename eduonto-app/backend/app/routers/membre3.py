"""MEMBRE 3 — Competence + Metier.

Routes spécifiques :
  - GET /api/m3/metiers/{id}/competences
  - GET /api/m3/etudiants/{id}/competences-manquantes
  - GET /api/m3/etudiants/{id}/recommandations-competences
  - GET /api/m3/metiers-en-tension
  - GET /api/m3/competences/{id}/cours
  - GET /api/m3/metiers/niveau-etudes?niveau=Master
"""
from typing import Literal

from fastapi import APIRouter

from ..store import check_id, select

router = APIRouter(prefix="/api/m3", tags=["Membre 3 · Competence + Metier"])


@router.get("/metiers/{ident}/competences")
def competences_metier(ident: str):
    return select(f"""
        SELECT ?competence ?libelle WHERE {{
          edu:{check_id(ident)} edu:requiertCompetence ?competence .
          OPTIONAL {{ ?competence edu:libelleCompetence ?libelle }}
        }} ORDER BY ?competence""")


@router.get("/etudiants/{ident}/competences-manquantes")
def competences_manquantes(ident: str):
    e = check_id(ident)
    return select(f"""
        SELECT ?metier ?competence WHERE {{
          edu:{e} edu:viseMetier ?metier .
          ?metier edu:requiertCompetence ?competence .
          FILTER NOT EXISTS {{
            ?preuve edu:atteste ?competence ; edu:delivreA edu:{e} ; edu:estVerifie true .
          }}
        }} ORDER BY ?competence""")


@router.get("/etudiants/{ident}/recommandations-competences")
def recommandations_competences(ident: str):
    """Relie chaque compétence manquante aux cours qui peuvent la développer."""
    etudiant = check_id(ident)
    return select(f"""
        SELECT DISTINCT ?metier ?competence ?libelleCompetence ?cours ?intitule WHERE {{
          edu:{etudiant} edu:viseMetier ?metier .
          ?metier edu:requiertCompetence ?competence .
          FILTER NOT EXISTS {{
            ?preuve edu:atteste ?competence ; edu:delivreA edu:{etudiant} ; edu:estVerifie true .
          }}
          ?cours a/rdfs:subClassOf* edu:Cours ; a owl:NamedIndividual ;
                 edu:developpeCompetence ?competence .
          OPTIONAL {{ ?competence edu:libelleCompetence ?libelleCompetence }}
          OPTIONAL {{ ?cours edu:intitule ?intitule }}
        }} ORDER BY ?libelleCompetence ?intitule ?cours""")


@router.get("/metiers-en-tension")
def metiers_en_tension():
    """Liste les métiers signalés en tension dans l'ontologie."""
    return select("""
        SELECT DISTINCT ?metier ?intituleMetier ?niveauEtudesRequis WHERE {
          ?metier a/rdfs:subClassOf* edu:Metier ;
                   a owl:NamedIndividual ;
                   edu:estEnTension true .
          OPTIONAL { ?metier edu:intituleMetier ?intituleMetier }
          OPTIONAL { ?metier edu:niveauEtudesRequis ?niveauEtudesRequis }
        } ORDER BY ?intituleMetier ?metier""")


@router.get("/competences/{ident}/cours")
def cours_competence(ident: str):
    """Retrouve les cours qui développent la compétence demandée."""
    competence = check_id(ident)
    return select(f"""
        SELECT DISTINCT ?cours ?intitule ?competence ?libelleCompetence WHERE {{
          ?cours a/rdfs:subClassOf* edu:Cours ;
                 a owl:NamedIndividual ;
                 edu:developpeCompetence ?competence .
          FILTER (?competence = edu:{competence})
          OPTIONAL {{ ?cours edu:intitule ?intitule }}
          OPTIONAL {{ edu:{competence} edu:libelleCompetence ?libelleCompetence }}
        }} ORDER BY ?intitule ?cours""")


@router.get("/metiers/niveau-etudes")
def metiers_niveau_etudes(
    niveau: Literal["Licence", "Master", "Ingénieur", "Doctorat"],
):
    """Liste les métiers accessibles au niveau d'études demandé."""
    from rdflib import Literal as RDFLiteral

    niveau_sparql = RDFLiteral(niveau).n3()
    return select(f"""
        SELECT DISTINCT ?metier ?intituleMetier ?niveauEtudesRequis ?estEnTension WHERE {{
          ?metier a/rdfs:subClassOf* edu:Metier ;
                   a owl:NamedIndividual ;
                   edu:niveauEtudesRequis {niveau_sparql} .
          OPTIONAL {{ ?metier edu:intituleMetier ?intituleMetier }}
          OPTIONAL {{ ?metier edu:estEnTension ?estEnTension }}
        }} ORDER BY ?intituleMetier ?metier""")
