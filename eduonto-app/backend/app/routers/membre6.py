"""MEMBRE 6 — ParcoursApprentissage + IndicateurApprentissage.

Routes :
  GET  /api/m6/parcours                            catalogue (type, nb de cours, nb d'étudiants, cours)
  GET  /api/m6/parcours/recherche?q=               CONTAINS sur le nom, l'objectif, le code
  GET  /api/m6/parcours/{id}/cours                 edu:comprendCours
  GET  /api/m6/parcours/{id}/etudiants             étudiants qui suivent le parcours (suitParcours)
  GET  /api/m6/etudiants/{id}/parcours             parcours suivi, ses cours, et ceux déjà validés
  GET  /api/m6/etudiants/{id}/indicateurs          indicateurs d'un étudiant : famille, seuil, alerte
  GET  /api/m6/etudiants/{id}/profil-risque        classes affirmées / déduites (EtudiantARisque)
  GET  /api/m6/etudiants/{id}/recommandation       parcours personnalisé conseillé (valeur ajoutée)
  GET  /api/m6/etudiants-a-risque?seuil=0.6        assiduité sous un seuil donné
  GET  /api/m6/alertes?etudiant=&toutes=           chaque indicateur comparé à SON seuilAlerte, dans le bon sens
  GET  /api/m6/suivi                               tableau de bord : parcours, nb d'indicateurs, nb d'alertes
  GET  /api/m6/statistiques                        AVG / MIN / MAX / COUNT par type d'indicateur
  POST /api/m6/indicateurs                         INSERT DATA (nouvelle mesure)
  PUT  /api/m6/indicateurs/{id}                    DELETE / INSERT (nouvelle valeur, nouveau seuil)
  POST /api/m6/parcours                            INSERT DATA (parcours et ses cours)
  PUT  /api/m6/etudiants/{id}/parcours             DELETE / INSERT de suitParcours (inscrire, changer, retirer)

Sens d'une alerte : pour l'engagement et la performance, une valeur BASSE est mauvaise (assiduité 0,55 < 0,6) ;
pour le bien-être (stress, charge de travail), une valeur HAUTE est mauvaise (stress 0,82 > 0,7).
C'est la hiérarchie de classes (rdfs:subClassOf* edu:IndicateurBienEtre) qui donne le sens à la requête.
L'inverse aIndicateur n'est pas matérialisé (rdflib ne raisonne pas) : les requêtes utilisent edu:concerne.
"""
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ..saisie import verifier_attribut
from ..store import check_id, select, term, update

router = APIRouter(prefix="/api/m6", tags=["Membre 6 · ParcoursApprentissage + IndicateurApprentissage"])

# Alerte d'un indicateur de type ?t, de valeur ?valeur et de seuil ?seuil (inséré tel quel : accolades simples)
ALERTE = """
          BIND(EXISTS { ?t rdfs:subClassOf* edu:IndicateurBienEtre } AS ?hautEstMauvais)
          BIND(IF(?hautEstMauvais, ?valeur > ?seuil, ?valeur < ?seuil) AS ?alerte)"""


def type_precis(var: str, racine: str) -> str:
    """Motif SPARQL : ?t = type affirmé le plus précis de var sous la classe racine, ?type = son nom."""
    return f"""
          {var} a ?t . ?t rdfs:subClassOf* edu:{racine} .
          FILTER NOT EXISTS {{ ?t owl:equivalentClass ?def }}
          FILTER NOT EXISTS {{ {var} a ?plus . ?plus rdfs:subClassOf ?t .
                              FILTER(?plus != ?t) FILTER NOT EXISTS {{ ?plus owl:equivalentClass ?d }} }}
          BIND(STRAFTER(STR(?t), "#") AS ?type)"""


def est_un(ident: str, classe: str) -> bool:
    """Vrai si l'individu appartient à la classe (ou à une de ses sous-classes)."""
    return bool(select(f"SELECT ?t WHERE {{ edu:{ident} a ?t . ?t rdfs:subClassOf* edu:{classe} }} LIMIT 1"))


