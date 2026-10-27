"""MEMBRE 5 — RessourcePedagogique + AgentPedagogiqueIA.

Routes :
  GET  /api/m5/ressources                         catalogue (type, durée, langue, cours)
  GET  /api/m5/ressources/libre-acces?langue=FR   libre accès, filtre de langue (FR / EN / AR)
  GET  /api/m5/ressources/courtes?max=30          durée strictement inférieure à N minutes
  GET  /api/m5/ressources/recherche?q=            CONTAINS sur le titre, l'auteur, l'URL
  GET  /api/m5/ressources/sans-cours              FILTER NOT EXISTS (aucune cours ne les utilise)
  GET  /api/m5/cours/{cours}/ressources           edu:utiliseRessource
  GET  /api/m5/statistiques                       COUNT + SUM(IF) par langue
  GET  /api/m5/etudiants/{id}/ressources-parcours chemin suitParcours/comprendCours/utiliseRessource
  GET  /api/m5/etudiants/{id}/kit-revision?max=   même chemin, libre accès et moins de N minutes
  GET  /api/m5/agents                             précision, et classe déduite AgentIAFiable
  GET  /api/m5/agents-fiables?seuil=0.9           précision ≥ seuil ET explicable
  GET  /api/m5/agents/{id}/profil                 classes affirmées / déduites (owl:equivalentClass)
  GET  /api/m5/recommandations/{etudiant}         ce que les agents recommandent
  POST /api/m5/ressources                         INSERT DATA (ressource, et lien vers un cours)
  POST /api/m5/agents                             INSERT DATA (agent, assiste, recommande)
  PUT  /api/m5/cours/{cours}/ressources           INSERT / DELETE de utiliseRessource
"""
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ..saisie import verifier_attribut
from ..store import check_id, select, term, update

router = APIRouter(prefix="/api/m5", tags=["Membre 5 · RessourcePedagogique + AgentPedagogiqueIA"])

LANGUES = ("FR", "EN", "AR")
LIBELLES_LANGUE = {"français": "FR", "anglais": "EN", "arabe": "AR"}


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


def code_langue(valeur: str) -> str:
    """FR / EN / AR, ou le libellé français utilisé par les intentions NLP."""
    if valeur in LANGUES:
        return valeur
    code = LIBELLES_LANGUE.get(valeur)
    if code is None:
        raise HTTPException(400, "Langue attendue : FR, EN, AR (ou français, anglais, arabe)")
    return code


# ======================= READ : ressources =======================

_CATALOGUE = """
    SELECT ?ressource ?type ?titre ?langue ?estLibreAcces ?auteur ?url ?dureeMinutes
           (GROUP_CONCAT(DISTINCT STRAFTER(STR(?cours), "#"); separator=", ") AS ?cours)
    WHERE {
      ?ressource a ?t ; a owl:NamedIndividual ;
                 edu:titre ?titre ; edu:langue ?langue ; edu:estLibreAcces ?estLibreAcces .
      ?t rdfs:subClassOf* edu:RessourcePedagogique .
      FILTER NOT EXISTS { ?t owl:equivalentClass ?def }
      FILTER NOT EXISTS { ?ressource a ?plus . ?plus rdfs:subClassOf ?t .
                          FILTER(?plus != ?t) FILTER NOT EXISTS { ?plus owl:equivalentClass ?d } }
      BIND(STRAFTER(STR(?t), "#") AS ?type)
      OPTIONAL { ?ressource edu:dureeMinutes ?dureeMinutes }
      OPTIONAL { ?ressource edu:auteur ?auteur }
      OPTIONAL { ?ressource edu:url ?url }
      OPTIONAL { ?cours edu:utiliseRessource ?ressource }
      /*FILTRE*/
    }
    GROUP BY ?ressource ?type ?titre ?langue ?estLibreAcces ?auteur ?url ?dureeMinutes
    ORDER BY ?dureeMinutes ?titre
"""


@router.get("/ressources")
def catalogue():
    """Toutes les ressources, avec leur type le plus précis et les cours qui les utilisent."""
    return select(_CATALOGUE.replace("/*FILTRE*/", ""))


