# Évaluation du module NLP (question → intention → SPARQL)

Jeu de test : `tests/questions_test.json` — **94 questions** rédigées différemment des exemples (membres 1 à 6 + commun), dont fautes de frappe, comparaisons, valeurs d'énumération et suites de conversation.

- **Intention** : la bonne intention est choisie.
- **Intention + paramètres** : l'intention ET tous les paramètres attendus (entité, nombre, opérateur, valeur) sont corrects.

## Comparaison des configurations

| Configuration | Intention | Intention + paramètres | Temps moyen |
|---|---|---|---|
| mots-clés seuls | 84.0 % | 84.0 % | 3 ms |
| + fautes de frappe (rapidfuzz) | 91.5 % | 91.5 % | 3 ms |
| + embeddings (sentence-transformers) | 93.6 % | 93.6 % | 13 ms |
| + zero-shot (Hugging Face) | 93.6 % | 93.6 % | 57 ms |

## Détail de la configuration la plus complète : + zero-shot (Hugging Face)

### Par catégorie de question

| Catégorie | Questions | Intention | Intention + paramètres |
|---|---|---|---|
| agregat | 4 | 100.0 % | 100.0 % |
| alias | 2 | 100.0 % | 100.0 % |
| ambigu | 6 | 83.3 % | 83.3 % |
| comparaison | 8 | 100.0 % | 100.0 % |
| enumeration | 6 | 100.0 % | 100.0 % |
| faute | 9 | 77.8 % | 77.8 % |
| reformulation | 6 | 50.0 % | 50.0 % |
| simple | 44 | 100.0 % | 100.0 % |
| suite | 9 | 100.0 % | 100.0 % |

### Par intention

| Intention attendue | Questions | Intention | Intention + paramètres |
|---|---|---|---|
| `agents_fiables` | 1 | 100.0 % | 100.0 % |
| `alertes_indicateurs` | 2 | 100.0 % | 100.0 % |
| `competences_certifiees` | 1 | 100.0 % | 100.0 % |
| `competences_manquantes` | 3 | 100.0 % | 100.0 % |
| `competences_metier` | 2 | 100.0 % | 100.0 % |
| `cours_avances` | 1 | 100.0 % | 100.0 % |
| `cours_competence` | 2 | 100.0 % | 100.0 % |
| `cours_credits` | 3 | 100.0 % | 100.0 % |
| `cours_domaine` | 1 | 100.0 % | 100.0 % |
| `cours_niveau` | 2 | 100.0 % | 100.0 % |
| `cours_parcours` | 1 | 100.0 % | 100.0 % |
| `cours_suivants` | 1 | 100.0 % | 100.0 % |
| `encadrant_etudiant` | 3 | 66.7 % | 66.7 % |
| `enseignant_cours` | 5 | 100.0 % | 100.0 % |
| `etudiants_a_risque` | 1 | 100.0 % | 100.0 % |
| `etudiants_boursiers` | 2 | 100.0 % | 100.0 % |
| `etudiants_formation` | 3 | 100.0 % | 100.0 % |
| `etudiants_option` | 1 | 100.0 % | 100.0 % |
| `etudiants_parcours` | 2 | 50.0 % | 50.0 % |
| `evaluations_note` | 4 | 100.0 % | 100.0 % |
| `evaluations_rattrapage` | 2 | 100.0 % | 100.0 % |
| `evaluations_session` | 1 | 100.0 % | 100.0 % |
| `formation_etudiant` | 4 | 100.0 % | 100.0 % |
| `indicateurs_etudiant` | 3 | 66.7 % | 66.7 % |
| `lister_classe` | 3 | 100.0 % | 100.0 % |
| `metiers_en_tension` | 2 | 100.0 % | 100.0 % |
| `metiers_niveau` | 3 | 66.7 % | 66.7 % |
| `moyenne_etudiant` | 5 | 100.0 % | 100.0 % |
| `moyenne_notes` | 2 | 100.0 % | 100.0 % |
| `nb_competences_metier` | 2 | 100.0 % | 100.0 % |
| `nb_etudiants_formation` | 3 | 100.0 % | 100.0 % |
| `nb_etudiants_par_formation` | 1 | 100.0 % | 100.0 % |
| `notes_etudiant` | 3 | 100.0 % | 100.0 % |
| `parcours_etudiant` | 2 | 100.0 % | 100.0 % |
| `prerequis_cours` | 3 | 66.7 % | 66.7 % |
| `prerequis_manquants` | 3 | 66.7 % | 66.7 % |
| `preuves_etudiant` | 4 | 100.0 % | 100.0 % |
| `recommandation_parcours` | 1 | 100.0 % | 100.0 % |
| `recommandations_etudiant` | 1 | 100.0 % | 100.0 % |
| `ressources_cours` | 1 | 100.0 % | 100.0 % |
| `ressources_courtes` | 1 | 100.0 % | 100.0 % |
| `ressources_libres` | 1 | 100.0 % | 100.0 % |
| `ressources_libres_langue` | 1 | 100.0 % | 100.0 % |
| `ressources_parcours_etudiant` | 1 | 100.0 % | 100.0 % |

### Matrice des erreurs (attendue → obtenue)

| attendue \ obtenue | `cours_avances` | `cours_suivants` | `formation_etudiant` | `metiers_en_tension` | `non comprise` | `prerequis_cours` |
|---|---|---|---|---|---|---|
| `encadrant_etudiant` |  |  | 1 |  |  |  |
| `etudiants_parcours` | 1 |  |  |  |  |  |
| `indicateurs_etudiant` |  |  |  |  | 1 |  |
| `metiers_niveau` |  |  |  | 1 |  |  |
| `prerequis_cours` |  | 1 |  |  |  |  |
| `prerequis_manquants` |  |  |  |  |  | 1 |

| Question | Attendu | Obtenu | Méthode |
|---|---|---|---|
| Lina est encadrée par quel enseignant ? | encadrant_etudiant {"etudiant": "Lina"} | formation_etudiant {"etudiant": "Lina"} | similarité sémantique |
| De quoi dépend le cours Web sémantique ? | prerequis_cours {"cours": "WebSemantique"} | cours_suivants {"cours": "WebSemantique"} | similarité sémantique |
| Sarra a-t-elle les prérequis pour Angular ? | prerequis_manquants {"etudiant": "Sarra", "cours": "Angular"} | prerequis_cours {"cours": "Angular"} | mots-clés + sémantique |
| Un ingénieur peut prétendre à quels métiers ? | metiers_niveau {"niveau": "Ingénieur"} | metiers_en_tension {} | mots-clés + sémantique |
| Quel est le suivi de Lnia ? | indicateurs_etudiant {"etudiant": "Lina"} | None {} | — |
| Qui suit le parcours Donnes ? | etudiants_parcours {"parcours": "Parcours_Donnees"} | cours_avances {} | similarité sémantique |
