# Évaluation du module NLP (question → intention → SPARQL)

Jeu de test : `tests/questions_test.json` — **69 questions** rédigées différemment des exemples (membres 1 à 4 + commun), dont fautes de frappe, comparaisons, valeurs d'énumération et suites de conversation.

- **Intention** : la bonne intention est choisie.
- **Intention + paramètres** : l'intention ET tous les paramètres attendus (entité, nombre, opérateur, valeur) sont corrects.

## Comparaison des configurations

| Configuration | Intention | Intention + paramètres | Temps moyen |
|---|---|---|---|
| Avant améliorations — mots-clés seuls | 56.5 % | 47.8 % | 4 ms |
| mots-clés seuls | 79.7 % | 79.7 % | 4 ms |
| + fautes de frappe (rapidfuzz) | 89.9 % | 89.9 % | 3 ms |

Configurations non mesurées (module non installé ou non activé) : embeddings (EDUONTO_EMB=1), zero-shot (EDUONTO_HF=1).

## Détail de la configuration la plus complète : + fautes de frappe (rapidfuzz)

### Par catégorie de question

| Catégorie | Questions | Intention | Intention + paramètres |
|---|---|---|---|
| ambigu | 6 | 66.7 % | 66.7 % |
| comparaison | 7 | 100.0 % | 100.0 % |
| enumeration | 5 | 100.0 % | 100.0 % |
| faute | 7 | 100.0 % | 100.0 % |
| reformulation | 4 | 0.0 % | 0.0 % |
| simple | 32 | 96.9 % | 96.9 % |
| suite | 8 | 100.0 % | 100.0 % |

### Par intention

| Intention attendue | Questions | Intention | Intention + paramètres |
|---|---|---|---|
| `competences_certifiees` | 1 | 100.0 % | 100.0 % |
| `competences_manquantes` | 3 | 100.0 % | 100.0 % |
| `competences_metier` | 2 | 100.0 % | 100.0 % |
| `cours_avances` | 1 | 100.0 % | 100.0 % |
| `cours_competence` | 2 | 100.0 % | 100.0 % |
| `cours_credits` | 3 | 100.0 % | 100.0 % |
| `cours_domaine` | 1 | 100.0 % | 100.0 % |
| `cours_niveau` | 2 | 100.0 % | 100.0 % |
| `cours_suivants` | 1 | 100.0 % | 100.0 % |
| `encadrant_etudiant` | 3 | 66.7 % | 66.7 % |
| `enseignant_cours` | 5 | 100.0 % | 100.0 % |
| `etudiants_boursiers` | 2 | 100.0 % | 100.0 % |
| `etudiants_formation` | 1 | 100.0 % | 100.0 % |
| `etudiants_option` | 1 | 100.0 % | 100.0 % |
| `evaluations_note` | 4 | 100.0 % | 100.0 % |
| `evaluations_rattrapage` | 2 | 50.0 % | 50.0 % |
| `evaluations_session` | 1 | 100.0 % | 100.0 % |
| `formation_etudiant` | 4 | 100.0 % | 100.0 % |
| `lister_classe` | 3 | 100.0 % | 100.0 % |
| `metiers_en_tension` | 2 | 100.0 % | 100.0 % |
| `metiers_niveau` | 3 | 66.7 % | 66.7 % |
| `moyenne_etudiant` | 5 | 100.0 % | 100.0 % |
| `moyenne_notes` | 2 | 50.0 % | 50.0 % |
| `nb_competences_metier` | 2 | 50.0 % | 50.0 % |
| `notes_etudiant` | 3 | 100.0 % | 100.0 % |
| `prerequis_cours` | 3 | 66.7 % | 66.7 % |
| `prerequis_manquants` | 3 | 66.7 % | 66.7 % |
| `preuves_etudiant` | 4 | 100.0 % | 100.0 % |

### Matrice des erreurs (attendue → obtenue)

| attendue \ obtenue | `metiers_en_tension` | `nb_competences_metier` | `non comprise` | `prerequis_cours` |
|---|---|---|---|---|
| `encadrant_etudiant` |  |  | 1 |  |
| `evaluations_rattrapage` |  |  | 1 |  |
| `metiers_niveau` | 1 |  |  |  |
| `moyenne_notes` |  | 1 |  |  |
| `nb_competences_metier` | 1 |  |  |  |
| `prerequis_cours` |  |  | 1 |  |
| `prerequis_manquants` |  |  |  | 1 |

| Question | Attendu | Obtenu | Méthode |
|---|---|---|---|
| Lina est encadrée par quel enseignant ? | encadrant_etudiant {"etudiant": "Lina"} | None {} | — |
| De quoi dépend le cours Web sémantique ? | prerequis_cours {"cours": "WebSemantique"} | None {} | — |
| Sarra a-t-elle les prérequis pour Angular ? | prerequis_manquants {"etudiant": "Sarra", "cours": "Angular"} | prerequis_cours {"cours": "Angular"} | mots-clés |
| Un ingénieur peut prétendre à quels métiers ? | metiers_niveau {"niveau": "Ingénieur"} | metiers_en_tension {} | mots-clés |
| Quel métier demande le plus de compétences ? | nb_competences_metier {} | metiers_en_tension {} | mots-clés |
| Moyenne des notes pour chaque cours | moyenne_notes {} | nb_competences_metier {} | mots-clés |
| Quels étudiants ont raté leur examen ? | evaluations_rattrapage {} | None {} | — |
