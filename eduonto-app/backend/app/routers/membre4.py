"""MEMBRE 4 — Evaluation + PreuveDeCompetence.

Requêtes SPARQL de ce membre (CRUD, filtres, recherche, agrégats) :
  READ    GET  /api/m4/evaluations?noteMin=12            filtre numérique (FILTER >=)
  READ    GET  /api/m4/evaluations/session/{session}      filtre sur une énumération (Principale / Rattrapage)
  READ    GET  /api/m4/statistiques                       agrégats AVG / MIN / MAX / COUNT + GROUP BY
  READ    GET  /api/m4/moyennes-ponderees?etudiant=Ahmed  moyenne pondérée SUM(note×coef)/SUM(coef) + Admis/Ajourné
  READ    GET  /api/m4/etudiants/{etudiant}/releve        relevé de notes + mention calculée (BIND + IF)
  READ    GET  /api/m4/preuves?recherche=esprit           recherche plein texte (CONTAINS sur plusieurs champs)
  READ    GET  /api/m4/preuves-expirees                   comparaison de dates (dateExpiration < aujourd'hui)
  READ    GET  /api/m4/competences-certifiees             preuves vérifiées → compétences certifiées
  CREATE  POST /api/m4/evaluations                        INSERT DATA (évaluation + liens étudiant / cours)
  UPDATE  PUT  /api/m4/preuves/{preuve}/verifier          DELETE / INSERT (estVerifie → true)
  DELETE  DELETE /api/individus/{id}                      route commune (generic.py)
"""
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..saisie import verifier_attribut
from ..store import check_id, select, update


def est_un(ident: str, classe: str) -> bool:
    """Vrai si l'individu appartient à la classe (ou à une de ses sous-classes)."""
    return bool(select(f"SELECT ?t WHERE {{ edu:{ident} a ?t . ?t rdfs:subClassOf* edu:{classe} }} LIMIT 1"))

router = APIRouter(prefix="/api/m4", tags=["Membre 4 · Evaluation + PreuveDeCompetence"])

SESSIONS = ("Principale", "Rattrapage")
TYPES_EVALUATION = ("QCM", "DevoirSurveille", "MiniProjet", "ExposeOral", "ExamenEcrit",
                    "ExamenPratique", "ProjetIntegre", "ProjetDeFinEtudes", "SoutenanceStage", "SoutenancePFE")


# ======================= READ : évaluations =======================

@router.get("/evaluations")
def evaluations(noteMin: float | None = None):
    """Évaluations triées par note, avec un seuil minimal optionnel."""
    if noteMin is not None:
        verifier_attribut("note", noteMin)
    filtre = f"FILTER(?note >= {float(noteMin)})" if noteMin is not None else ""
    return select(f"""
        SELECT ?evaluation ?note ?session ?cours ?etudiant WHERE {{
          ?evaluation edu:note ?note .
          OPTIONAL {{ ?evaluation edu:session ?session }}
          OPTIONAL {{ ?cours edu:estEvaluePar ?evaluation }}
          OPTIONAL {{ ?etudiant edu:aPasse ?evaluation }}
          {filtre}
        }} ORDER BY DESC(?note)""")


@router.get("/evaluations/session/{session}")
def evaluations_session(session: str):
    """Évaluations d'une session (valeur de l'énumération owl:oneOf {Principale, Rattrapage})."""
    if session not in SESSIONS:
        raise HTTPException(400, f"Session inconnue : choisir parmi {SESSIONS}")
    return select(f"""
        SELECT ?evaluation ?note ?cours ?etudiant ?date WHERE {{
          ?evaluation edu:session ?s ; edu:note ?note .
          FILTER(STR(?s) = "{session}")
          OPTIONAL {{ ?evaluation edu:dateEvaluation ?date }}
          OPTIONAL {{ ?cours edu:estEvaluePar ?evaluation }}
          OPTIONAL {{ ?etudiant edu:aPasse ?evaluation }}
        }} ORDER BY ?date""")


