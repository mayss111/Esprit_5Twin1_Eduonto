"""MEMBRE 1 — Personne + Formation.

Requêtes SPARQL de ce membre (CRUD, filtres, recherche, agrégats, raisonnement) :
  READ    GET  /api/m1/etudiants?annee=4                  filtre numérique sur l'année d'étude
  READ    GET  /api/m1/etudiants/{id}/formation           jointure Etudiant → Formation
  READ    GET  /api/m1/etudiants/{id}/profil              classes DÉDUITES par HermiT (owl:equivalentClass)
  READ    GET  /api/m1/boursiers?formation=               filtre booléen (estBoursier = true)
  READ    GET  /api/m1/enseignants?specialite=web         recherche CONTAINS + grade (sous-classe) + GROUP_CONCAT
  READ    GET  /api/m1/formations/{id}/etudiants          étudiants d'une formation (inscritA)
  READ    GET  /api/m1/formations/statistiques            agrégats COUNT / SUM(IF) + taux de boursiers
  READ    GET  /api/m1/encadrements                       relation et son inverse (UNION)
  CREATE  POST /api/m1/etudiants                          inscription : INSERT DATA (étudiant + inscritA)
  UPDATE  PUT  /api/m1/etudiants/{id}/encadrant           DELETE / INSERT (estEncadrePar + son inverse encadre)
  DELETE  DELETE /api/individus/{id}                      route commune (generic.py)
"""
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..store import check_id, select, update

router = APIRouter(prefix="/api/m1", tags=["Membre 1 · Personne + Formation"])


def est_un(ident: str, classe: str) -> bool:
    """Vrai si l'individu appartient à la classe (ou à une de ses sous-classes)."""
    return bool(select(f"SELECT ?t WHERE {{ edu:{ident} a ?t . ?t rdfs:subClassOf* edu:{classe} }} LIMIT 1"))


def echapper(texte: str) -> str:
    """Rend une chaîne sûre à l'intérieur de guillemets SPARQL (anti-injection)."""
    return texte.replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ")


# ======================= READ : étudiants =======================

@router.get("/etudiants")
def etudiants(annee: int | None = None):
    """Étudiants, avec un filtre optionnel sur l'année d'étude."""
    filtre = f"FILTER(?annee = {int(annee)})" if annee is not None else ""
    return select(f"""
        SELECT ?etudiant ?prenom ?nom ?annee ?formation WHERE {{
          ?etudiant a edu:Etudiant ; edu:anneeEtude ?annee .
          OPTIONAL {{ ?etudiant edu:prenom ?prenom }}
          OPTIONAL {{ ?etudiant edu:nom ?nom }}
          OPTIONAL {{ ?etudiant edu:inscritA ?formation }}
          {filtre}
        }} ORDER BY ?etudiant""")


@router.get("/etudiants/{ident}/formation")
def formation_etudiant(ident: str):
    return select(f"""
        SELECT ?formation ?intitule ?duree WHERE {{
          edu:{check_id(ident)} edu:inscritA ?formation .
          OPTIONAL {{ ?formation edu:intituleFormation ?intitule }}
          OPTIONAL {{ ?formation edu:dureeAnnees ?duree }}
        }}""")


@router.get("/etudiants/{ident}/profil")
def profil(ident: str):
    """Classes d'un étudiant : « affirmée » (écrite dans l'ontologie) ou « déduite » par le raisonneur.
    Une classe déduite est une classe définie (owl:equivalentClass), ex. EtudiantOption, EtudiantARisque."""
    e = check_id(ident)
    return select(f"""
        SELECT ?classe ?origine WHERE {{
          edu:{e} a ?c .
          FILTER(?c != owl:NamedIndividual && isIRI(?c))
          BIND(STRAFTER(STR(?c), "#") AS ?classe)
          BIND(IF(EXISTS {{ ?c owl:equivalentClass ?definition }}, "déduite par HermiT", "affirmée") AS ?origine)
        }} ORDER BY ?origine ?classe""")


