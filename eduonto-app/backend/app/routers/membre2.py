"""MEMBRE 2 — Cours + Domaine.

Requêtes SPARQL de ce membre (CRUD, filtres, recherche, agrégats, chemins de propriétés) :
  READ    GET  /api/m2/cours?domaine=GenieLogiciel             cours d'une classe de domaine (et sous-domaines)
  READ    GET  /api/m2/cours/{id}/prerequis                   prérequis directs ET indirects (aPourPrerequis+)
  READ    GET  /api/m2/cours/{id}/suite                       cours accessibles ensuite (estPrerequisDe+)
  READ    GET  /api/m2/cours/niveau/{niveau}                  filtre sur l'énumération (Débutant / Intermédiaire / Avancé)
  READ    GET  /api/m2/cours/credits?min=4                    filtre numérique + tri
  READ    GET  /api/m2/recherche?q=web                        recherche plein texte (intitulé, code, mots-clés du domaine)
  READ    GET  /api/m2/domaines/statistiques                  agrégats COUNT / SUM / AVG par classe de domaine
  READ    GET  /api/m2/etudiants/{e}/peut-suivre/{cours}      prérequis non validés (FILTER NOT EXISTS)
  CREATE  POST /api/m2/cours                                  INSERT DATA (cours + domaine + prérequis + inverses)
  UPDATE  PUT  /api/m2/cours/{id}/prerequis                   ajout d'un prérequis avec détection de cycle
  DELETE  DELETE /api/individus/{id}                          route commune (generic.py)
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..store import check_id, select, update

router = APIRouter(prefix="/api/m2", tags=["Membre 2 · Cours + Domaine"])

NIVEAUX = ("Débutant", "Intermédiaire", "Avancé")
TYPES_COURS = ("CoursFondamental", "CoursDeSpecialite", "CoursTransversal", "OptionTechnique", "OptionLibre")


def est_un(ident: str, classe: str) -> bool:
    """Vrai si l'individu appartient à la classe (ou à une de ses sous-classes)."""
    return bool(select(f"SELECT ?t WHERE {{ edu:{ident} a ?t . ?t rdfs:subClassOf* edu:{classe} }} LIMIT 1"))


def echapper(texte: str) -> str:
    """Rend une chaîne sûre à l'intérieur de guillemets SPARQL (anti-injection)."""
    return texte.replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ")


# ======================= READ : cours =======================

@router.get("/cours")
def cours(domaine: str | None = None):
    """Cours, éventuellement d'une classe de domaine (ex. GenieLogiciel inclut DeveloppementWeb…)."""
    filtre = f"?domaine a/rdfs:subClassOf* edu:{check_id(domaine)} ." if domaine else ""
    return select(f"""
        SELECT DISTINCT ?cours ?intitule ?credits ?niveau ?domaine WHERE {{
          ?cours a/rdfs:subClassOf* edu:Cours ; a owl:NamedIndividual .
          OPTIONAL {{ ?cours edu:intitule ?intitule }}
          OPTIONAL {{ ?cours edu:nbCredits ?credits }}
          OPTIONAL {{ ?cours edu:niveau ?niveau }}
          ?cours edu:appartientADomaine ?domaine .
          {filtre}
        }} ORDER BY ?cours""")


@router.get("/cours/niveau/{niveau}")
def cours_niveau(niveau: str):
    """Cours d'un niveau (valeur de l'énumération owl:oneOf de l'attribut niveau)."""
    if niveau not in NIVEAUX:
        raise HTTPException(400, f"Niveau inconnu : choisir parmi {NIVEAUX}")
    return select(f"""
        SELECT ?cours ?intitule ?semestre ?credits WHERE {{
          ?cours edu:niveau ?n .
          FILTER(STR(?n) = "{niveau}")
          OPTIONAL {{ ?cours edu:intitule ?intitule }}
          OPTIONAL {{ ?cours edu:semestre ?semestre }}
          OPTIONAL {{ ?cours edu:nbCredits ?credits }}
        }} ORDER BY ?semestre""")


@router.get("/cours/credits")
def cours_credits(min: int = 4):
    """Cours d'au moins N crédits, du plus lourd au plus léger."""
    return select(f"""
        SELECT ?cours ?intitule ?credits ?volumeHoraire WHERE {{
          ?cours edu:nbCredits ?credits .
          FILTER(?credits >= {int(min)})
          OPTIONAL {{ ?cours edu:intitule ?intitule }}
          OPTIONAL {{ ?cours edu:volumeHoraire ?volumeHoraire }}
        }} ORDER BY DESC(?credits) ?cours""")


