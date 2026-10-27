# EduOnto — application Web Sémantique (validation finale)

Ontologie **EduOnto** (Éducation et Formation) exploitée par une application web :
CRUD en SPARQL, recherche et filtres, et un module IA qui traduit une question en français en requête SPARQL.

```
React (Vite)  ──HTTP/JSON──▶  FastAPI (Python)  ──SPARQL 1.1──▶  rdflib  ──▶  EduOnto_inferred.owl
  frontend/                    backend/app/                                     ▲
                               └─▶ module NLP : spaCy (+ Hugging Face)           └── raisonneur HermiT (owlready2)
```

---

## 1. Installation (une seule fois)

Prérequis : **Python 3.10+**, **Node 18+**, **Java** (uniquement pour régénérer l'ontologie inférée).

```bash
# Back-end
cd backend
python -m venv .venv
# Windows : .venv\Scripts\activate     |  Mac/Linux : source .venv/bin/activate
pip install -r requirements.txt
python -m spacy download fr_core_news_sm

# Front-end
cd ../frontend
npm install
```

## 2. Lancer le projet (2 terminaux)

```bash
# Terminal 1 — back-end : http://localhost:8000/docs (Swagger, pour tester chaque route)
cd backend
uvicorn app.main:app --reload --port 8000

# Terminal 2 — front-end : http://localhost:5173
cd frontend
npm run dev
```

## 3. Modifier l'ontologie

1. Modifier `ontology/EduOnto.owl` dans Protégé (le **même fichier pour tout le groupe**).
2. Régénérer les déductions : `cd backend && python scripts/build_inferred.py`
3. Cliquer « Réinitialiser les données » sur la page Accueil (ou `POST /api/reset`).

> rdflib ne raisonne pas. C'est pour cela que l'application charge `EduOnto_inferred.owl`
> (ontologie + classes déduites par HermiT : EtudiantARisque, AgentIAFiable, CompetenceCertifiee…).
> Les ajouts / modifications faits depuis l'interface sont enregistrés dans `ontology/EduOnto_runtime.ttl`
> (fichier à **ne pas** committer).

---

## 4. Organisation du code : qui touche quoi

| Fichier | Rôle | Qui |
|---|---|---|
| `backend/app/store.py` | chargement du graphe, `select()`, `update()` | commun (ne pas modifier sans prévenir) |
| `backend/app/routers/generic.py` | CRUD SPARQL générique pour **toutes** les classes | commun |
| `backend/app/nlp/translator.py` | pipeline NLP (spaCy + Hugging Face) | commun |
| `backend/app/routers/membreN.py` | **vos requêtes SPARQL spécifiques** | membre N |
| `backend/app/nlp/intents/membreN.py` | **vos intentions NLP (question → SPARQL)** | membre N |
| `frontend/src/pages/MembreN.jsx` | **votre page** (vos 2 classes + vos requêtes) | membre N |
| `frontend/src/pages/Assistant.jsx` | page IA (ajoutez vos questions d'exemple) | tous |

Chacun travaille dans **ses 3 fichiers** : pas de conflit Git.

### Routes communes (déjà prêtes)

| Méthode | Route | SPARQL |
|---|---|---|
| GET | `/api/classes/{classe}/individus?recherche=` | SELECT + FILTER CONTAINS |
| GET | `/api/individus/{id}` | SELECT |
| POST | `/api/individus` `{id, classe, proprietes}` | INSERT DATA |
| PUT | `/api/individus/{id}` `{proprietes}` | DELETE / INSERT / WHERE |
| DELETE | `/api/individus/{id}` | DELETE WHERE |
| GET | `/api/classes/{classe}/proprietes` | attributs + relations (pour les formulaires) |
| POST | `/api/ask` `{question}` | NLP → SPARQL → résultats |

---

## 5. Répartition et checklist par membre

Pour chaque membre, **2 requêtes et 2 intentions sont déjà faites en exemple**. Il reste à faire :

### Membre 1 — Personne + Formation
- [ ] SPARQL : enseignants par spécialité (FILTER + CONTAINS)
- [ ] SPARQL : étudiants d'une formation donnée
- [ ] SPARQL : classes déduites d'un étudiant (EtudiantOption, EtudiantActif…)
- [ ] NLP : « Qui enseigne X ? », « Quels étudiants sont boursiers ? »
- [ ] Individus : au moins 2 nouveaux (via l'interface ou Protégé)

### Membre 2 — Cours + Domaine
- [ ] SPARQL : cours d'un niveau donné (Débutant / Intermédiaire / Avancé)
- [ ] SPARQL : cours de plus de N crédits (FILTER)
- [ ] SPARQL : cours suivants d'un cours (estPrerequisDe)
- [ ] NLP : « Cours de plus de N crédits », « Cours de niveau avancé »
- [ ] Individus : au moins 2 nouveaux

### Membre 3 — Competence + Metier
- [x] SPARQL : métiers en tension (estEnTension = true)
- [x] SPARQL : cours qui développent une compétence donnée
- [x] SPARQL : métiers accessibles avec un niveau d'études donné
- [x] NLP : « Métiers en tension », « Cours qui développent la compétence X »
- [x] Individus : au moins 2 nouveaux

### Membre 4 — Evaluation + PreuveDeCompetence
- [ ] SPARQL : évaluations d'une session (Principale / Rattrapage)
- [ ] SPARQL : moyenne des notes par cours (AVG + GROUP BY)
- [ ] SPARQL : preuves expirées (dateExpiration < NOW())
- [ ] NLP : « Moyenne des notes », « Évaluations de rattrapage »
- [ ] Individus : au moins 2 nouveaux

### Membre 5 — RessourcePedagogique + AgentPedagogiqueIA
- [ ] SPARQL : ressources en libre accès d'une langue donnée
- [ ] SPARQL : ressources utilisées par un cours
- [ ] SPARQL : ressources de moins de N minutes
- [ ] NLP : « Ressources en libre accès », « Ressources du cours X »
- [ ] Individus : au moins 2 nouveaux

### Membre 6 — ParcoursApprentissage + IndicateurApprentissage
- [ ] SPARQL : tous les indicateurs d'un étudiant
- [ ] SPARQL : étudiants qui suivent un parcours donné
- [ ] SPARQL : comparer chaque indicateur à son propre seuilAlerte
- [ ] NLP : « Indicateurs de X », « Qui suit le parcours X ? »
- [ ] Individus : au moins 2 nouveaux

### Pour tous (grille de notation)

| Critère | Ce qui est fourni | Ce que chacun doit montrer |
|---|---|---|
| Requêtes SPARQL (4) | CRUD générique + 2 exemples | ses requêtes : filtre, recherche, agrégat, chemin de propriété |
| Individus (2) | 62 individus | ses individus, créés et modifiés en démo |
| Scénario (2) | scénario Ahmed / Omar en 7 actes | M3 : compétences manquantes d'Ahmed et cours qui peuvent les développer |
| API IA (4) | pipeline spaCy + HF + 2 intentions | ses intentions + savoir expliquer le pipeline |
| Interfaces (3) | page générique + sa page | sa page personnalisée |
| Communication BE/FE (3) | `api.js` → FastAPI | expliquer le trajet d'une requête (front → route → SPARQL → JSON) |
| Valeur ajoutée (2) | — | une idée en plus (graphique, export, recommandation…) |

---

## 6. Ajouter une requête SPARQL (exemple)

`backend/app/routers/membre2.py` :

```python
@router.get("/cours-credits")
def cours_credits(min: int = 4):
    return select(f"""
        SELECT ?cours ?credits WHERE {{
          ?cours edu:nbCredits ?credits .
          FILTER(?credits >= {int(min)})
        }} ORDER BY DESC(?credits)""")
```

Puis dans `frontend/src/pages/Membre2.jsx` :

```jsx
<QueryCard titre="Cours d'au moins N crédits" url="/api/m2/cours-credits" query={{ min: 4 }} />
```

> Les accolades SPARQL `{ }` s'écrivent `{{ }}` dans une f-string Python.
> Toujours passer les identifiants dans `check_id()` (et les nombres dans `int()` / `float()`)
> pour éviter l'injection SPARQL.

## 7. Ajouter une intention NLP (exemple)

`backend/app/nlp/intents/membre2.py` :

```python
{"name": "cours_credits", "membre": 2, "description": "les cours d'au moins N crédits",
 "keywords": ["credits", "credit", "au moins"],
 "slots": {"n": "number"},
 "template": """SELECT ?cours ?credits WHERE {{
  ?cours edu:nbCredits ?credits . FILTER(?credits >= {n})
}} ORDER BY DESC(?credits)"""},
```

- `keywords` : mots (sans accents) qui orientent vers cette intention.
- `slots` : ce qu'il faut trouver dans la question. `"number"` = un nombre ; `"Cours"`, `"Etudiant"`… = un individu
  de cette classe, reconnu par le **PhraseMatcher spaCy** construit à partir des individus de l'ontologie ;
  `"CLASS"` = un nom de classe.
- Tester : page **Assistant IA** ou `POST /api/ask` dans Swagger.

---

## 8. Module IA : ce qu'il faut dire à l'oral

Pas d'API LLM (ni Gemini, ni OpenAI). Le pipeline utilise des **bibliothèques NLP** :

1. **Normalisation** : minuscules, suppression des accents.
2. **spaCy** (`fr_core_news_sm`) : tokenisation et lemmatisation (« compétences » → « compétence »).
3. **spaCy PhraseMatcher** : reconnaissance des entités de l'ontologie (Ahmed, Angular, DeveloppeurFullStack…),
   le dictionnaire est **construit automatiquement à partir des individus et classes de l'OWL**.
4. **Détection d'intention** par score de mots-clés, avec en option un repli **Hugging Face Transformers**
   en zero-shot (`MoritzLaurer/mDeBERTa-v3-base-mnli-xnli`), activé par `EDUONTO_HF=1`
   (nécessite `pip install transformers torch`).
5. **Remplissage des paramètres** (slots) avec vérification du type dans l'ontologie : entités, nombres
   avec leur opérateur (« inférieure à 10 » → `<`), valeurs d'énumération (Master, Rattrapage, Avancé…).
6. **Génération SPARQL** à partir de gabarits, validée par `rdflib.prepareQuery` (SELECT uniquement), puis exécution.

Améliorations optionnelles (le serveur démarre sans elles) :

| Module | Rôle | Activation |
|---|---|---|
| rapidfuzz | fautes de frappe : « Angulr » → Angular | `pip install rapidfuzz` |
| sentence-transformers (`paraphrase-multilingual-MiniLM-L12-v2`) | similarité cosinus avec les questions-exemples de chaque intention | `pip install sentence-transformers` + `EDUONTO_EMB=1` |
| transformers (mDeBERTa) | repli zero-shot | `EDUONTO_HF=1` |

La réponse de `/api/ask` contient aussi `confiance`, `alternatives`, `suggestions` (si la question est ambiguë)
et `contexte` : le renvoyer avec la question suivante permet « Et ses notes ? ».
Évaluation : `python scripts/evaluer_nlp.py` (jeu `tests/questions_test.json`, rapport `tests/rapport_nlp.md`).
Tests de l'API : `python -m pytest tests -q`.

La page Assistant affiche chaque étape : intention, entités, paramètres, SPARQL généré, résultats.

## 9. Outils à citer dans la présentation

Protégé · OWL 2 / RDF · HermiT (via owlready2) · SPARQL 1.1 · rdflib · FastAPI · React + Vite ·
spaCy (`fr_core_news_sm`, PhraseMatcher) · Hugging Face Transformers (zero-shot, optionnel).
