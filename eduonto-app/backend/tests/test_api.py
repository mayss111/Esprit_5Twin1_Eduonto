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
    "/api/m5/ressources", "/api/m5/ressources/libre-acces", "/api/m5/ressources/libre-acces?langue=FR",
    "/api/m5/ressources/courtes?max=30", "/api/m5/ressources/recherche?q=angular", "/api/m5/ressources/sans-cours",
    "/api/m5/cours/Angular/ressources", "/api/m5/statistiques",
    "/api/m5/etudiants/Ahmed/ressources-parcours", "/api/m5/etudiants/Ahmed/kit-revision?max=30",
    "/api/m5/agents", "/api/m5/agents-fiables", "/api/m5/agents-fiables?seuil=0.9",
    "/api/m5/agents/Tuteur_EduBot/profil", "/api/m5/recommandations/Omar",
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
    base = {"id": "Metier_Refuse", "type": "MetierData", "intituleMetier": "Métier refusé", "niveauEtudesRequis": "Licence"}
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
    ("Combien d'étudiants sont inscrits en TWIN ?", "nb_etudiants_formation"),
    ("Combien d'étudiants par formation ?", "nb_etudiants_par_formation"),
    ("Qui suit le tronc commun ?", "etudiants_formation"),
    ("Quels sont les prérequis d'Angulr ?", "prerequis_cours"),
    ("Quels agents IA sont fiables ?", "agents_fiables"),
    ("Que recommande-t-on à Omar ?", "recommandations_etudiant"),
    ("Quelles ressources sont en libre accès ?", "ressources_libres"),
    ("Quelles ressources en français sont en libre accès ?", "ressources_libres_langue"),
    ("Quelles ressources utilise le cours Angular ?", "ressources_cours"),
    ("Ressources de moins de 30 minutes", "ressources_courtes"),
    ("Quelles ressources du parcours d'Ahmed ?", "ressources_parcours_etudiant"),
])
def test_non_regression_nlp(question, intention):
    r = client.post("/api/ask", json={"question": question}).json()
    assert r["intention"] == intention, r
    assert "erreur" not in r


def test_m5_requetes():
    libres = client.get("/api/m5/ressources/libre-acces", params={"langue": "FR"}).json()
    ids = {r["ressource"] for r in libres}
    assert {"Video_IntroAngular", "Support_WebSemantique"} <= ids
    assert "TD_SQL" not in ids and "Protege" not in ids
    assert all(r["langue"] == "FR" for r in libres)

    courtes = client.get("/api/m5/ressources/courtes", params={"max": 30}).json()
    assert {r["ressource"] for r in courtes} == {"Video_IntroAngular"}
    assert all(r["dureeMinutes"] < 30 for r in courtes)

    angular = {r["ressource"] for r in client.get("/api/m5/cours/Angular/ressources").json()}
    assert angular == {"Video_IntroAngular"}
    ws = {r["ressource"] for r in client.get("/api/m5/cours/WebSemantique/ressources").json()}
    assert ws == {"Support_WebSemantique", "Protege"}

    kit = {r["ressource"] for r in client.get("/api/m5/etudiants/Ahmed/kit-revision", params={"max": 30}).json()}
    assert kit == {"Video_IntroAngular"}
    parcours = {r["ressource"] for r in client.get("/api/m5/etudiants/Ahmed/ressources-parcours").json()}
    assert {"Video_IntroAngular", "TD_SQL"} <= parcours

    fiables = {r["agent"] for r in client.get("/api/m5/agents-fiables").json()}
    assert fiables == {"Tuteur_EduBot", "Moteur_Reco"}
    profil = client.get("/api/m5/agents/Tuteur_EduBot/profil").json()
    deduite = next(r for r in profil if r["classe"] == "AgentIAFiable")
    assert deduite["origine"] == "déduite par HermiT"
    stats = {r["langue"]: r for r in client.get("/api/m5/statistiques").json()}
    assert stats["FR"]["nbRessources"] == 3 and stats["EN"]["nbRessources"] == 1


