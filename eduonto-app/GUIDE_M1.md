# Membre 1 — Personne + Formation : guide de démo

Tes fichiers : `backend/app/routers/membre1.py`, `backend/app/nlp/intents/membre1.py`, `frontend/src/pages/Membre1.jsx`.

## Ce que tu montres, critère par critère

| Critère | Ce que tu as |
|---|---|
| SPARQL (4) | Filtre numérique (année), filtre booléen (boursiers), recherche `CONTAINS` (spécialité), `GROUP_CONCAT` (cours enseignés), agrégats `COUNT` + `SUM(IF)` + sous-requêtes (statistiques), `UNION` (relation + inverse), `EXISTS` sur `owl:equivalentClass` (classes déduites). CRUD : `INSERT DATA` (inscription), `DELETE/INSERT` (encadrant), suppression (route commune). |
| Individus (2) | Inscrire un étudiant en direct, lui affecter un encadrant, le supprimer. |
| IA (4) | 6 questions : formation d'un étudiant, étudiants en option, boursiers, qui enseigne un cours, étudiants d'une formation, qui encadre un étudiant. |
| Interface (3) | Graphique des effectifs, formulaire d'inscription, profil avec badges affirmée / déduite, choix de l'encadrant. |
| Valeur ajoutée (2) | Le raisonnement est visible : on voit quelles classes ont été déduites par HermiT. |

## Démo (3 minutes)

1. **Graphique** : « Les effectifs et le taux de boursiers viennent d'une requête avec deux sous-requêtes : `COUNT` des étudiants, et `SUM(IF(boursier, 1, 0))` pour les boursiers. »
2. **Profil d'Omar** : « En bleu, ce qui est écrit dans l'ontologie (Etudiant). En jaune, ce que le raisonneur HermiT a déduit : Omar est `EtudiantARisque`, parce que son assiduité est sous le seuil. La requête teste `owl:equivalentClass` pour savoir si une classe est définie. »
3. **Inscrire** Rim Saïdi en Ingenieur_TWIN, 4e année, boursière : « Un seul `INSERT DATA`. Le matricule et la date sont générés, et l'année est validée entre 1 et 5, comme la contrainte de l'ontologie. » Le graphique se met à jour.
4. **Encadrant** : choisis Rim, puis Prof_BenAli. « Un `DELETE/INSERT` met à jour `estEncadrePar` ET son inverse `encadre`. »
5. **Assistant IA** : « Qui encadre Rim_Saidi ? » ou « Quels étudiants sont boursiers ? ». Rim, ajoutée il y a une minute, est reconnue sans redémarrage.
6. **Supprimer** Rim dans le tableau CRUD.

## Questions possibles du jury

- **Pourquoi Rim n'est pas `EtudiantOption` alors qu'elle est en 4e année ?** « Les classes définies sont calculées par HermiT au moment où on génère `EduOnto_inferred.owl`. rdflib ne raisonne pas en direct. Il suffit de relancer `scripts/build_inferred.py` pour qu'elle le devienne. »
- **Comment évitez-vous l'injection SPARQL ?** « Les identifiants passent par `check_id()` (lettres, chiffres, _). Les textes sont échappés (guillemets, antislash), et les nombres sont validés par Pydantic. »