def sous_classes(classe: str) -> list[str]:
    """Sous-classes instanciables (les classes définies sont remplies par HermiT, pas à la main)."""
    return [r["sousClasse"] for r in select(f"""
        SELECT DISTINCT ?sousClasse WHERE {{
          ?sousClasse rdfs:subClassOf+ edu:{classe} . FILTER(isIRI(?sousClasse))
          FILTER NOT EXISTS {{ ?sousClasse owl:equivalentClass ?def }}
        }}""")]


def existe(ident: str) -> bool:
    return bool(select(f"SELECT ?p WHERE {{ {{ edu:{ident} ?p ?o }} UNION {{ ?s ?p edu:{ident} }} }} LIMIT 1"))


def echapper(texte: str) -> str:
    """Rend une chaîne sûre à l'intérieur de guillemets SPARQL."""
    return texte.replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ")


def un_etudiant(ident: str, code: int = 404) -> str:
    e = check_id(ident)
    if not est_un(e, "Etudiant"):
        raise HTTPException(code, f"{e} n'est pas un étudiant")
    return e


def un_parcours(ident: str, code: int = 404) -> str:
    p = check_id(ident)
    if not est_un(p, "ParcoursApprentissage"):
        raise HTTPException(code, f"{p} n'est pas un parcours d'apprentissage")
    return p


# ======================= READ : parcours =======================

def _catalogue(filtre: str = "") -> str:
    return f"""
        SELECT ?parcours ?type ?nomParcours ?codeParcours ?dureeSemestres ?objectifParcours
               (COUNT(DISTINCT ?cours) AS ?nbCours) (COUNT(DISTINCT ?etudiant) AS ?nbEtudiants)
               (GROUP_CONCAT(DISTINCT STRAFTER(STR(?cours), "#"); separator=", ") AS ?listeCours)
        WHERE {{
          ?parcours a owl:NamedIndividual .
          {type_precis("?parcours", "ParcoursApprentissage")}
          OPTIONAL {{ ?parcours edu:nomParcours ?nomParcours }}
          OPTIONAL {{ ?parcours edu:codeParcours ?codeParcours }}
          OPTIONAL {{ ?parcours edu:dureeSemestres ?dureeSemestres }}
          OPTIONAL {{ ?parcours edu:objectifParcours ?objectifParcours }}
          OPTIONAL {{ ?parcours edu:comprendCours ?cours }}
          OPTIONAL {{ ?etudiant edu:suitParcours ?parcours }}
          {filtre}
        }}
        GROUP BY ?parcours ?type ?nomParcours ?codeParcours ?dureeSemestres ?objectifParcours
        ORDER BY ?type ?nomParcours"""


@router.get("/parcours")
def catalogue_parcours():
    """Tous les parcours, avec leur type le plus précis, leurs cours et le nombre d'étudiants."""
    return select(_catalogue())


@router.get("/parcours/recherche")
def rechercher_parcours(q: str = ""):
    """Recherche (insensible à la casse) dans le nom, l'objectif et le code du parcours."""
    filtre = ""
    if q.strip():
        mot = echapper(q.strip().lower())
        filtre = f"""FILTER(
            CONTAINS(LCASE(STR(COALESCE(?nomParcours, ""))), "{mot}") ||
            CONTAINS(LCASE(STR(COALESCE(?objectifParcours, ""))), "{mot}") ||
            CONTAINS(LCASE(STR(COALESCE(?codeParcours, ""))), "{mot}")
        )"""
    return select(_catalogue(filtre))


@router.get("/parcours/{ident}/cours")
def cours_parcours(ident: str):
    return select(f"""
        SELECT ?cours ?intitule ?nbCredits WHERE {{
          edu:{un_parcours(ident)} edu:comprendCours ?cours .
          OPTIONAL {{ ?cours edu:intitule ?intitule }}
          OPTIONAL {{ ?cours edu:nbCredits ?nbCredits }}
        }} ORDER BY ?cours""")


@router.get("/parcours/{ident}/etudiants")
def etudiants_parcours(ident: str):
    """Étudiants qui suivent un parcours donné."""
    return select(f"""
        SELECT ?etudiant ?prenom ?nom ?anneeEtude ?formation WHERE {{
          ?etudiant edu:suitParcours edu:{un_parcours(ident)} .
          OPTIONAL {{ ?etudiant edu:prenom ?prenom }}
          OPTIONAL {{ ?etudiant edu:nom ?nom }}
          OPTIONAL {{ ?etudiant edu:anneeEtude ?anneeEtude }}
          OPTIONAL {{ ?etudiant edu:inscritA ?formation }}
        }} ORDER BY ?etudiant""")