@router.get("/ressources/libre-acces")
def ressources_libres(langue: str | None = None):
    """Ressources en libre accès, éventuellement d'une seule langue (FR, EN ou AR)."""
    filtre = f'FILTER(STR(?langue) = "{code_langue(langue)}")' if langue else ""
    return select(f"""
        SELECT DISTINCT ?ressource ?titre ?langue ?dureeMinutes ?auteur ?url WHERE {{
          ?ressource a/rdfs:subClassOf* edu:RessourcePedagogique ; a owl:NamedIndividual ;
                     edu:estLibreAcces true ; edu:langue ?langue .
          {filtre}
          OPTIONAL {{ ?ressource edu:titre ?titre }}
          OPTIONAL {{ ?ressource edu:dureeMinutes ?dureeMinutes }}
          OPTIONAL {{ ?ressource edu:auteur ?auteur }}
          OPTIONAL {{ ?ressource edu:url ?url }}
        }} ORDER BY ?langue ?titre""")


@router.get("/ressources/courtes")
def ressources_courtes(plafond: int = Query(30, alias="max", ge=0)):
    """Ressources dont la durée est strictement inférieure à N minutes."""
    return select(f"""
        SELECT ?ressource ?titre ?dureeMinutes ?langue ?estLibreAcces WHERE {{
          ?ressource a/rdfs:subClassOf* edu:RessourcePedagogique ; a owl:NamedIndividual ;
                     edu:dureeMinutes ?dureeMinutes .
          FILTER(?dureeMinutes < {int(plafond)})
          OPTIONAL {{ ?ressource edu:titre ?titre }}
          OPTIONAL {{ ?ressource edu:langue ?langue }}
          OPTIONAL {{ ?ressource edu:estLibreAcces ?estLibreAcces }}
        }} ORDER BY ?dureeMinutes ?titre""")


@router.get("/ressources/recherche")
def rechercher_ressources(q: str = ""):
    """Recherche plein texte (insensible à la casse) dans le titre, l'auteur et l'URL."""
    filtre = ""
    if q.strip():
        mot = echapper(q.strip().lower())
        filtre = f"""FILTER(
            CONTAINS(LCASE(STR(?titre)), "{mot}") ||
            CONTAINS(LCASE(STR(COALESCE(?auteur, ""))), "{mot}") ||
            CONTAINS(LCASE(STR(COALESCE(?url, ""))), "{mot}")
        )"""
    return select(_CATALOGUE.replace("/*FILTRE*/", filtre))


@router.get("/ressources/sans-cours")
def ressources_sans_cours():
    """Ressources qu'aucun cours n'utilise."""
    return select("""
        SELECT ?ressource ?titre ?langue WHERE {
          ?ressource a/rdfs:subClassOf* edu:RessourcePedagogique ; a owl:NamedIndividual .
          FILTER NOT EXISTS { ?cours edu:utiliseRessource ?ressource }
          OPTIONAL { ?ressource edu:titre ?titre }
          OPTIONAL { ?ressource edu:langue ?langue }
        } ORDER BY ?titre""")


@router.get("/cours/{cours}/ressources")
def ressources_cours(cours: str):
    """Ressources pédagogiques rattachées à un cours (utiliseRessource)."""
    c = check_id(cours)
    if not est_un(c, "Cours"):
        raise HTTPException(404, f"{c} n'est pas un cours")
    return select(f"""
        SELECT ?ressource ?titre ?langue ?dureeMinutes ?estLibreAcces ?auteur WHERE {{
          edu:{c} edu:utiliseRessource ?ressource .
          OPTIONAL {{ ?ressource edu:titre ?titre }}
          OPTIONAL {{ ?ressource edu:langue ?langue }}
          OPTIONAL {{ ?ressource edu:dureeMinutes ?dureeMinutes }}
          OPTIONAL {{ ?ressource edu:estLibreAcces ?estLibreAcces }}
          OPTIONAL {{ ?ressource edu:auteur ?auteur }}
        }} ORDER BY ?titre""")


@router.get("/statistiques")
def statistiques():
    """Par langue : nombre de ressources et nombre de ressources en libre accès."""
    return select("""
        SELECT ?langue
               (COUNT(DISTINCT ?ressource) AS ?nbRessources)
               (SUM(IF(?libre = true, 1, 0)) AS ?nbLibres)
        WHERE {
          ?ressource a/rdfs:subClassOf* edu:RessourcePedagogique ;
                     a owl:NamedIndividual ;
                     edu:langue ?langue .
          OPTIONAL { ?ressource edu:estLibreAcces ?libre }
        }
        GROUP BY ?langue
        ORDER BY DESC(?nbRessources) ?langue""")