@router.get("/boursiers")
def boursiers(formation: str | None = None):
    """Étudiants boursiers (attribut booléen), éventuellement d'une seule formation."""
    filtre = f"?etudiant edu:inscritA edu:{check_id(formation)} ." if formation else ""
    return select(f"""
        SELECT ?etudiant ?prenom ?nom ?formation WHERE {{
          ?etudiant edu:estBoursier true .
          OPTIONAL {{ ?etudiant edu:prenom ?prenom }}
          OPTIONAL {{ ?etudiant edu:nom ?nom }}
          OPTIONAL {{ ?etudiant edu:inscritA ?formation }}
          {filtre}
        }} ORDER BY ?nom""")


# ======================= READ : enseignants =======================

@router.get("/enseignants")
def enseignants(specialite: str | None = None):
    """Enseignants avec leur grade (sous-classe la plus précise) et les cours qu'ils enseignent.
    `specialite` : recherche plein texte (insensible à la casse) dans la spécialité."""
    filtre = ""
    if specialite:
        mot = specialite.replace('"', "").replace("\\", "").lower()
        filtre = f'FILTER(CONTAINS(LCASE(?specialite), "{mot}"))'
    return select(f"""
        SELECT ?enseignant ?prenom ?nom ?grade ?specialite ?experience
               (GROUP_CONCAT(DISTINCT STRAFTER(STR(?cours), "#"); separator=", ") AS ?coursEnseignes)
        WHERE {{
          ?enseignant a ?g . ?g rdfs:subClassOf* edu:Enseignant .
          FILTER NOT EXISTS {{ ?g owl:equivalentClass ?def }}
          FILTER NOT EXISTS {{ ?enseignant a ?plusPrecis . ?plusPrecis rdfs:subClassOf ?g .
                              FILTER(?plusPrecis != ?g) FILTER NOT EXISTS {{ ?plusPrecis owl:equivalentClass ?d }} }}
          BIND(STRAFTER(STR(?g), "#") AS ?grade)
          OPTIONAL {{ ?enseignant edu:prenom ?prenom }}
          OPTIONAL {{ ?enseignant edu:nom ?nom }}
          OPTIONAL {{ ?enseignant edu:specialite ?specialite }}
          OPTIONAL {{ ?enseignant edu:anneesExperience ?experience }}
          OPTIONAL {{ ?enseignant edu:enseigne ?cours }}
          {filtre}
        }}
        GROUP BY ?enseignant ?prenom ?nom ?grade ?specialite ?experience
        ORDER BY DESC(?experience)""")


# ======================= READ : formations =======================

@router.get("/formations/{ident}/etudiants")
def etudiants_formation(ident: str):
    """Étudiants inscrits dans une formation."""
    f = check_id(ident)
    return select(f"""
        SELECT ?etudiant ?prenom ?nom ?annee ?boursier WHERE {{
          ?etudiant edu:inscritA edu:{f} .
          OPTIONAL {{ ?etudiant edu:prenom ?prenom }}
          OPTIONAL {{ ?etudiant edu:nom ?nom }}
          OPTIONAL {{ ?etudiant edu:anneeEtude ?annee }}
          OPTIONAL {{ ?etudiant edu:estBoursier ?boursier }}
        }} ORDER BY ?annee ?nom""")


@router.get("/formations/statistiques")
def statistiques_formations():
    """Par formation : nombre d'étudiants, de boursiers, taux de boursiers et nombre de cours."""
    return select("""
        SELECT ?formation ?intitule ?nbEtudiants ?nbBoursiers ?nbCours
               (IF(?nbEtudiants > 0, ROUND(?nbBoursiers * 100 / ?nbEtudiants), 0) AS ?tauxBoursiers)
        WHERE {
          {
            SELECT ?formation (COUNT(DISTINCT ?etudiant) AS ?nbEtudiants)
                   (SUM(IF(BOUND(?boursier) && ?boursier = true, 1, 0)) AS ?nbBoursiers)
            WHERE {
              ?formation a ?t . ?t rdfs:subClassOf* edu:Formation . ?formation a owl:NamedIndividual .
              OPTIONAL { ?etudiant edu:inscritA ?formation .
                         OPTIONAL { ?etudiant edu:estBoursier ?boursier } }
            } GROUP BY ?formation
          }
          {
            SELECT ?formation (COUNT(DISTINCT ?cours) AS ?nbCours) WHERE {
              ?formation a ?t2 . ?t2 rdfs:subClassOf* edu:Formation . ?formation a owl:NamedIndividual .
              OPTIONAL { ?formation edu:contientCours ?cours }
            } GROUP BY ?formation
          }
          OPTIONAL { ?formation edu:intituleFormation ?intitule }
        } ORDER BY DESC(?nbEtudiants) ?formation""")