# ======================= READ : étudiants et indicateurs =======================

@router.get("/etudiants/{ident}/parcours")
def parcours_etudiant(ident: str):
    """Parcours suivi par un étudiant, avec ses cours et ceux que l'étudiant a déjà validés."""
    e = un_etudiant(ident)
    return select(f"""
        SELECT ?parcours ?nomParcours ?cours ?intitule ?valide WHERE {{
          edu:{e} edu:suitParcours ?parcours .
          OPTIONAL {{ ?parcours edu:nomParcours ?nomParcours }}
          ?parcours edu:comprendCours ?cours .
          OPTIONAL {{ ?cours edu:intitule ?intitule }}
          BIND(EXISTS {{ edu:{e} edu:aValide ?cours }} AS ?valide)
        }} ORDER BY ?parcours ?cours""")


@router.get("/etudiants/{ident}/indicateurs")
def indicateurs_etudiant(ident: str):
    """Tous les indicateurs d'un étudiant : type, famille, valeur, seuil et alerte."""
    e = un_etudiant(ident)
    return select(f"""
        SELECT ?indicateur ?type ?famille ?valeur ?seuil ?alerte ?dateMesure ?periodeMesure ?sourceDonnees WHERE {{
          ?indicateur edu:concerne edu:{e} ; edu:valeur ?valeur ; edu:seuilAlerte ?seuil .
          {type_precis("?indicateur", "IndicateurApprentissage")}
          ?t rdfs:subClassOf* ?f . ?f rdfs:subClassOf edu:IndicateurApprentissage .
          BIND(STRAFTER(STR(?f), "#") AS ?famille)
          {ALERTE}
          OPTIONAL {{ ?indicateur edu:dateMesure ?dateMesure }}
          OPTIONAL {{ ?indicateur edu:periodeMesure ?periodeMesure }}
          OPTIONAL {{ ?indicateur edu:sourceDonnees ?sourceDonnees }}
        }} ORDER BY ?famille ?type""")


@router.get("/etudiants/{ident}/profil-risque")
def profil_risque(ident: str):
    """Classes de l'étudiant. EtudiantARisque est déduite par HermiT (owl:equivalentClass), jamais saisie."""
    e = un_etudiant(ident)
    return select(f"""
        SELECT ?classe ?origine WHERE {{
          edu:{e} a ?c .
          FILTER(?c != owl:NamedIndividual && isIRI(?c))
          ?c rdfs:subClassOf* edu:Etudiant .
          BIND(STRAFTER(STR(?c), "#") AS ?classe)
          BIND(IF(EXISTS {{ ?c owl:equivalentClass ?definition }}, "déduite par HermiT", "affirmée") AS ?origine)
        }} ORDER BY ?origine ?classe""")


@router.get("/etudiants/{ident}/recommandation")
def recommandation(ident: str):
    """Valeur ajoutée : le parcours personnalisé à conseiller.
    - cours en difficulté (évaluation passée avec une note < 10) -> parcours de rattrapage qui les couvrent ;
    - sinon, au moins une alerte -> parcours de rattrapage, classés par nombre de cours non validés ;
    - sinon -> parcours d'excellence, classés par nombre de cours non validés."""
    e = un_etudiant(ident)
    en_difficulte = select(f"""
        SELECT DISTINCT ?cours WHERE {{
          edu:{e} edu:aPasse ?evaluation . ?evaluation edu:note ?note . FILTER(?note < 10)
          ?cours edu:estEvaluePar ?evaluation .
        }}""")
    en_alerte = bool(alertes(e))
    if en_difficulte:
        classe, motif = "ParcoursRattrapage", "couvre un cours où la note est inférieure à 10"
        critere = f"""?parcours edu:comprendCours ?cible .
          ?cible edu:estEvaluePar ?evaluation . edu:{e} edu:aPasse ?evaluation .
          ?evaluation edu:note ?note . FILTER(?note < 10)"""
    else:
        classe = "ParcoursRattrapage" if en_alerte else "ParcoursExcellence"
        motif = "indicateur en alerte" if en_alerte else "aucune alerte : parcours pour aller plus loin"
        critere = f"""?parcours edu:comprendCours ?cible .
          FILTER NOT EXISTS {{ edu:{e} edu:aValide ?cible }}"""
    return select(f"""
        SELECT ?parcours ?nomParcours ?type (COUNT(DISTINCT ?cible) AS ?nbCoursCibles)
               (GROUP_CONCAT(DISTINCT STRAFTER(STR(?cible), "#"); separator=", ") AS ?coursCibles)
               ?dejaSuivi ?motif
        WHERE {{
          ?parcours a ?t . ?t rdfs:subClassOf* edu:{classe} .
          BIND(STRAFTER(STR(?t), "#") AS ?type)
          {critere}
          OPTIONAL {{ ?parcours edu:nomParcours ?nomParcours }}
          BIND(EXISTS {{ edu:{e} edu:suitParcours ?parcours }} AS ?dejaSuivi)
          BIND("{motif}" AS ?motif)
        }}
        GROUP BY ?parcours ?nomParcours ?type ?dejaSuivi ?motif
        ORDER BY DESC(?nbCoursCibles) ?parcours""")