@router.get("/statistiques")
def statistiques():
    """Statistiques des notes par cours : moyenne, minimum, maximum, nombre d'évaluations."""
    return select("""
        SELECT ?cours (COUNT(?evaluation) AS ?nbEvaluations)
               (ROUND(AVG(?note) * 100) / 100 AS ?moyenne) (MIN(?note) AS ?min) (MAX(?note) AS ?max)
        WHERE {
          ?cours edu:estEvaluePar ?evaluation .
          ?evaluation edu:note ?note .
        }
        GROUP BY ?cours
        ORDER BY DESC(?moyenne)""")


@router.get("/moyennes-ponderees")
def moyennes_ponderees(etudiant: str | None = None):
    """Moyenne pondérée par étudiant (SUM(note × coef) / SUM(coef), coef = 1 par défaut)
    et décision Admis / Ajourné calculée dans la requête (sous-requête + BIND + IF)."""
    filtre = f"VALUES ?etudiant {{ edu:{check_id(etudiant)} }}" if etudiant else ""
    return select(f"""
        SELECT ?etudiant ?moyennePonderee ?nbEvaluations ?decision WHERE {{
          {{
            SELECT ?etudiant (ROUND(SUM(?note * ?coef) / SUM(?coef) * 100) / 100 AS ?moyennePonderee)
                   (COUNT(?evaluation) AS ?nbEvaluations)
            WHERE {{
              {filtre}
              ?etudiant edu:aPasse ?evaluation .
              ?evaluation edu:note ?note .
              OPTIONAL {{ ?evaluation edu:coefficient ?coefficient }}
              BIND(COALESCE(?coefficient, 1) AS ?coef)
            }} GROUP BY ?etudiant
          }}
          BIND(IF(?moyennePonderee >= 10, "Admis", "Ajourné") AS ?decision)
        }} ORDER BY DESC(?moyennePonderee)""")


@router.get("/etudiants/{etudiant}/releve")
def releve(etudiant: str):
    """Relevé de notes d'un étudiant, avec une mention calculée dans la requête (BIND + IF)."""
    e = check_id(etudiant)
    return select(f"""
        SELECT ?evaluation ?cours ?note ?coefficient ?session ?mention WHERE {{
          edu:{e} edu:aPasse ?evaluation .
          ?evaluation edu:note ?note .
          OPTIONAL {{ ?evaluation edu:coefficient ?coefficient }}
          OPTIONAL {{ ?evaluation edu:session ?session }}
          OPTIONAL {{ ?cours edu:estEvaluePar ?evaluation }}
          BIND(IF(?note >= 16, "Très bien",
               IF(?note >= 14, "Bien",
               IF(?note >= 12, "Assez bien",
               IF(?note >= 10, "Passable", "Non validé")))) AS ?mention)
        }} ORDER BY DESC(?note)""")


# ======================= READ : preuves de compétence =======================

@router.get("/preuves")
def preuves(recherche: str | None = None):
    """Toutes les preuves ; `recherche` cherche dans l'identifiant, l'émetteur, l'étudiant et la compétence."""
    filtre = ""
    if recherche:
        mot = recherche.replace('"', "").replace("\\", "").lower()
        filtre = f"""FILTER(CONTAINS(LCASE(CONCAT(STR(?preuve), " ", COALESCE(?emetteur, ""), " ",
                                              STR(COALESCE(?etudiant, "")), " ", STR(COALESCE(?competence, "")))), "{mot}"))"""
    return select(f"""
        SELECT ?preuve ?type ?etudiant ?competence ?emetteur ?verifiee ?expiration WHERE {{
          ?preuve a ?t . ?t rdfs:subClassOf* edu:PreuveDeCompetence .
          ?preuve a owl:NamedIndividual .
          FILTER NOT EXISTS {{ ?preuve a ?autre . ?autre rdfs:subClassOf ?t . FILTER(?autre != ?t) }}
          BIND(STRAFTER(STR(?t), "#") AS ?type)
          OPTIONAL {{ ?preuve edu:delivreA ?etudiant }}
          OPTIONAL {{ ?preuve edu:atteste ?competence }}
          OPTIONAL {{ ?preuve edu:emetteur ?emetteur }}
          OPTIONAL {{ ?preuve edu:estVerifie ?verifiee }}
          OPTIONAL {{ ?preuve edu:dateExpiration ?expiration }}
          {filtre}
        }} ORDER BY ?preuve""")


