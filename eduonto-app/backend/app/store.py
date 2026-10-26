"""Accès à l'ontologie : chargement du graphe RDF et exécution des requêtes SPARQL.

Toutes les opérations (lecture, ajout, modification, suppression) passent par
SPARQL 1.1 (SELECT / INSERT / DELETE), exécuté par rdflib.
"""
import logging
import re
from contextvars import ContextVar
from pathlib import Path
from threading import RLock

from rdflib import Graph, Literal, URIRef
from rdflib.namespace import OWL, RDF, RDFS, XSD

NS = "http://www.esprit.tn/ontologies/eduonto#"
PREFIXES = f"""
PREFIX edu: <{NS}>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
"""

ONTO_DIR = Path(__file__).resolve().parents[2] / "ontology"
RUNTIME = ONTO_DIR / "EduOnto_runtime.ttl"     # état modifié par l'application
INFERRED = ONTO_DIR / "EduOnto_inferred.owl"   # ontologie + déductions HermiT
BASE = ONTO_DIR / "EduOnto.owl"                # ontologie d'origine (Protégé)

_ID = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_lock = RLock()   # rdflib n'est pas thread-safe : une requête à la fois
graph = Graph()
log = logging.getLogger("eduonto.store")

# Abonnés appelés après chaque modification du graphe (ex. : reconstruire le lexique NLP)
_abonnes = []

# Journal des requêtes SPARQL exécutées pendant la requête HTTP en cours.
# On stocke une LISTE (objet mutable) : les ajouts faits dans le threadpool de FastAPI
# (copie du contexte) restent visibles par le middleware qui a créé la liste.
journal_sparql: ContextVar = ContextVar("journal_sparql", default=None)


def on_change(fn):
    """Abonne une fonction, appelée sans argument après chaque update() et load()."""
    _abonnes.append(fn)
    return fn


def _notifier():
    """Prévient les abonnés ; une erreur d'abonné est loguée mais ne fait pas échouer la requête."""
    jeton = journal_sparql.set(None)     # leurs requêtes internes ne doivent pas apparaître dans X-Sparql
    try:
        for fn in list(_abonnes):
            try:
                fn()
            except Exception:
                log.exception("Erreur dans l'abonné %r", fn)
    finally:
        journal_sparql.reset(jeton)


def _journaliser(query: str):
    journal = journal_sparql.get()
    if journal is not None:
        journal.append(query.strip())


def load():
    """Charge la version la plus récente disponible de l'ontologie."""
    with _lock:
        graph.remove((None, None, None))
        for path in (RUNTIME, INFERRED, BASE):
            if path.exists():
                graph.parse(str(path), format="turtle" if path.suffix == ".ttl" else "xml")
                _notifier()
                return path.name
    raise FileNotFoundError("Aucun fichier d'ontologie trouvé dans le dossier ontology/")


def check_id(name: str) -> str:
    """Refuse tout identifiant qui pourrait casser la requête SPARQL."""
    if not _ID.match(name or ""):
        raise ValueError(f"Identifiant invalide : {name!r}")
    return name


def local(value):
    """Transforme une valeur rdflib en valeur JSON lisible."""
    if isinstance(value, URIRef):
        s = str(value)
        return s.split("#", 1)[1] if "#" in s else s
    if isinstance(value, Literal):
        return value.toPython() if not isinstance(value.toPython(), Literal) else str(value)
    return str(value) if value is not None else None


def select(query: str) -> list[dict]:
    """Exécute un SELECT et renvoie une liste de dictionnaires {variable: valeur}."""
    with _lock:
        _journaliser(query)
        res = graph.query(PREFIXES + query)
        return [{str(k): local(row[k]) for k in res.vars if row[k] is not None} for row in res]


def update(query: str):
    """Exécute un INSERT / DELETE puis sauvegarde l'état."""
    with _lock:
        _journaliser(query)
        graph.update(PREFIXES + query)
        graph.serialize(str(RUNTIME), format="turtle")
        _notifier()


# ---------- outils pour construire des requêtes sûres ----------

def property_kind(prop: str):
    """Renvoie ('data', datatype) ou ('object', None) pour une propriété."""
    p = URIRef(NS + check_id(prop))
    if (p, RDF.type, OWL.ObjectProperty) in graph:
        return "object", None
    if (p, RDF.type, OWL.DatatypeProperty) in graph:
        rng = graph.value(p, RDFS.range)
        if rng is None:
            return "data", XSD.string
        if isinstance(rng, URIRef):
            return "data", rng
        base = graph.value(rng, OWL.onDatatype)          # intervalle (ex. integer [1..5])
        return "data", base if base is not None else XSD.string  # énumération -> string
    raise ValueError(f"Propriété inconnue : {prop}")


def term(prop: str, value) -> str:
    """Écrit une valeur en syntaxe SPARQL selon le type de la propriété."""
    kind, dt = property_kind(prop)
    if kind == "object":
        return f"edu:{check_id(str(value))}"
    if dt == XSD.boolean:
        value = str(value).lower() in ("true", "1", "oui", "vrai")
    return Literal(value, datatype=dt).n3()