@router.get("/etudiants-a-risque")
def etudiants_a_risque(seuil: float = 0.6):
    return select(f"""
        SELECT ?etudiant ?indicateur ?valeur WHERE {{
          ?indicateur a/rdfs:subClassOf* edu:TauxAssiduite ;
                      edu:concerne ?etudiant ; edu:valeur ?valeur .
          FILTER(?valeur < {float(seuil)})
        }} ORDER BY ?valeur""")


@router.get("/alertes")
def alertes(etudiant: str | None = None, toutes: bool = False):
    """Chaque indicateur comparé à son propre seuilAlerte, dans le sens donné par sa classe.
    Par défaut seules les alertes ; toutes=true renvoie aussi les indicateurs normaux."""
    filtre_etudiant = f"FILTER(?etudiant = edu:{un_etudiant(etudiant)})" if etudiant else ""
    return select(f"""
        SELECT ?etudiant ?prenom ?indicateur ?type ?valeur ?seuil ?sens ?alerte WHERE {{
          ?indicateur edu:concerne ?etudiant ; edu:valeur ?valeur ; edu:seuilAlerte ?seuil .
          {filtre_etudiant}
          {type_precis("?indicateur", "IndicateurApprentissage")}
          {ALERTE}
          BIND(IF(?hautEstMauvais, "valeur haute = alerte", "valeur basse = alerte") AS ?sens)
          {"" if toutes else "FILTER(?alerte)"}
          OPTIONAL {{ ?etudiant edu:prenom ?prenom }}
        }} ORDER BY DESC(?alerte) ?etudiant ?type""")


@router.get("/suivi")
def suivi():
    """Tableau de bord : pour chaque étudiant, parcours suivi, nombre d'indicateurs et nombre d'alertes."""
    return select(f"""
        SELECT DISTINCT ?etudiant ?prenom ?nom ?parcours ?nbIndicateurs ?nbAlertes ?aRisque WHERE {{
          ?etudiant a/rdfs:subClassOf* edu:Etudiant ; a owl:NamedIndividual .
          OPTIONAL {{ ?etudiant edu:prenom ?prenom }}
          OPTIONAL {{ ?etudiant edu:nom ?nom }}
          OPTIONAL {{ ?etudiant edu:suitParcours ?parcours }}
          OPTIONAL {{
            SELECT ?etudiant (COUNT(DISTINCT ?indicateur) AS ?nb) (SUM(IF(?alerte, 1, 0)) AS ?nbA) WHERE {{
              ?indicateur edu:concerne ?etudiant ; edu:valeur ?valeur ; edu:seuilAlerte ?seuil ; a ?t .
              ?t rdfs:subClassOf+ edu:IndicateurApprentissage .
              {ALERTE}
            }} GROUP BY ?etudiant
          }}
          BIND(COALESCE(?nb, 0) AS ?nbIndicateurs)
          BIND(COALESCE(?nbA, 0) AS ?nbAlertes)
          BIND(EXISTS {{ ?etudiant a edu:EtudiantARisque }} AS ?aRisque)
        }}
        ORDER BY DESC(?nbAlertes) ?etudiant""")