@router.get("/etudiants/{ident}/ressources-parcours")
def ressources_parcours(ident: str):
    """Ressources des cours du parcours suivi par l'étudiant.
    Chemin de propriétés : suitParcours / comprendCours / utiliseRessource."""
    e = check_id(ident)
    if not est_un(e, "Etudiant"):
        raise HTTPException(404, f"{e} n'est pas un étudiant")
    return select(f"""
        SELECT DISTINCT ?ressource ?titre ?langue ?dureeMinutes ?estLibreAcces
                        ?cours ?intitule ?parcours ?nomParcours
        WHERE {{
          edu:{e} edu:suitParcours/edu:comprendCours/edu:utiliseRessource ?ressource .
          edu:{e} edu:suitParcours ?parcours .
          ?parcours edu:comprendCours ?cours .
          ?cours edu:utiliseRessource ?ressource .
          OPTIONAL {{ ?ressource edu:titre ?titre }}
          OPTIONAL {{ ?ressource edu:langue ?langue }}
          OPTIONAL {{ ?ressource edu:dureeMinutes ?dureeMinutes }}
          OPTIONAL {{ ?ressource edu:estLibreAcces ?estLibreAcces }}
          OPTIONAL {{ ?cours edu:intitule ?intitule }}
          OPTIONAL {{ ?parcours edu:nomParcours ?nomParcours }}
        }} ORDER BY ?cours ?titre""")


@router.get("/etudiants/{ident}/kit-revision")
def kit_revision(ident: str, plafond: int = Query(30, alias="max", ge=0)):
    """Valeur ajoutée : dans le parcours de l'étudiant, les ressources libres et courtes."""
    e = check_id(ident)
    if not est_un(e, "Etudiant"):
        raise HTTPException(404, f"{e} n'est pas un étudiant")
    return select(f"""
        SELECT DISTINCT ?ressource ?titre ?dureeMinutes ?langue ?cours ?intitule WHERE {{
          edu:{e} edu:suitParcours/edu:comprendCours/edu:utiliseRessource ?ressource .
          ?ressource edu:estLibreAcces true ; edu:dureeMinutes ?dureeMinutes .
          FILTER(?dureeMinutes < {int(plafond)})
          ?cours edu:utiliseRessource ?ressource .
          edu:{e} edu:suitParcours/edu:comprendCours ?cours .
          OPTIONAL {{ ?ressource edu:titre ?titre }}
          OPTIONAL {{ ?ressource edu:langue ?langue }}
          OPTIONAL {{ ?cours edu:intitule ?intitule }}
        }} ORDER BY ?dureeMinutes ?titre""")


# ======================= READ : agents =======================

@router.get("/agents")
def agents():
    """Agents pédagogiques, leur précision, et si HermiT les a classés AgentIAFiable."""
    return select("""
        SELECT ?agent ?type ?precision ?explicable ?modele ?fournisseur ?fiable WHERE {
          ?agent a ?t ; a owl:NamedIndividual .
          ?t rdfs:subClassOf* edu:AgentPedagogiqueIA .
          FILTER NOT EXISTS { ?t owl:equivalentClass ?def }
          FILTER NOT EXISTS { ?agent a ?plus . ?plus rdfs:subClassOf ?t .
                              FILTER(?plus != ?t) FILTER NOT EXISTS { ?plus owl:equivalentClass ?d } }
          BIND(STRAFTER(STR(?t), "#") AS ?type)
          BIND(IF(EXISTS { ?agent a edu:AgentIAFiable }, true, false) AS ?fiable)
          OPTIONAL { ?agent edu:tauxPrecision ?precision }
          OPTIONAL { ?agent edu:estExplicable ?explicable }
          OPTIONAL { ?agent edu:modeleIA ?modele }
          OPTIONAL { ?agent edu:fournisseur ?fournisseur }
        } ORDER BY DESC(?precision) ?agent""")


