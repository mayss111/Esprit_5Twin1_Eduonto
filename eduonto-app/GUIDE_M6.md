# Membre 6 — ParcoursApprentissage + IndicateurApprentissage : guide de démo

Eya Nefzi. Tes fichiers : `backend/app/routers/membre6.py`, `backend/app/nlp/intents/membre6.py`, `frontend/src/pages/Membre6.jsx`
(+ tes individus dans `ontology/EduOnto.owl` et `EduOnto_inferred.owl`, tes tests dans `backend/tests/test_api.py`).

Idée du module : **« Suivi et alertes d'apprentissage »**. Les indicateurs (assiduité, réussite, stress…) sont des nombres ;
le module les transforme en **alertes** puis en **parcours conseillé**. Il termine le scénario d'Omar.

## Ce que tu montres, critère par critère

| Critère | Ce que tu as |
|---|---|
| SPARQL (4) | 12 lectures : alertes avec `BIND(EXISTS {…})` + `IF` (sens donné par la classe), chemin `rdfs:subClassOf*` (type le plus précis, famille d'indicateur), `COUNT` / `GROUP_CONCAT` / `GROUP BY` (catalogue), `AVG` / `MIN` / `MAX` / `SUM(IF)` (statistiques), sous-requête + `COALESCE` (tableau de suivi), `CONTAINS` + `LCASE` (recherche), `FILTER NOT EXISTS` (cours non validés), `owl:equivalentClass` (classes déduites). Écritures : `INSERT DATA` (mesure, parcours), `DELETE / INSERT WHERE` (nouvelle valeur, inscription à un parcours), suppression (route commune). |
| Individus (2) | 4 nouveaux dans l'ontologie : `Parcours_Excellence_IA` (ParcoursExcellence, proposé par Ingenieur_DataScience), `Stress_Omar` (0,82 / seuil 0,7), `Participation_Yassine` (0,75 / 0,5), `Connexion_Lina` (0,3 / 0,4). En démo : créer une mesure, la modifier, la supprimer. |
| Scénario (2) | Omar : 3 alertes → HermiT l'a classé `EtudiantARisque` → il a raté SQL (8,5) → l'application conseille `Parcours_RattrapageSQL` → on l'inscrit. |
| IA (4) | 7 intentions : indicateurs d'un étudiant, étudiants d'un parcours, parcours d'un étudiant, cours d'un parcours, alertes, étudiants à risque, parcours conseillé. 12 questions M6 dans le jeu d'évaluation (94 questions, 91,5 % d'intentions correctes au total). |
| Interface (3) | Chiffres clés, tableau de suivi cliquable, barres valeur + trait de seuil, badges affirmée / déduite, carte de recommandation avec bouton « Inscrire », cartes de parcours + recherche, formulaires validés côté client et serveur. |
| Communication (3) | Bouton → `api.js` → `PUT /api/m6/etudiants/Omar/parcours` → `check_id` + Pydantic → `DELETE/INSERT` SPARQL → JSON → la page se rafraîchit. |
| Valeur ajoutée (2) | Alertes dans le bon sens + recommandation automatique d'un parcours (rattrapage si difficulté, excellence sinon). |

## La règle à expliquer : le sens d'une alerte

Comparer `valeur < seuil` partout serait **faux** : pour le stress, c'est une valeur **haute** qui est mauvaise.
Sans ça, Sarra (stress 0,4, seuil 0,7) serait en alerte. La classe donne le sens :

```sparql
BIND(EXISTS { ?t rdfs:subClassOf* edu:IndicateurBienEtre } AS ?hautEstMauvais)
BIND(IF(?hautEstMauvais, ?valeur > ?seuil, ?valeur < ?seuil) AS ?alerte)
```

Résultat : Omar (assiduité 0,55, réussite 0,40, stress 0,82) et Lina (connexion 0,30) sont en alerte ; Ahmed, Sarra, Yassine non.

## La recommandation (valeur ajoutée)

