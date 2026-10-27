# Membre 2 — Cours + Domaine : guide de démo

Tes fichiers : `backend/app/routers/membre2.py`, `backend/app/nlp/intents/membre2.py`, `frontend/src/pages/Membre2.jsx`.

## Ce que tu montres, critère par critère

| Critère | Ce que tu as |
|---|---|
| SPARQL (4) | Chemins de propriétés transitifs (`aPourPrerequis+`, `estPrerequisDe+`), hiérarchie de classes (`rdfs:subClassOf*`), filtre sur une énumération (niveau), filtre numérique (crédits), recherche `CONTAINS` sur plusieurs champs avec `EXISTS`, agrégats `COUNT` / `SUM` / `AVG` par grand domaine, `FILTER NOT EXISTS` (prérequis manquants). CRUD : `INSERT DATA` (cours + prérequis + inverse), mise à jour avec détection de cycle, suppression (route commune). |
| Individus (2) | Créer le cours React en direct, avec son domaine et ses prérequis, puis le supprimer. |
| IA (4) | 6 questions : prérequis d'un cours, cours d'un domaine, cours suivants, cours d'au moins N crédits, cours avancés (classe déduite), « Ahmed peut-il suivre Angular ? » (2 entités dans une seule question). |
| Interface (3) | Chemin d'apprentissage visuel, vérificateur « peut-il suivre ? », graphique par domaine, formulaires. |
| Valeur ajoutée (2) | Aide à l'inscription (prérequis manquants) et refus des cycles de prérequis. |

## Démo (3 minutes)

1. **Chemin d'Angular** : « `aPourPrerequis` est une propriété transitive. Avec le chemin `aPourPrerequis+`, on obtient aussi les prérequis indirects (Algorithmique), triés par semestre : c'est l'ordre à suivre. »
2. **Peut-il suivre ?** Ahmed / Angular : « Il manque TypeScript. La requête prend tous les prérequis et garde ceux qu'Ahmed n'a pas validés, avec `FILTER NOT EXISTS`. » Change pour Yassine : il a tout validé, la réponse passe au vert.
3. **Créer React** (OptionTechnique, DeveloppementWeb, Avancé, semestre 8, prérequis JavaScript + TypeScript) : « Un `INSERT DATA` écrit aussi la relation inverse `estPrerequisDe`. » Dans le chemin, choisis React : Algorithmique apparaît, déduit par transitivité alors qu'on ne l'a jamais saisi.
4. **Cycle** : ajoute Angular comme prérequis d'Algorithmique, la demande est refusée. « Avant l'INSERT, une requête vérifie qu'Angular ne dépend pas déjà d'Algorithmique. Sinon, on créerait une boucle : il faudrait Angular pour faire Algorithmique et Algorithmique pour faire Angular. »
5. **Assistant IA** : « Ahmed peut-il suivre Angular ? ». spaCy reconnaît deux entités (un étudiant et un cours) et remplit les deux paramètres du gabarit.
6. **Supprimer** React dans le tableau CRUD.

## Questions possibles du jury

- **Pourquoi JavaScript est un « cours avancé » alors qu'il est de niveau Débutant ?** « `CoursAvance` est une classe définie : Cours ⊓ ∃aPourPrerequis.Cours. Un cours est avancé dès qu'il a au moins un prérequis, et JavaScript a Algorithmique comme prérequis. C'est HermiT qui le déduit. L'attribut `niveau` est autre chose : une valeur saisie (énumération owl:oneOf). »
- **Comment fonctionne la recherche ?** « `CONTAINS` en minuscules sur l'intitulé, le code, le libellé du domaine et ses mots-clés. Pour les mots-clés, on utilise `EXISTS`, parce qu'un domaine en a plusieurs. »
