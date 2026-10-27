"""Tests de l'API (fastapi.testclient). Lancement depuis le dossier backend :
    python -m pytest tests -q
Les créations / modifications sont annulées à la fin, mais écrivent ontology/EduOnto_runtime.ttl :
cliquer « Réinitialiser les données » (ou supprimer ce fichier) après les tests.
"""
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.main import app   # noqa: E402

client = TestClient(app)

# Toutes les routes GET des membres 1 à 4 (paramètres de chemin remplis avec des individus existants)
ROUTES_GET = [
    "/api/m1/etudiants", "/api/m1/etudiants?annee=4", "/api/m1/etudiants/Ahmed/formation",
    "/api/m1/etudiants/Ahmed/profil", "/api/m1/boursiers", "/api/m1/enseignants?specialite=web",
    "/api/m1/formations/Ingenieur_TWIN/etudiants", "/api/m1/formations/statistiques", "/api/m1/encadrements",
    "/api/m2/cours", "/api/m2/cours?domaine=GenieLogiciel", "/api/m2/cours/niveau/Avancé", "/api/m2/cours/credits?min=4",
    "/api/m2/cours/Angular/prerequis", "/api/m2/cours/JavaScript/suite", "/api/m2/recherche?q=web",
    "/api/m2/domaines/statistiques", "/api/m2/etudiants/Ahmed/peut-suivre/Angular",
    "/api/m3/metiers/DeveloppeurFullStack/competences", "/api/m3/etudiants/Ahmed/competences-manquantes",
    "/api/m3/etudiants/Ahmed/recommandations-competences", "/api/m3/metiers-en-tension",
    "/api/m3/competences/DeveloppementFrontend/cours", "/api/m3/metiers/niveau-etudes?niveau=Master",
    "/api/m3/statistiques-metiers",
    "/api/m4/evaluations", "/api/m4/evaluations?noteMin=12", "/api/m4/evaluations/session/Principale",
    "/api/m4/statistiques", "/api/m4/moyennes-ponderees", "/api/m4/moyennes-ponderees?etudiant=Ahmed",
    "/api/m4/etudiants/Ahmed/releve", "/api/m4/preuves", "/api/m4/preuves?recherche=esprit",
    "/api/m4/preuves-expirees", "/api/m4/competences-certifiees",
]


@pytest.mark.parametrize("url", ROUTES_GET)
def test_routes_get(url):
    r = client.get(url)
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)


def test_niveau_master_renvoie_ingenieur_ia():
    rows = client.get("/api/m3/metiers/niveau-etudes", params={"niveau": "Master"}).json()
    assert "IngenieurIA" in [r["metier"] for r in rows]
    assert all(r["niveauEtudesRequis"] == "Master" for r in rows)


def test_statistiques_metiers():
    rows = client.get("/api/m3/statistiques-metiers").json()
    fullstack = next(r for r in rows if r["metier"] == "DeveloppeurFullStack")
    assert fullstack["nbCompetences"] >= 1 and fullstack["nbEtudiants"] == 2
    assert [r["nbCompetences"] for r in rows] == sorted((r["nbCompetences"] for r in rows), reverse=True)


def test_creation_modification_suppression_metier():
    metier = {"id": "Metier_Test_Auto", "type": "MetierInfrastructure", "intituleMetier": "Ingénieur \"cloud\"",
              "codeISCO": "2523", "niveauEtudesRequis": "Master", "estEnTension": True,
              "competences": ["GestionDonnees", "MethodeAgile"]}
    try:
        r = client.post("/api/m3/metiers", json=metier)
        assert r.status_code == 201, r.text
        assert client.post("/api/m3/metiers", json=metier).status_code == 400            # identifiant déjà pris
        ids = [x["metier"] for x in client.get("/api/m3/metiers/niveau-etudes?niveau=Master").json()]
        assert "Metier_Test_Auto" in ids

        def competences():
            return {x["competence"] for x in client.get("/api/m3/metiers/Metier_Test_Auto/competences").json()}
        assert competences() == {"GestionDonnees", "MethodeAgile"}

        url = "/api/m3/metiers/Metier_Test_Auto/competences"
        assert client.put(url, json={"competence": "MachineLearning", "action": "ajouter"}).status_code == 200
        assert "MachineLearning" in competences()
        assert client.put(url, json={"competence": "MachineLearning", "action": "ajouter"}).status_code == 400
        assert client.put(url, json={"competence": "MachineLearning", "action": "retirer"}).status_code == 200
        assert "MachineLearning" not in competences()
        assert client.put(url, json={"competence": "Ahmed", "action": "ajouter"}).status_code == 400   # pas une compétence
    finally:
        assert client.delete("/api/individus/Metier_Test_Auto").status_code == 200
    assert client.get("/api/m3/metiers/Metier_Test_Auto/competences").json() == []


@pytest.mark.parametrize("metier", [
    {"type": "Etudiant"},                       # pas une sous-classe de Metier
    {"competences": ["Ahmed"]},                 # pas une compétence
    {"id": "x} ; DROP"},                        # identifiant refusé par check_id
])
def test_creation_metier_refusee(metier):
    base = {"id": "Metier_Refuse", "type": "MetierData", "intituleMetier": "X", "niveauEtudesRequis": "Licence"}
    assert client.post("/api/m3/metiers", json={**base, **metier}).status_code == 400


# Non-régression NLP (D2)
@pytest.mark.parametrize("question, intention", [
    ("Quelle est la formation d'Ahmed ?", "formation_etudiant"),
    ("Quels sont les prérequis d'Angular ?", "prerequis_cours"),
    ("Quelles compétences manquent à Ahmed ?", "competences_manquantes"),
    ("Quelle est la moyenne d'Ahmed ?", "moyenne_etudiant"),
    ("Quels badges a obtenu Sarra ?", "preuves_etudiant"),
    ("Ahmed peut-il suivre Angular ?", "prerequis_manquants"),
    ("Qui enseigne JavaScript ?", "enseignant_cours"),
    ("Quelles évaluations ont une note inférieure à 10 ?", "evaluations_note"),
    ("Quels métiers peut viser un étudiant de niveau Master ?", "metiers_niveau"),
    ("Combien de compétences demande chaque métier ?", "nb_competences_metier"),
])
def test_non_regression_nlp(question, intention):
    r = client.post("/api/ask", json={"question": question}).json()
    assert r["intention"] == intention, r
    assert "erreur" not in r


def test_ask_fautes_contexte_et_securite():
    r = client.post("/api/ask", json={"question": "Qui enseigne Angulr ?"}).json()
    assert r["parametres"] == {"cours": "Angular"}
    assert any(e.get("correction") == "Angulr → Angular" for e in r["entites"])
    r = client.post("/api/ask", json={"question": "Quelles évaluations ont une note inférieure à 10 ?"}).json()
    assert r["parametres"]["op"] == "<" and all(x["note"] < 10 for x in r["resultats"])
    r = client.post("/api/ask", json={"question": "Et ses badges ?", "contexte": r["contexte"] + [{"id": "Sarra"}]}).json()
    assert r["intention"] == "preuves_etudiant" and r["parametres_du_contexte"] == {"etudiant": "Sarra"}
    r = client.post("/api/ask", json={"question": "Et ses notes ?", "contexte": [{"id": "x} . DROP"}]}).json()
    assert r["intention"] is None                                      # identifiant invalide ignoré
    from app.routers.nlp import verifier_select
    with pytest.raises(ValueError):
        verifier_select("DELETE WHERE { ?s ?p ?o }")