@router.get("/cours/{ident}/prerequis")
def prerequis(ident: str):
    """Tous les prérequis d'un cours, directs et indirects (aPourPrerequis est transitive),
    triés par semestre : c'est l'ordre dans lequel il faut les suivre."""
    return select(f"""
        SELECT DISTINCT ?prerequis ?intitule ?semestre WHERE {{
          edu:{check_id(ident)} edu:aPourPrerequis+ ?prerequis .
          OPTIONAL {{ ?prerequis edu:intitule ?intitule }}
          OPTIONAL {{ ?prerequis edu:semestre ?semestre }}
        }} ORDER BY ?semestre ?prerequis""")


@router.get("/cours/{ident}/suite")
def suite(ident: str):
    """Cours qu'un cours permet de suivre ensuite (relation inverse estPrerequisDe, transitive)."""
    return select(f"""
        SELECT DISTINCT ?coursSuivant ?intitule ?semestre WHERE {{
          {{ edu:{check_id(ident)} edu:estPrerequisDe+ ?coursSuivant }}
          UNION
          {{ ?coursSuivant edu:aPourPrerequis+ edu:{check_id(ident)} }}
          OPTIONAL {{ ?coursSuivant edu:intitule ?intitule }}
          OPTIONAL {{ ?coursSuivant edu:semestre ?semestre }}
        }} ORDER BY ?semestre ?coursSuivant""")


@router.get("/recherche")
def recherche(q: str):
    """Recherche d'un mot dans l'intitulé, le code du cours, le libellé et les mots-clés de son domaine."""
    mot = q.replace('"', "").replace("\\", "").lower().strip()
    if not mot:
        raise HTTPException(400, "Mot de recherche vide")
    return select(f"""
        SELECT ?cours ?intitule ?code ?domaine
               (GROUP_CONCAT(DISTINCT ?motCle; separator=", ") AS ?motsCles)
        WHERE {{
          ?cours edu:appartientADomaine ?domaine .
          OPTIONAL {{ ?cours edu:intitule ?intitule }}
          OPTIONAL {{ ?cours edu:codeCours ?code }}
          OPTIONAL {{ ?domaine edu:libelleDomaine ?libelle }}
          OPTIONAL {{ ?domaine edu:motsCles ?motCle }}
          FILTER(CONTAINS(LCASE(STR(COALESCE(?intitule, ""))), "{mot}")
              || CONTAINS(LCASE(STR(COALESCE(?code, ""))), "{mot}")
              || CONTAINS(LCASE(STR(COALESCE(?libelle, ""))), "{mot}")
              || EXISTS {{ ?domaine edu:motsCles ?m . FILTER(CONTAINS(LCASE(STR(?m)), "{mot}")) }})
        }}
        GROUP BY ?cours ?intitule ?code ?domaine
        ORDER BY ?cours""")


# ======================= READ : domaines =======================

@router.get("/domaines/statistiques")
def statistiques_domaines():
    """Par grande classe de domaine (DomaineInformatique, DomaineMathematiques…) :
    nombre de cours, total de crédits, volume horaire total et moyen."""
    return select("""
        SELECT ?grandDomaine (COUNT(DISTINCT ?cours) AS ?nbCours) (SUM(?credits) AS ?totalCredits)
               (SUM(?heures) AS ?volumeHoraire) (ROUND(AVG(?heures)) AS ?heuresMoyennes)
        WHERE {
          ?grand rdfs:subClassOf edu:Domaine .
          FILTER NOT EXISTS { ?grand owl:equivalentClass ?def }
          ?domaine a ?t . ?t rdfs:subClassOf* ?grand .
          ?cours edu:appartientADomaine ?domaine .
          OPTIONAL { ?cours edu:nbCredits ?credits }
          OPTIONAL { ?cours edu:volumeHoraire ?heures }
          BIND(STRAFTER(STR(?grand), "#") AS ?grandDomaine)
        }
        GROUP BY ?grandDomaine
        ORDER BY DESC(?nbCours)""")


# ======================= READ : aide à l'inscription =======================

