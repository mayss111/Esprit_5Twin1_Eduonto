import { useEffect, useState } from "react";
import { api } from "../api.js";
import ResultTable from "../components/ResultTable.jsx";

// Module IA : question en français -> spaCy (+ rapidfuzz, sentence-transformers, Hugging Face en option)
// -> SPARQL -> résultats. Chaque membre ajoute ici 1 ou 2 exemples de questions pour ses classes.
// Un exemple « suite » pose deux questions d'affilée : la 2e réutilise le contexte de la 1re.
const EXEMPLES = [
  "Quelle est la formation d'Ahmed ?",                                   // M1
  "Qui enseigne JavaScript ?",                                           // M1
  "Quels étudiants sont boursiers ?",                                    // M1
  "Quels sont les prérequis d'Angular ?",                                // M2
  "Ahmed peut-il suivre Angular ?",                                      // M2
  "Que puis-je suivre après JavaScript ?",                               // M2
  "Quelles compétences requiert le métier de développeur full-stack ?",  // M3
  "Quelles compétences manquent à Ahmed ?",                              // M3
  "Quels métiers sont accessibles avec un master ?",                     // M3
  "Combien de compétences demande chaque métier ?",                      // M3
  "Quelles évaluations ont une note inférieure à 10 ?",                  // M4 (opérateur de comparaison)
  "Quelle est la moyenne des notes par cours ?",                         // M4
  "Quels badges a obtenu Sarra ?",                                       // M4
  "Quelle est la moyenne d'Ahmed ?",                                     // M4
  "Comment se sont passés les examens ?",                                // M4 (repli sémantique / zero-shot)
  "Quels agents IA sont fiables ?",                                      // M5
  "Quels étudiants sont à risque de décrochage ?",                       // M6
  "Liste les cours",                                                     // commun
  "Qui enseigne Angulr ?",                                               // faute de frappe (rapidfuzz)
  { libelle: "Suite : moyenne d'Ahmed → « Et ses badges ? »",            // mémoire de conversation
    questions: ["Quelle est la moyenne d'Ahmed ?", "Et ses badges ?"] },
];