1. L'étudiant a une évaluation avec une note < 10 → parcours de **rattrapage** qui comprennent ce cours (Omar → Rattrapage SQL).
2. Sinon, il a au moins une alerte → parcours de rattrapage, classés par nombre de cours non validés (Lina).
3. Sinon → parcours d'**excellence** avec les cours qu'il n'a pas encore validés (Ahmed → Excellence IA).

## Démo (3 minutes)

1. **Chiffres clés + tableau de suivi** : « 4 alertes sur 7 mesures. La colonne Raisonneur vient de HermiT : Omar est
   `EtudiantARisque`, défini par `Etudiant ⊓ ∃aIndicateur.(TauxAssiduite ⊓ valeur < 0,6)`. Personne ne l'a écrit à la main. »
2. **Suivi d'Omar** : « Le trait vertical est le seuil. Le stress est rouge parce qu'il est **au-dessus**, l'assiduité parce qu'elle est
   **en dessous** : c'est la classe IndicateurBienEtre qui donne le sens. » Clique sur Sarra : son stress est sous le seuil, pas d'alerte.
3. **Recommandation** : « Omar a eu 8,5 en SQL. La requête cherche un ParcoursRattrapage qui comprend ce cours. »
   Clique **Inscrire à ce parcours** : « Un `DELETE/INSERT` remplace son parcours. » La carte devient « déjà suivi ».
4. **Mesures** : crée `Stress_Yassine` (NiveauStress, 0.85, seuil 0.7) → toast « ALERTE », Yassine apparaît dans le tableau.
   Mets-la à jour à 0.3 → l'alerte disparaît. Supprime-la dans l'onglet CRUD IndicateurApprentissage.
5. **Assistant IA** (thème « Parcours & suivi ») : « Quels sont les indicateurs d'Omar ? », puis « Comment va Yasine ? »
   (faute corrigée par rapidfuzz), puis la suite « Comment va Ahmed ? » → « Et son parcours ? » (contexte de conversation).
   Montre l'intention, l'entité trouvée par le PhraseMatcher, le SPARQL généré.
6. **Réinitialiser les données** (page Accueil) à la fin.

## Questions possibles du jury

- **Pourquoi `edu:concerne` et pas `edu:aIndicateur` ?** « `aIndicateur` est l'inverse de `concerne`. rdflib ne raisonne pas
  et le fichier inféré ne contient pas les triplets inverses ; je lis donc `concerne`. À la création d'une mesure, j'écris les deux. »
- **Pourquoi Stress_Omar ne change pas EtudiantARisque ?** « La définition de la classe ne porte que sur TauxAssiduite. Mes alertes
  SPARQL couvrent tous les indicateurs ; les deux sont complémentaires : déduction OWL d'un côté, règle métier en SPARQL de l'autre. »
- **Une mesure ajoutée depuis l'interface rend-elle l'étudiant EtudiantARisque ?** « Pas tout de suite : HermiT est lancé par
  `scripts/build_inferred.py`. Mes alertes, elles, sont calculées en direct. »
- **Comment évitez-vous l'injection SPARQL ?** « `check_id()` sur les identifiants, Pydantic (`ge=0, le=1`) et `verifier_attribut`
  sur les valeurs, chaînes échappées ; le module NLP n'exécute que des SELECT validés par `prepareQuery`. »
- **Pourquoi pas ChatGPT pour le NLP ?** « Interdit, et pas nécessaire : spaCy (lemmes, PhraseMatcher construit depuis l'ontologie),
  rapidfuzz pour les fautes, gabarits SPARQL. Le résultat est vérifiable et mesuré (`tests/rapport_nlp.md`). »
- **Limites ?** « Une faute dans un nom de plusieurs mots (« parcours Donnes ») ou une inversion de lettres (« Lnia ») n'est pas
  corrigée : rapidfuzz ne compare que les libellés d'un mot, avec un seuil de 85. Elles sont visibles dans le rapport. »

## Vérifier

```bash
cd backend
python -m pytest tests -q            # 123 tests, dont 36 pour M6
python scripts/evaluer_nlp.py        # rapport tests/rapport_nlp.md
```