@router.get("/statistiques")
def statistiques():
    """Par type d'indicateur : nombre de mesures, moyenne, minimum, maximum et nombre d'alertes."""
    return select(f"""
        SELECT ?type (COUNT(?indicateur) AS ?nbMesures)
               (ROUND(AVG(?valeur) * 100) / 100 AS ?moyenne) (MIN(?valeur) AS ?minimum) (MAX(?valeur) AS ?maximum)
               (SUM(IF(?alerte, 1, 0)) AS ?nbAlertes)
        WHERE {{
          ?indicateur edu:concerne ?etudiant ; edu:valeur ?valeur ; edu:seuilAlerte ?seuil .
          {type_precis("?indicateur", "IndicateurApprentissage")}
          {ALERTE}
        }}
        GROUP BY ?type
        ORDER BY DESC(?nbAlertes) ?type""")


# ======================= CREATE / UPDATE =======================

class NouvelIndicateur(BaseModel):
    id: str = Field(examples=["Stress_Yassine"])
    type: str = Field(examples=["NiveauStress"])
    etudiant: str = Field(examples=["Yassine"])
    valeur: float = Field(ge=0, le=1, examples=[0.45])
    seuilAlerte: float = Field(ge=0, le=1, examples=[0.7])
    periodeMesure: Literal["Hebdomadaire", "Mensuelle", "Semestrielle"] = "Mensuelle"
    sourceDonnees: str | None = Field(None, examples=["Questionnaire bien-être"])
    dateMesure: str | None = Field(None, description="AAAA-MM-JJ ou AAAA-MM-JJTHH:MM:SS ; par défaut maintenant")


@router.post("/indicateurs", status_code=201)
def creer_indicateur(m: NouvelIndicateur):
    """Enregistre une mesure pour un étudiant. Le sens de l'alerte vient de la classe choisie."""
    verifier_attribut("valeur", m.valeur)
    verifier_attribut("seuilAlerte", m.seuilAlerte)
    verifier_attribut("sourceDonnees", m.sourceDonnees)
    verifier_attribut("dateMesure", m.dateMesure)
    i, t = check_id(m.id), check_id(m.type)
    if t not in sous_classes("IndicateurApprentissage"):
        raise HTTPException(400, f"{t} n'est pas une sous-classe instanciable de IndicateurApprentissage")
    e = un_etudiant(m.etudiant, 400)
    if existe(i):
        raise HTTPException(400, f"L'identifiant {i} existe déjà")
    date = datetime.fromisoformat(m.dateMesure) if m.dateMesure else datetime.now().replace(microsecond=0)
    source = f"edu:{i} edu:sourceDonnees {term('sourceDonnees', m.sourceDonnees)} ." if m.sourceDonnees else ""
    update(f"""
        INSERT DATA {{
          edu:{i} a owl:NamedIndividual, edu:{t} ;
                  edu:concerne edu:{e} ;
                  edu:valeur {term("valeur", m.valeur)} ;
                  edu:seuilAlerte {term("seuilAlerte", m.seuilAlerte)} ;
                  edu:periodeMesure {term("periodeMesure", m.periodeMesure)} ;
                  edu:dateMesure {term("dateMesure", date.isoformat())} .
          edu:{e} edu:aIndicateur edu:{i} .
          {source}
        }}""")
    return {"cree": i, "type": t, "etudiant": e, "alerte": any(a["indicateur"] == i for a in alertes(e))}


class MiseAJourIndicateur(BaseModel):
    valeur: float = Field(ge=0, le=1, examples=[0.65])
    seuilAlerte: float | None = Field(None, ge=0, le=1)


@router.put("/indicateurs/{ident}")
def modifier_indicateur(ident: str, m: MiseAJourIndicateur):
    """Nouvelle mesure : remplace la valeur (et éventuellement le seuil), met la date de mesure à jour."""
    i = check_id(ident)
    if not est_un(i, "IndicateurApprentissage"):
        raise HTTPException(404, f"{i} n'est pas un indicateur d'apprentissage")
    verifier_attribut("valeur", m.valeur)
    verifier_attribut("seuilAlerte", m.seuilAlerte)
    props = {"valeur": m.valeur, "dateMesure": datetime.now().replace(microsecond=0).isoformat()}
    if m.seuilAlerte is not None:
        props["seuilAlerte"] = m.seuilAlerte
    for p, v in props.items():
        update(f"""
            DELETE {{ edu:{i} edu:{p} ?ancien }}
            INSERT {{ edu:{i} edu:{p} {term(p, v)} }}
            WHERE  {{ OPTIONAL {{ edu:{i} edu:{p} ?ancien }} }}""")
    e = select(f"SELECT ?e WHERE {{ edu:{i} edu:concerne ?e }} LIMIT 1")
    alerte = bool(e) and any(a["indicateur"] == i for a in alertes(e[0]["e"]))
    return {"modifie": i, **props, "alerte": alerte}