# ======================= CREATE : inscription =======================

class Inscription(BaseModel):
    id: str = Field(examples=["Rim"])
    prenom: str = Field(min_length=1, examples=["Rim"])
    nom: str = Field(min_length=1, examples=["Saidi"])
    email: str | None = Field(None, examples=["rim.saidi@esprit.tn"])
    formation: str = Field(examples=["Ingenieur_TWIN"])
    annee: int = Field(ge=1, le=5, examples=[4])         # même contrainte que l'ontologie : integer [1..5]
    boursier: bool = False


@router.post("/etudiants", status_code=201)
def inscrire(ins: Inscription):
    """Inscrit un nouvel étudiant dans une formation (une seule requête INSERT DATA)."""
    i, f = check_id(ins.id), check_id(ins.formation)
    if select(f"SELECT ?t WHERE {{ edu:{i} a ?t }} LIMIT 1"):
        raise HTTPException(400, f"L'identifiant {i} existe déjà")
    if not est_un(f, "Formation"):
        raise HTTPException(400, f"{f} n'est pas une formation")
    maintenant = datetime.now().replace(microsecond=0)
    numero = len(select("SELECT ?e WHERE { ?e a edu:Etudiant }")) + 1
    matricule = f"{maintenant:%y}{ins.annee}EDU{numero:04d}"
    email = f'edu:{i} edu:email "{echapper(ins.email)}" .' if ins.email else ""
    update(f"""
        INSERT DATA {{
          edu:{i} a owl:NamedIndividual, edu:Etudiant ;
                  edu:prenom "{echapper(ins.prenom)}" ;
                  edu:nom "{echapper(ins.nom)}" ;
                  edu:anneeEtude {int(ins.annee)} ;
                  edu:estBoursier {"true" if ins.boursier else "false"} ;
                  edu:matricule "{matricule}" ;
                  edu:dateInscription "{maintenant.isoformat()}"^^xsd:dateTime ;
                  edu:inscritA edu:{f} .
          {email}
        }}""")
    return {"cree": i, "matricule": matricule, "formation": f}


# ======================= UPDATE : encadrement =======================

class Encadrement(BaseModel):
    encadrant: str = Field(examples=["Prof_BenAli"])


@router.put("/etudiants/{ident}/encadrant")
def affecter_encadrant(ident: str, enc: Encadrement):
    """Affecte (ou remplace) l'encadrant d'un étudiant. Les deux sens de la relation sont mis à jour :
    estEncadrePar (étudiant → enseignant) et son inverse encadre (enseignant → étudiant)."""
    e, p = check_id(ident), check_id(enc.encadrant)
    if not est_un(e, "Etudiant"):
        raise HTTPException(400, f"{e} n'est pas un étudiant")
    if not est_un(p, "Enseignant"):
        raise HTTPException(400, f"{p} n'est pas un enseignant")
    update(f"""
        DELETE {{ edu:{e} edu:estEncadrePar ?ancien . ?ancien2 edu:encadre edu:{e} . }}
        INSERT {{ edu:{e} edu:estEncadrePar edu:{p} . edu:{p} edu:encadre edu:{e} . }}
        WHERE  {{ OPTIONAL {{ edu:{e} edu:estEncadrePar ?ancien }} OPTIONAL {{ ?ancien2 edu:encadre edu:{e} }} }}""")
    return {"etudiant": e, "encadrant": p}


@router.get("/encadrements")
def encadrements():
    """Qui encadre qui (la relation encadre et son inverse estEncadrePar, réunies par UNION)."""
    return select("""
        SELECT DISTINCT ?enseignant ?etudiant WHERE {
          { ?enseignant edu:encadre ?etudiant } UNION { ?etudiant edu:estEncadrePar ?enseignant }
        } ORDER BY ?enseignant ?etudiant""")