export default function Assistant() {
  const [question, setQuestion] = useState("");
  const [rep, setRep] = useState(null);
  const [contexte, setContexte] = useState([]);   // entités renvoyées par la réponse précédente
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);
  const [sante, setSante] = useState(null);       // modules NLP actifs (GET /api/health)

  useEffect(() => { api.get("/api/health").then(setSante).catch(() => setSante(null)); }, []);

  // Pose une ou plusieurs questions à la suite ; chacune reçoit le contexte laissé par la précédente.
  async function poser(questions = [question], ctxDepart = contexte) {
    const liste = questions.filter((q) => q.trim());
    if (!liste.length) return;
    setErreur("");
    setChargement(true);
    let ctx = ctxDepart;
    try {
      for (const q of liste) {
        setQuestion(q);
        const r = await api.ask(q, ctx);
        ctx = r.contexte ?? [];
        setRep(r);
      }
      setContexte(ctx);
    } catch (e) {
      setErreur(e.message);
      setRep(null);
    } finally {
      setChargement(false);
    }
  }

  function nouvelleConversation() {
    setContexte([]);
    setRep(null);
    setQuestion("");
  }

  return (
    <div>
      <h2>Assistant EduOnto · question en langage naturel</h2>
      {sante && (
        <p className="muted">
          Modèle spaCy : <code>{sante.modele_spacy}</code> ·{" "}
          <Module actif={sante.fuzzy} nom="fautes de frappe (rapidfuzz)" aide="pip install rapidfuzz" /> ·{" "}
          <Module actif={sante.embeddings} nom="similarité sémantique" aide="EDUONTO_EMB=1" /> ·{" "}
          <Module actif={sante.zero_shot} nom="zero-shot Hugging Face" aide="EDUONTO_HF=1" />
        </p>
      )}
      <div className="row">
        <input className="grow" value={question} onChange={(e) => setQuestion(e.target.value)}
               onKeyDown={(e) => e.key === "Enter" && poser()} placeholder="Posez une question sur l'ontologie…" />
        <button className="primary" onClick={() => poser()} disabled={chargement}>
          {chargement ? "…" : "Demander"}
        </button>
        <button onClick={nouvelleConversation} disabled={chargement}>Nouvelle conversation</button>
      </div>
      {contexte.length > 0 && (
        <p className="muted">
          Contexte de la conversation :{" "}
          {contexte.map((e) => <span key={e.id} className="badge neutre">{e.id}</span>)}{" "}
          <span className="muted">(« et ses notes ? » réutilise ces entités)</span>
        </p>
      )}
      <div className="chips">
        {EXEMPLES.map((ex) => typeof ex === "string"
          ? <button key={ex} className="chip" onClick={() => poser([ex])}>{ex}</button>
          : <button key={ex.libelle} className="chip suite" onClick={() => poser(ex.questions, [])}>{ex.libelle}</button>)}
      </div>
      {erreur && <p className="error">{erreur}</p>}

      {rep && (
        <div className="grid2">
          <div className="card">
            <h4>Analyse NLP</h4>
            <p><b>Intention :</b> {rep.intention ?? "non reconnue"} {rep.membre ? `(membre ${rep.membre})` : ""}</p>
            {rep.message && <p className="error">{rep.message}</p>}
            {rep.methode && <p><b>Méthode :</b> {rep.methode} · <b>modèle spaCy :</b> {rep.modele_spacy}</p>}
            <Confiance valeur={rep.confiance ?? 0} />
            {rep.ambigue && <p className="muted">Deux intentions sont à égalité : vérifiez les suggestions ci-dessous.</p>}
            {rep.entites?.some((e) => e.correction) && (
              <p><b>Fautes corrigées :</b>{" "}
                {rep.entites.filter((e) => e.correction).map((e) => (
                  <span key={e.id} className="badge neutre">{e.correction}</span>
                ))}
              </p>
            )}
            <p><b>Entités reconnues :</b></p>
            <ResultTable rows={rep.entites} />
            <p><b>Paramètres :</b> <code>{JSON.stringify(rep.parametres ?? {})}</code></p>
            {rep.parametres_du_contexte && (
              <p><b>Pris dans le contexte :</b> <code>{JSON.stringify(rep.parametres_du_contexte)}</code></p>
            )}
            {rep.alternatives?.length > 0 && (
              <>
                <p><b>Autres intentions envisagées :</b></p>
                <ResultTable rows={rep.alternatives} />
              </>
            )}
            {rep.methode?.startsWith("zero-shot") && rep.scores_zero_shot?.length > 0 && (
              <>
                <p><b>Scores zero-shot (3 meilleures intentions) :</b></p>
                <ResultTable rows={rep.scores_zero_shot} />
              </>
            )}
            {rep.suggestions?.length > 0 && (
              <>
                <p><b>Vouliez-vous dire :</b></p>
                <div className="chips">
                  {rep.suggestions.map((s) => <button key={s} className="chip" onClick={() => poser([s])}>{s}</button>)}
                </div>
              </>
            )}
          </div>
          <div className="card">
            <h4>Requête SPARQL générée</h4>
            {rep.erreur && <p className="error">{rep.erreur}</p>}
            <pre>{rep.sparql || "—"}</pre>
          </div>
          <div className="card span2">
            <h4>Résultats ({rep.resultats?.length ?? 0})</h4>
            <ResultTable rows={rep.resultats} />
          </div>
        </div>
      )}
    </div>
  );
}

function Module({ actif, nom, aide }) {
  return actif
    ? <span className="badge ok">{nom} actif</span>
    : <span className="badge">{nom} inactif ({aide})</span>;
}

// Barre de confiance (0 à 1) : rouge sous 0,35, le seuil à partir duquel des suggestions sont proposées.
function Confiance({ valeur }) {
  const pct = Math.round(valeur * 100);
  return (
    <div className="barre">
      <span className="barre-label"><b>Confiance</b></span>
      <div className="barre-fond">
        <div className={`barre-valeur ${valeur >= 0.35 ? "ok" : "ko"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="barre-chiffre">{pct} %</span>
    </div>
  );
}