class NouveauParcours(BaseModel):
    id: str = Field(examples=["Parcours_Cloud"])
    type: str = Field(examples=["ParcoursSpecialisation"])
    nomParcours: str = Field(min_length=2, examples=["Parcours Cloud"])
    codeParcours: str = Field(examples=["PCLOUD"])
    dureeSemestres: int = Field(ge=1, examples=[2])
    objectifParcours: str | None = Field(None, examples=["Déployer des applications dans le cloud"])
    cours: list[str] = Field(min_length=2, description="Au moins 2 cours (restriction comprendCours min 2)",
                             examples=[["SQL", "JavaScript"]])
    formation: str | None = Field(None, description="Formation qui propose le parcours (proposeParcours)")


@router.post("/parcours", status_code=201)
def creer_parcours(m: NouveauParcours):
    """Crée un parcours et ses cours. L'ontologie impose comprendCours min 2 Cours."""
    verifier_attribut("nomParcours", m.nomParcours)
    verifier_attribut("codeParcours", m.codeParcours)
    verifier_attribut("dureeSemestres", m.dureeSemestres)
    verifier_attribut("objectifParcours", m.objectifParcours)
    i, t = check_id(m.id), check_id(m.type)
    if t not in sous_classes("ParcoursApprentissage"):
        raise HTTPException(400, f"{t} n'est pas une sous-classe de ParcoursApprentissage")
    if existe(i):
        raise HTTPException(400, f"L'identifiant {i} existe déjà")
    cours = list(dict.fromkeys(check_id(c) for c in m.cours))
    if len(cours) < 2:
        raise HTTPException(400, "Un parcours comprend au moins 2 cours différents")
    for c in cours:
        if not est_un(c, "Cours"):
            raise HTTPException(400, f"{c} n'est pas un cours")
    liens = [f"edu:{i} edu:comprendCours edu:{c} ." for c in cours]
    if m.formation:
        f = check_id(m.formation)
        if not est_un(f, "Formation"):
            raise HTTPException(400, f"{f} n'est pas une formation")
        liens.append(f"edu:{f} edu:proposeParcours edu:{i} .")
    objectif = (f"edu:{i} edu:objectifParcours {term('objectifParcours', m.objectifParcours)} ."
                if m.objectifParcours else "")
    update(f"""
        INSERT DATA {{
          edu:{i} a owl:NamedIndividual, edu:{t} ;
                  edu:nomParcours {term("nomParcours", m.nomParcours)} ;
                  edu:codeParcours {term("codeParcours", m.codeParcours)} ;
                  edu:dureeSemestres {term("dureeSemestres", m.dureeSemestres)} .
          {objectif}
          {" ".join(liens)}
        }}""")
    return {"cree": i, "type": t, "cours": cours, "formation": check_id(m.formation) if m.formation else None}


class Inscription(BaseModel):
    parcours: str | None = Field(None, examples=["Parcours_RattrapageSQL"],
                                 description="Nouveau parcours ; vide pour retirer l'étudiant de son parcours")


@router.put("/etudiants/{ident}/parcours")
def inscrire_parcours(ident: str, m: Inscription):
    """Inscrit l'étudiant à un parcours (en remplaçant l'ancien), ou le retire de son parcours."""
    e = un_etudiant(ident)
    p = un_parcours(m.parcours, 400) if m.parcours else None
    nouveau = f"edu:{e} edu:suitParcours edu:{p} ." if p else ""
    update(f"""
        DELETE {{ edu:{e} edu:suitParcours ?ancien }}
        INSERT {{ {nouveau} }}
        WHERE  {{ OPTIONAL {{ edu:{e} edu:suitParcours ?ancien }} }}""")
    return {"etudiant": e, "parcours": p}
