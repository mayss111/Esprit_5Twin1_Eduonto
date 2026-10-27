"""MEMBRE 3 — Competence + Metier.

Routes spécifiques :
  - GET /api/m3/metiers/{id}/competences
  - GET /api/m3/etudiants/{id}/competences-manquantes
  - GET /api/m3/etudiants/{id}/recommandations-competences
  - GET /api/m3/metiers-en-tension
  - GET /api/m3/competences/{id}/cours
  - GET /api/m3/metiers/niveau-etudes?niveau=Master
  - GET /api/m3/statistiques-metiers                 agrégats COUNT + GROUP BY
  - POST /api/m3/metiers                             INSERT DATA (métier + compétences requises)
  - PUT /api/m3/metiers/{id}/competences             INSERT / DELETE de requiertCompetence
"""
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..saisie import verifier_attribut
from ..store import check_id, select, term, update

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
    """Liste les métiers accessibles au niveau d'études demandé.
    Les niveaux sont des xsd:string typés : on compare donc la valeur texte avec STR()."""
    return select(f"""
        SELECT DISTINCT ?metier ?intituleMetier ?niveauEtudesRequis ?estEnTension WHERE {{
          ?metier a/rdfs:subClassOf* edu:Metier ;
                   a owl:NamedIndividual ;
                   edu:niveauEtudesRequis ?niveauEtudesRequis .
          FILTER(STR(?niveauEtudesRequis) = "{niveau}")
          OPTIONAL {{ ?metier edu:intituleMetier ?intituleMetier }}
          OPTIONAL {{ ?metier edu:estEnTension ?estEnTension }}
        }} ORDER BY ?intituleMetier ?metier""")


@router.get("/statistiques-metiers")
def statistiques_metiers():
    """Par métier : nombre de compétences requises, nombre d'étudiants qui le visent, et s'il est en tension."""
    return select("""
        SELECT ?metier ?intituleMetier ?estEnTension
               (COUNT(DISTINCT ?competence) AS ?nbCompetences)
               (COUNT(DISTINCT ?etudiant) AS ?nbEtudiants)
        WHERE {
          ?metier a/rdfs:subClassOf* edu:Metier ;
                   a owl:NamedIndividual .
          OPTIONAL { ?metier edu:requiertCompetence ?competence }
          OPTIONAL { ?etudiant edu:viseMetier ?metier }
          OPTIONAL { ?metier edu:intituleMetier ?intituleMetier }
          OPTIONAL { ?metier edu:estEnTension ?estEnTension }
        }
        GROUP BY ?metier ?intituleMetier ?estEnTension
        ORDER BY DESC(?nbCompetences) DESC(?nbEtudiants) ?metier""")


# ======================= CREATE / UPDATE =======================

def est_un(ident: str, classe: str) -> bool:
    """Vrai si l'individu appartient à la classe (ou à une de ses sous-classes)."""
    return bool(select(f"SELECT ?t WHERE {{ edu:{ident} a ?t . ?t rdfs:subClassOf* edu:{classe} }} LIMIT 1"))


def types_metier() -> list[str]:
    """Sous-classes de Metier que l'on peut instancier (sans les classes définies, remplies par le raisonneur)."""
    return [r["c"] for r in select("""
        SELECT DISTINCT ?c WHERE {
          ?c rdfs:subClassOf+ edu:Metier . FILTER(isIRI(?c))
          FILTER NOT EXISTS { ?c owl:equivalentClass ?def }
        }""")]


class NouveauMetier(BaseModel):
    id: str = Field(examples=["IngenieurCloud"])
    type: str = Field(examples=["MetierInfrastructure"])
    intituleMetier: str = Field(min_length=1, examples=["Ingénieur cloud"])
    codeISCO: str | None = Field(None, examples=["2523"])
    niveauEtudesRequis: Literal["Licence", "Master", "Ingénieur", "Doctorat"] = Field(examples=["Ingénieur"])
    estEnTension: bool = False
    competences: list[str] = Field(default_factory=list, examples=[["GestionDonnees", "MethodeAgile"]])


@router.post("/metiers", status_code=201)
def creer_metier(m: NouveauMetier):
    """Crée un métier et ses compétences requises en une seule requête INSERT DATA."""
    verifier_attribut("intituleMetier", m.intituleMetier)
    verifier_attribut("codeISCO", m.codeISCO)
    verifier_attribut("niveauEtudesRequis", m.niveauEtudesRequis)
    i, t = check_id(m.id), check_id(m.type)
    if t not in types_metier():
        raise HTTPException(400, f"{t} n'est pas une sous-classe de Metier")
    if select(f"SELECT ?p WHERE {{ {{ edu:{i} ?p ?o }} UNION {{ ?s ?p edu:{i} }} }} LIMIT 1"):
        raise HTTPException(400, f"L'identifiant {i} existe déjà")
    liens = []
    for c in dict.fromkeys(m.competences):                 # sans doublons, ordre conservé
        c = check_id(c)
        if not est_un(c, "Competence"):
            raise HTTPException(400, f"{c} n'est pas une compétence")
        liens.append(f"edu:{i} edu:requiertCompetence edu:{c} .")
    code = f"edu:{i} edu:codeISCO {term('codeISCO', m.codeISCO)} ." if m.codeISCO else ""
    update(f"""
        INSERT DATA {{
          edu:{i} a owl:NamedIndividual, edu:{t} ;
                  edu:intituleMetier {term("intituleMetier", m.intituleMetier)} ;
                  edu:niveauEtudesRequis {term("niveauEtudesRequis", m.niveauEtudesRequis)} ;
                  edu:estEnTension {"true" if m.estEnTension else "false"} .
          {code}
          {" ".join(liens)}
        }}""")
    return {"cree": i, "type": t, "competences": [check_id(c) for c in dict.fromkeys(m.competences)]}


class ModifCompetence(BaseModel):
    competence: str = Field(examples=["MethodeAgile"])
    action: Literal["ajouter", "retirer"] = "ajouter"


@router.put("/metiers/{ident}/competences")
def modifier_competences(ident: str, modif: ModifCompetence):
    """Ajoute (INSERT DATA) ou retire (DELETE DATA) une compétence requise par un métier."""
    m, c = check_id(ident), check_id(modif.competence)
    if not est_un(m, "Metier"):
        raise HTTPException(404, f"{m} n'est pas un métier")
    if not est_un(c, "Competence"):
        raise HTTPException(400, f"{c} n'est pas une compétence")
    deja = bool(select(f"SELECT ?x WHERE {{ edu:{m} edu:requiertCompetence ?x . FILTER(?x = edu:{c}) }} LIMIT 1"))
    if modif.action == "ajouter":
        if deja:
            raise HTTPException(400, f"{m} requiert déjà {c}")
        update(f"INSERT DATA {{ edu:{m} edu:requiertCompetence edu:{c} . }}")
    else:
        if not deja:
            raise HTTPException(400, f"{m} ne requiert pas {c}")
        update(f"DELETE DATA {{ edu:{m} edu:requiertCompetence edu:{c} . }}")
    return {"metier": m, "competence": c, "action": modif.action}