@router.get("/agents-fiables")
def agents_fiables(seuil: float = Query(0.9, ge=0, le=1)):
    """Agents explicables dont la précision atteint le seuil (définition d'AgentIAFiable : 0,9)."""
    return select(f"""
        SELECT ?agent ?precision ?modele WHERE {{
          ?agent a/rdfs:subClassOf* edu:AgentPedagogiqueIA ; a owl:NamedIndividual ;
                 edu:tauxPrecision ?precision ; edu:estExplicable true .
          OPTIONAL {{ ?agent edu:modeleIA ?modele }}
          FILTER(?precision >= {float(seuil)})
        }} ORDER BY DESC(?precision)""")


@router.get("/agents/{ident}/profil")
def profil_agent(ident: str):
    """Classes de l'agent. AgentIAFiable est déduite par HermiT (owl:equivalentClass)."""
    a = check_id(ident)
    if not est_un(a, "AgentPedagogiqueIA"):
        raise HTTPException(404, f"{a} n'est pas un agent pédagogique")
    return select(f"""
        SELECT ?classe ?origine ?precision ?explicable ?modele WHERE {{
          edu:{a} a ?c .
          FILTER(?c != owl:NamedIndividual && isIRI(?c))
          ?c rdfs:subClassOf* edu:AgentPedagogiqueIA .
          BIND(STRAFTER(STR(?c), "#") AS ?classe)
          BIND(IF(EXISTS {{ ?c owl:equivalentClass ?definition }}, "déduite par HermiT", "affirmée") AS ?origine)
          OPTIONAL {{ edu:{a} edu:tauxPrecision ?precision }}
          OPTIONAL {{ edu:{a} edu:estExplicable ?explicable }}
          OPTIONAL {{ edu:{a} edu:modeleIA ?modele }}
        }} ORDER BY ?origine ?classe""")


@router.get("/recommandations/{etudiant}")
def recommandations(etudiant: str):
    e = check_id(etudiant)
    if not est_un(e, "Etudiant"):
        raise HTTPException(404, f"{e} n'est pas un étudiant")
    return select(f"""
        SELECT ?agent ?recommandation WHERE {{
          ?agent edu:assiste edu:{e} ; edu:recommande ?recommandation .
        }} ORDER BY ?agent ?recommandation""")


# ======================= CREATE / UPDATE =======================

class NouvelleRessource(BaseModel):
    id: str = Field(examples=["Video_React"])
    type: str = Field(examples=["Tutoriel"])
    titre: str = Field(min_length=1, examples=["Découvrir React en 20 minutes"])
    langue: Literal["FR", "EN", "AR"] = "FR"
    estLibreAcces: bool = True
    dureeMinutes: int | None = Field(None, ge=0, examples=[20])
    auteur: str | None = None
    url: str | None = None
    cours: str | None = Field(None, description="Cours auquel rattacher la ressource (utiliseRessource)")


@router.post("/ressources", status_code=201)
def creer_ressource(m: NouvelleRessource):
    """Crée une ressource, et le lien utiliseRessource si un cours est indiqué."""
    verifier_attribut("titre", m.titre)
    verifier_attribut("langue", m.langue)
    verifier_attribut("dureeMinutes", m.dureeMinutes)
    verifier_attribut("auteur", m.auteur)
    verifier_attribut("url", m.url)
    i, t = check_id(m.id), check_id(m.type)
    if t not in sous_classes("RessourcePedagogique"):
        raise HTTPException(400, f"{t} n'est pas une sous-classe de RessourcePedagogique")
    if existe(i):
        raise HTTPException(400, f"L'identifiant {i} existe déjà")
    lien = ""
    if m.cours:
        c = check_id(m.cours)
        if not est_un(c, "Cours"):
            raise HTTPException(400, f"{c} n'est pas un cours")
        lien = f"edu:{c} edu:utiliseRessource edu:{i} ."
    extras = []
    if m.dureeMinutes is not None:
        extras.append(f"edu:{i} edu:dureeMinutes {term('dureeMinutes', m.dureeMinutes)} .")
    if m.auteur:
        extras.append(f"edu:{i} edu:auteur {term('auteur', m.auteur)} .")
    if m.url:
        extras.append(f"edu:{i} edu:url {term('url', m.url)} .")
    update(f"""
        INSERT DATA {{
          edu:{i} a owl:NamedIndividual, edu:{t} ;
                  edu:titre {term("titre", m.titre)} ;
                  edu:langue {term("langue", m.langue)} ;
                  edu:estLibreAcces {"true" if m.estLibreAcces else "false"} .
          {" ".join(extras)}
          {lien}
        }}""")
    return {"cree": i, "type": t, "cours": check_id(m.cours) if m.cours else None}