def maintenant() -> str:
    """Date du jour au format xsd:dateTime, sans fuseau horaire comme les dates de l'ontologie.
    (NOW() de SPARQL renvoie une date AVEC fuseau : la comparaison serait faussée.)"""
    return datetime.now().replace(microsecond=0).isoformat()


@router.get("/preuves-expirees")
def preuves_expirees():
    """Preuves dont la date d'expiration est dépassée (comparaison avec la date du jour)."""
    return select("""
        SELECT ?preuve ?etudiant ?competence ?expiration WHERE {
          ?preuve edu:dateExpiration ?expiration .
          FILTER(?expiration < "%s"^^xsd:dateTime)
          OPTIONAL { ?preuve edu:delivreA ?etudiant }
          OPTIONAL { ?preuve edu:atteste ?competence }
        } ORDER BY ?expiration""" % maintenant())


@router.get("/competences-certifiees")
def competences_certifiees():
    """Compétences attestées par une preuve vérifiée (même logique que la classe définie CompetenceCertifiee)."""
    return select("""
        SELECT DISTINCT ?competence ?preuve ?etudiant WHERE {
          ?preuve edu:atteste ?competence ; edu:estVerifie true .
          OPTIONAL { ?preuve edu:delivreA ?etudiant }
        } ORDER BY ?competence""")


# ======================= CREATE =======================

class NouvelleEvaluation(BaseModel):
    id: str = Field(examples=["Examen_SQL_Ahmed"])
    type: str = Field("ExamenEcrit", examples=["ExamenEcrit"])
    etudiant: str = Field(examples=["Ahmed"])
    cours: str = Field(examples=["SQL"])
    note: float = Field(ge=0, le=20, examples=[13.5])
    coefficient: float = Field(1.0, gt=0, examples=[2.0])
    session: str = Field("Principale", examples=["Principale"])


@router.post("/evaluations", status_code=201)
def creer_evaluation(ev: NouvelleEvaluation):
    """Crée une évaluation et la relie à l'étudiant (aPasse) et au cours (estEvaluePar), en une seule requête."""
    verifier_attribut("note", ev.note)
    verifier_attribut("coefficient", ev.coefficient)
    verifier_attribut("session", ev.session)
    i, etu, cours = check_id(ev.id), check_id(ev.etudiant), check_id(ev.cours)
    if ev.type not in TYPES_EVALUATION:
        raise HTTPException(400, f"Type inconnu : choisir parmi {TYPES_EVALUATION}")
    if ev.session not in SESSIONS:
        raise HTTPException(400, f"Session inconnue : choisir parmi {SESSIONS}")
    if select(f"SELECT ?t WHERE {{ edu:{i} a ?t }} LIMIT 1"):
        raise HTTPException(400, f"L'évaluation {i} existe déjà")
    if not est_un(etu, "Etudiant"):
        raise HTTPException(400, f"{etu} n'est pas un étudiant")
    if not est_un(cours, "Cours"):
        raise HTTPException(400, f"{cours} n'est pas un cours")
    date = maintenant()
    update(f"""
        INSERT DATA {{
          edu:{i} a owl:NamedIndividual, edu:{ev.type} ;
                  edu:note "{ev.note}"^^xsd:decimal ;
                  edu:coefficient "{ev.coefficient}"^^xsd:decimal ;
                  edu:session "{ev.session}" ;
                  edu:dateEvaluation "{date}"^^xsd:dateTime .
          edu:{etu} edu:aPasse edu:{i} .
          edu:{cours} edu:estEvaluePar edu:{i} .
        }}""")
    return {"cree": i, "etudiant": etu, "cours": cours}


# ======================= UPDATE =======================

@router.put("/preuves/{preuve}/verifier")
def verifier_preuve(preuve: str):
    """Marque une preuve comme vérifiée : sa compétence devient alors « certifiée »."""
    p = check_id(preuve)
    if not est_un(p, "PreuveDeCompetence"):
        raise HTTPException(404, f"{p} n'est pas une preuve de compétence")
    update(f"""
        DELETE {{ edu:{p} edu:estVerifie ?ancien }}
        INSERT {{ edu:{p} edu:estVerifie true }}
        WHERE  {{ OPTIONAL {{ edu:{p} edu:estVerifie ?ancien }} }}""")
    return {"verifiee": p}