def test_m5_creation_ressource_et_agent():
    ressource = {"id": "Video_Test_M5", "type": "Tutoriel", "titre": "Tutoriel \"test\"",
                 "langue": "EN", "estLibreAcces": True, "dureeMinutes": 12,
                 "auteur": "Membre 5", "url": "https://exemple.test/video", "cours": "JavaScript"}
    agent = {"id": "Agent_Test_M5", "type": "TuteurConversationnel", "modeleIA": "Règles",
             "tauxPrecision": 0.91, "estExplicable": True, "fournisseur": "Membre 5",
             "etudiant": "Lina", "recommandation": "Video_Test_M5"}
    try:
        r = client.post("/api/m5/ressources", json=ressource)
        assert r.status_code == 201, r.text
        assert client.post("/api/m5/ressources", json=ressource).status_code == 400
        assert "Video_Test_M5" in {x["ressource"] for x in client.get("/api/m5/cours/JavaScript/ressources").json()}
        assert "Video_Test_M5" in {x["ressource"] for x in client.get("/api/m5/ressources/courtes?max=15").json()}
        assert "Video_Test_M5" in {x["ressource"] for x in client.get("/api/m5/ressources/libre-acces?langue=EN").json()}
        trouvees = client.get("/api/m5/ressources/recherche", params={"q": "exemple.test"}).json()
        assert "Video_Test_M5" in {x["ressource"] for x in trouvees}

        url = "/api/m5/cours/JavaScript/ressources"
        assert client.put(url, json={"ressource": "Video_Test_M5", "action": "retirer"}).status_code == 200
        assert "Video_Test_M5" not in {x["ressource"] for x in client.get(url).json()}
        assert "Video_Test_M5" in {x["ressource"] for x in client.get("/api/m5/ressources/sans-cours").json()}
        assert client.put(url, json={"ressource": "Video_Test_M5", "action": "retirer"}).status_code == 400

        a = client.post("/api/m5/agents", json=agent)
        assert a.status_code == 201, a.text
        recos = client.get("/api/m5/recommandations/Lina").json()
        assert any(x["agent"] == "Agent_Test_M5" and x["recommandation"] == "Video_Test_M5" for x in recos)
    finally:
        client.delete("/api/individus/Agent_Test_M5")
        client.delete("/api/individus/Video_Test_M5")


@pytest.mark.parametrize("corps", [
    {"type": "Etudiant"},
    {"langue": "DE"},
    {"id": "x} ; DROP"},
    {"cours": "Ahmed"},
])
def test_m5_creation_refusee(corps):
    base = {"id": "Ressource_Refuse", "type": "Tutoriel", "titre": "Ressource refusée", "langue": "FR"}
    assert client.post("/api/m5/ressources", json={**base, **corps}).status_code in (400, 422)


def test_controle_saisie():
    mail = client.post("/api/m1/etudiants", json={
        "id": "Test_Mail", "prenom": "Rim", "nom": "Saidi", "email": "pas-un-email",
        "formation": "Ingenieur_TWIN", "annee": 4,
    })
    assert mail.status_code == 400
    prenom = client.post("/api/m1/etudiants", json={
        "id": "Test_Nom", "prenom": "R1m", "nom": "Saidi", "formation": "Ingenieur_TWIN", "annee": 4,
    })
    assert prenom.status_code == 400
    assert client.get("/api/m1/etudiants", params={"annee": 9}).status_code == 400
    isco = client.post("/api/m3/metiers", json={
        "id": "Metier_Isco", "type": "MetierData", "intituleMetier": "Test métier",
        "codeISCO": "25", "niveauEtudesRequis": "Licence",
    })
    assert isco.status_code == 400
    url = client.post("/api/m5/ressources", json={
        "id": "Res_Url", "type": "Tutoriel", "titre": "Une ressource", "url": "pas-une-url",
    })
    assert url.status_code == 400
    annee = client.post("/api/individus", json={
        "id": "Etu_Annee", "classe": "Etudiant", "proprietes": {"anneeEtude": "9"},
    })
    assert annee.status_code == 400
    assert client.get("/api/individus/Etu_Annee").json() == []


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