class LienRessource(BaseModel):
    ressource: str = Field(examples=["Video_IntroAngular"])
    action: Literal["ajouter", "retirer"] = "ajouter"


@router.put("/cours/{cours}/ressources")
def lier_ressource(cours: str, lien: LienRessource):
    """Ajoute ou retire une ressource utilisée par un cours."""
    c, r = check_id(cours), check_id(lien.ressource)
    if not est_un(c, "Cours"):
        raise HTTPException(404, f"{c} n'est pas un cours")
    if not est_un(r, "RessourcePedagogique"):
        raise HTTPException(400, f"{r} n'est pas une ressource pédagogique")
    deja = bool(select(f"SELECT ?x WHERE {{ edu:{c} edu:utiliseRessource ?x . FILTER(?x = edu:{r}) }} LIMIT 1"))
    if lien.action == "ajouter":
        if deja:
            raise HTTPException(400, f"{c} utilise déjà {r}")
        update(f"INSERT DATA {{ edu:{c} edu:utiliseRessource edu:{r} . }}")
    else:
        if not deja:
            raise HTTPException(400, f"{c} n'utilise pas {r}")
        update(f"DELETE DATA {{ edu:{c} edu:utiliseRessource edu:{r} . }}")
    return {"cours": c, "ressource": r, "action": lien.action}


class NouvelAgent(BaseModel):
    id: str = Field(examples=["Tuteur_React"])
    type: str = Field(examples=["TuteurConversationnel"])
    modeleIA: str = Field(min_length=1, examples=["Règles pédagogiques"])
    tauxPrecision: float = Field(ge=0, le=1, examples=[0.93])
    estExplicable: bool = True
    versionModele: str | None = None
    fournisseur: str | None = None
    etudiant: str | None = Field(None, description="Étudiant assisté (assiste)")
    recommandation: str | None = Field(None, description="Cours, ressource ou parcours recommandé")


@router.post("/agents", status_code=201)
def creer_agent(m: NouvelAgent):
    """Crée un agent. La classe AgentIAFiable n'est pas écrite : HermiT la déduit."""
    verifier_attribut("modeleIA", m.modeleIA)
    verifier_attribut("tauxPrecision", m.tauxPrecision)
    verifier_attribut("fournisseur", m.fournisseur)
    i, t = check_id(m.id), check_id(m.type)
    if t not in sous_classes("AgentPedagogiqueIA"):
        raise HTTPException(400, f"{t} n'est pas une sous-classe de AgentPedagogiqueIA")
    if t == "AgentIAFiable":
        raise HTTPException(400, "AgentIAFiable est une classe définie : elle est déduite, pas instanciée")
    if existe(i):
        raise HTTPException(400, f"L'identifiant {i} existe déjà")
    liens = []
    if m.etudiant:
        e = check_id(m.etudiant)
        if not est_un(e, "Etudiant"):
            raise HTTPException(400, f"{e} n'est pas un étudiant")
        liens.append(f"edu:{i} edu:assiste edu:{e} .")
    if m.recommandation:
        r = check_id(m.recommandation)
        if not (est_un(r, "Cours") or est_un(r, "RessourcePedagogique") or est_un(r, "ParcoursApprentissage")):
            raise HTTPException(400, f"{r} n'est ni un cours, ni une ressource, ni un parcours")
        liens.append(f"edu:{i} edu:recommande edu:{r} .")
    extras = []
    if m.versionModele:
        extras.append(f"edu:{i} edu:versionModele {term('versionModele', m.versionModele)} .")
    if m.fournisseur:
        extras.append(f"edu:{i} edu:fournisseur {term('fournisseur', m.fournisseur)} .")
    update(f"""
        INSERT DATA {{
          edu:{i} a owl:NamedIndividual, edu:{t} ;
                  edu:modeleIA {term("modeleIA", m.modeleIA)} ;
                  edu:tauxPrecision {term("tauxPrecision", m.tauxPrecision)} ;
                  edu:estExplicable {"true" if m.estExplicable else "false"} .
          {" ".join(extras)}
          {" ".join(liens)}
        }}""")
    return {"cree": i, "type": t, "etudiant": check_id(m.etudiant) if m.etudiant else None,
            "recommandation": check_id(m.recommandation) if m.recommandation else None}
