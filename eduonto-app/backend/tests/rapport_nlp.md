# Évaluation du module NLP (question → intention → SPARQL)

Jeu de test : `tests/questions_test.json` — **94 questions** rédigées différemment des exemples (membres 1 à 6 + commun), dont fautes de frappe, comparaisons, valeurs d'énumération et suites de conversation.

- **Intention** : la bonne intention est choisie.
- **Intention + paramètres** : l'intention ET tous les paramètres attendus (entité, nombre, opérateur, valeur) sont corrects.

## Comparaison des configurations

| Configuration | Intention | Intention + paramètres | Temps moyen |
|---|---|---|---|
| Avant améliorations — mots-clés seuls | 56.5 % | 47.8 % | 4 ms |
| mots-clés seuls | 84.0 % | 84.0 % | 8 ms |
| + fautes de frappe (rapidfuzz) | 91.5 % | 91.5 % | 8 ms |

Configurations non mesurées (module non installé ou non activé) : embeddings (EDUONTO_EMB=1), zero-shot (EDUONTO_HF=1).

## Détail de la configuration la plus complète : + fautes de frappe (rapidfuzz)

### Par catégorie de question

| Catégorie | Questions | Intention | Intention + paramètres |
|---|---|---|---|
| agregat | 4 | 100.0 % | 100.0 % |
| alias | 2 | 100.0 % | 100.0 % |
| ambigu | 6 | 83.3 % | 83.3 % |
| comparaison | 8 | 100.0 % | 100.0 % |
| enumeration | 6 | 100.0 % | 100.0 % |
| faute | 9 | 77.8 % | 77.8 % |
| reformulation | 6 | 33.3 % | 33.3 % |
| simple | 44 | 97.7 % | 97.7 % |
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
| `evaluations_rattrapage` | 2 | 50.0 % | 50.0 % |
| `evaluations_session` | 1 | 100.0 % | 100.0 % |
| `formation_etudiant` | 4 | 100.0 % | 100.0 % |
| `indicateurs_etudiant` | 3 | 66.7 % | 66.7 % |
| `lister_classe` | 3 | 100.0 % | 100.0 % |
| `metiers_en_tension` | 2 | 100.0 % | 100.0 % |
| `metiers_niveau` | 3 | 66.7 % | 66.7 % |
| `moyenne_etudiant` | 5 | 100.0 % | 100.0 % |
| `moyenne_notes` | 2 | 100.0 % | 100.0 % |
| `nb_competences_metier` | 2 | 50.0 % | 50.0 % |
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

| attendue \ obtenue | `metiers_en_tension` | `non comprise` | `prerequis_cours` |
|---|---|---|---|
| `encadrant_etudiant` |  | 1 |  |
| `etudiants_parcours` |  | 1 |  |
| `evaluations_rattrapage` |  | 1 |  |
| `indicateurs_etudiant` |  | 1 |  |
| `metiers_niveau` | 1 |  |  |
| `nb_competences_metier` | 1 |  |  |
| `prerequis_cours` |  | 1 |  |
| `prerequis_manquants` |  |  | 1 |

| Question | Attendu | Obtenu | Méthode |
|---|---|---|---|
| Lina est encadrée par quel enseignant ? | encadrant_etudiant {"etudiant": "Lina"} | None {} | — |
| De quoi dépend le cours Web sémantique ? | prerequis_cours {"cours": "WebSemantique"} | None {} | — |
| Sarra a-t-elle les prérequis pour Angular ? | prerequis_manquants {"etudiant": "Sarra", "cours": "Angular"} | prerequis_cours {"cours": "Angular"} | mots-clés |
| Un ingénieur peut prétendre à quels métiers ? | metiers_niveau {"niveau": "Ingénieur"} | metiers_en_tension {} | mots-clés |
| Quel métier demande le plus de compétences ? | nb_competences_metier {} | metiers_en_tension {} | mots-clés |
| Quels étudiants ont raté leur examen ? | evaluations_rattrapage {} | None {} | — |
| Quel est le suivi de Lnia ? | indicateurs_etudiant {"etudiant": "Lina"} | None {} | — |
| Qui suit le parcours Donnes ? | etudiants_parcours {"parcours": "Parcours_Donnees"} | None {} | — |
