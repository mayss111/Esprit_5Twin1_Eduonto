"""CRUD générique en SPARQL, valable pour toutes les classes de l'ontologie.

Chaque membre peut s'appuyer dessus pour ses deux grandes classes, puis
ajouter ses requêtes spécifiques dans son propre fichier (membre1.py ...).
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..store import check_id, select, term, update

router = APIRouter(prefix="/api", tags=["CRUD générique"])


class Individu(BaseModel):
    id: str                       # ex. "Ahmed" (sans espace ni accent)
    classe: str                   # ex. "Etudiant"
    proprietes: dict = {}         # ex. {"nom": "Mansour", "anneeEtude": 4, "inscritA": "Ingenieur_TWIN"}


class Modification(BaseModel):
    proprietes: dict              # propriétés à remplacer


def safe(fn):
    try:
        return fn()
    except ValueError as e:
        raise HTTPException(400, str(e))


# ---------- schéma (pour construire les formulaires du front) ----------

@router.get("/classes")
def grandes_classes():
    """Les grandes classes (directement sous owl:Thing)."""
    return select("""
        SELECT ?classe WHERE {
          ?classe a owl:Class .
          FILTER NOT EXISTS { ?classe rdfs:subClassOf ?parent . ?parent a owl:Class }
          FILTER(isIRI(?classe) && STRSTARTS(STR(?classe), STR(edu:)))
        } ORDER BY ?classe""")


@router.get("/classes/{classe}/sous-classes")
def sous_classes(classe: str):
    """Toutes les sous-classes (à tous les niveaux), sans les classes définies (≡)
    puisque c'est le raisonneur qui les remplit, pas l'utilisateur."""
    return select(f"""
        SELECT DISTINCT ?sousClasse WHERE {{
          ?sousClasse rdfs:subClassOf+ edu:{check_id(classe)} .
          FILTER(isIRI(?sousClasse))
          FILTER NOT EXISTS {{ ?sousClasse owl:equivalentClass ?def }}
        }} ORDER BY ?sousClasse""")


@router.get("/classes/{classe}/proprietes")
def proprietes(classe: str):
    """Attributs et relations utilisables par cette classe (y compris hérités)."""
    c = check_id(classe)
    return select(f"""
        SELECT DISTINCT ?propriete ?genre WHERE {{
          edu:{c} rdfs:subClassOf* ?d .
          {{ ?propriete rdfs:domain ?d }} UNION
          {{ ?propriete rdfs:domain ?u . ?u owl:unionOf/rdf:rest*/rdf:first ?d }}
          ?propriete a ?type .
          VALUES (?type ?genre) {{ (owl:DatatypeProperty "attribut") (owl:ObjectProperty "relation") }}
        }} ORDER BY ?genre ?propriete""")


# ---------- READ ----------

@router.get("/classes/{classe}/individus")
def lister(classe: str, recherche: str | None = None):
    """Individus d'une classe (et de ses sous-classes). `recherche` filtre sur le nom."""
    c = check_id(classe)
    filtre = ""
    if recherche:
        mot = recherche.replace('"', "").replace("\\", "")
        filtre = f'FILTER(CONTAINS(LCASE(STR(?individu)), LCASE("{mot}")))'
    return select(f"""
        SELECT ?individu (GROUP_CONCAT(DISTINCT STRAFTER(STR(?type), "#"); separator=", ") AS ?types) WHERE {{
          ?individu a ?type . ?type rdfs:subClassOf* edu:{c} .
          ?individu a owl:NamedIndividual .
          {filtre}
        }} GROUP BY ?individu ORDER BY ?individu""")


@router.get("/individus/{ident}")
def detail(ident: str):
    i = check_id(ident)
    return select(f"""
        SELECT ?propriete ?valeur WHERE {{
          edu:{i} ?p ?valeur .
          FILTER(?p != rdf:type || isIRI(?valeur))
          BIND(?p AS ?propriete)
        }} ORDER BY ?propriete""")


# ---------- CREATE ----------

@router.post("/individus", status_code=201)
def creer(ind: Individu):
    def run():
        i, c = check_id(ind.id), check_id(ind.classe)
        if select(f"SELECT ?t WHERE {{ edu:{i} a ?t }} LIMIT 1"):
            raise ValueError(f"L'individu {i} existe déjà")
        triples = [f"edu:{i} a owl:NamedIndividual, edu:{c} ."]
        for p, v in ind.proprietes.items():
            for val in (v if isinstance(v, list) else [v]):
                triples.append(f"edu:{i} edu:{check_id(p)} {term(p, val)} .")
        update("INSERT DATA {\n  " + "\n  ".join(triples) + "\n}")
        return {"cree": i}
    return safe(run)


# ---------- UPDATE ----------

@router.put("/individus/{ident}")
def modifier(ident: str, modif: Modification):
    def run():
        i = check_id(ident)
        for p, v in modif.proprietes.items():
            p = check_id(p)
            vals = v if isinstance(v, list) else [v]
            ins = " ".join(f"edu:{i} edu:{p} {term(p, val)} ." for val in vals)
            update(f"""
                DELETE {{ edu:{i} edu:{p} ?ancienne }}
                INSERT {{ {ins} }}
                WHERE {{ OPTIONAL {{ edu:{i} edu:{p} ?ancienne }} }}""")
        return {"modifie": i}
    return safe(run)


# ---------- DELETE ----------

@router.delete("/individus/{ident}")
def supprimer(ident: str):
    def run():
        i = check_id(ident)
        update(f"DELETE WHERE {{ edu:{i} ?p ?o }}")      # ses propriétés
        update(f"DELETE WHERE {{ ?s ?p edu:{i} }}")      # les liens qui pointent vers lui
        return {"supprime": i}
    return safe(run)


# ---------- requête libre (démo) ----------

class Requete(BaseModel):
    sparql: str


@router.post("/sparql")
def requete_libre(r: Requete):
    """Exécute un SELECT écrit à la main (les préfixes edu:, rdf:, rdfs:, owl:, xsd: sont ajoutés)."""
    q = r.sparql.strip()
    if not q.upper().startswith("SELECT"):
        raise HTTPException(400, "Seules les requêtes SELECT sont autorisées ici")
    try:
        return select(q)
    except Exception as e:
        raise HTTPException(400, f"Requête invalide : {e}")