@router.get("/etudiants/{etudiant}/peut-suivre/{cours}")
def peut_suivre(etudiant: str, cours: str):
    """Prérequis (directs et indirects) d'un cours que l'étudiant n'a PAS encore validés.
    Résultat vide = l'étudiant peut s'inscrire au cours."""
    e, c = check_id(etudiant), check_id(cours)
    return select(f"""
        SELECT DISTINCT ?prerequisManquant ?intitule ?semestre WHERE {{
          edu:{c} edu:aPourPrerequis+ ?prerequisManquant .
          FILTER NOT EXISTS {{ edu:{e} edu:aValide ?prerequisManquant }}
          OPTIONAL {{ ?prerequisManquant edu:intitule ?intitule }}
          OPTIONAL {{ ?prerequisManquant edu:semestre ?semestre }}
        }} ORDER BY ?semestre""")


# ======================= CREATE =======================

class NouveauCours(BaseModel):
    id: str = Field(examples=["React"])
    type: str = Field("CoursDeSpecialite", examples=["OptionTechnique"])
    intitule: str = Field(min_length=1, examples=["Framework React"])
    code: str | None = Field(None, examples=["WEB302"])
    domaine: str = Field(examples=["DeveloppementWeb"])
    credits: int = Field(ge=1, le=10, examples=[4])          # même contrainte que l'ontologie : [1..10]
    volumeHoraire: int = Field(42, gt=0, examples=[42])
    niveau: str = Field("Intermédiaire", examples=["Avancé"])
    semestre: int = Field(ge=1, le=10, examples=[8])
    prerequis: list[str] = Field(default_factory=list, examples=[["JavaScript"]])


@router.post("/cours", status_code=201)
def creer_cours(c: NouveauCours):
    """Crée un cours, le relie à son domaine et à ses prérequis. Les deux sens de la relation
    de prérequis sont écrits (aPourPrerequis et son inverse estPrerequisDe)."""
    i, d = check_id(c.id), check_id(c.domaine)
    if c.type not in TYPES_COURS:
        raise HTTPException(400, f"Type inconnu : choisir parmi {TYPES_COURS}")
    if c.niveau not in NIVEAUX:
        raise HTTPException(400, f"Niveau inconnu : choisir parmi {NIVEAUX}")
    if select(f"SELECT ?t WHERE {{ edu:{i} a ?t }} LIMIT 1"):
        raise HTTPException(400, f"Le cours {i} existe déjà")
    if not est_un(d, "Domaine"):
        raise HTTPException(400, f"{d} n'est pas un domaine")
    liens = []
    for p in c.prerequis:
        p = check_id(p)
        if not est_un(p, "Cours"):
            raise HTTPException(400, f"{p} n'est pas un cours")
        liens.append(f"edu:{i} edu:aPourPrerequis edu:{p} . edu:{p} edu:estPrerequisDe edu:{i} .")
    code = f'edu:{i} edu:codeCours "{echapper(c.code)}" .' if c.code else ""
    update(f"""
        INSERT DATA {{
          edu:{i} a owl:NamedIndividual, edu:{c.type} ;
                  edu:intitule "{echapper(c.intitule)}" ;
                  edu:nbCredits {int(c.credits)} ;
                  edu:volumeHoraire {int(c.volumeHoraire)} ;
                  edu:niveau "{c.niveau}" ;
                  edu:semestre {int(c.semestre)} ;
                  edu:appartientADomaine edu:{d} .
          {code}
          {" ".join(liens)}
        }}""")
    return {"cree": i, "domaine": d, "prerequis": c.prerequis}


# ======================= UPDATE =======================

class AjoutPrerequis(BaseModel):
    prerequis: str = Field(examples=["TypeScript"])


@router.put("/cours/{ident}/prerequis")
def ajouter_prerequis(ident: str, a: AjoutPrerequis):
    """Ajoute un prérequis à un cours, en refusant les cycles : si B dépend déjà (même indirectement)
    de A, alors A ne peut pas devenir un prérequis de… A lui-même via B."""
    c, p = check_id(ident), check_id(a.prerequis)
    if c == p:
        raise HTTPException(400, "Un cours ne peut pas être son propre prérequis")
    for x in (c, p):
        if not est_un(x, "Cours"):
            raise HTTPException(400, f"{x} n'est pas un cours")
    # Cycle : le futur prérequis dépend-il déjà du cours ? (chemin aPourPrerequis+)
    if select(f"SELECT ?x WHERE {{ edu:{p} edu:aPourPrerequis+ ?x . FILTER(?x = edu:{c}) }} LIMIT 1"):
        raise HTTPException(400, f"Cycle refusé : {p} a déjà {c} parmi ses prérequis")
    update(f"""
        INSERT DATA {{ edu:{c} edu:aPourPrerequis edu:{p} . edu:{p} edu:estPrerequisDe edu:{c} . }}""")
    return {"cours": c, "prerequisAjoute": p}
