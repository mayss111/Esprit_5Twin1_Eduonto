import { useEffect, useState } from "react";
import { api } from "../api.js";
import ResultTable from "../components/ResultTable.jsx";

// Module IA : question en français -> spaCy (+ Hugging Face en option) -> SPARQL -> résultats.
// Chaque membre ajoute ici 1 ou 2 exemples de questions pour ses classes.
const EXEMPLES = [
  "Quelle est la formation d'Ahmed ?",                                   // M1
  "Quels sont les prérequis d'Angular ?",                                // M2
  "Quelles compétences requiert le métier de développeur full-stack ?",  // M3
  "Quelles compétences manquent à Ahmed ?",                              // M3
  "Quelles évaluations ont une note supérieure à 12 ?",                  // M4
  "Quelle est la moyenne des notes par cours ?",                         // M4
  "Quels badges a obtenu Sarra ?",                                       // M4
  "Quelles sont les notes d'Omar ?",                                      // M4
  "Quelle est la moyenne d'Ahmed ?",                                     // M4
  "Comment se sont passés les examens ?",                                // M4 (repli zero-shot)
  "Quels agents IA sont fiables ?",                                      // M5
  "Quels étudiants sont à risque de décrochage ?",                       // M6
  "Liste les cours",                                                     // commun
];

export default function Assistant() {
  const [question, setQuestion] = useState("");
  const [rep, setRep] = useState(null);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);
  const [sante, setSante] = useState(null);   // modèle spaCy + zero-shot actif (GET /api/health)

  useEffect(() => { api.get("/api/health").then(setSante).catch(() => setSante(null)); }, []);

  async function poser(q = question) {
    if (!q.trim()) return;
    setQuestion(q);
    setErreur("");
    setChargement(true);
    try {
      setRep(await api.ask(q));
    } catch (e) {
      setErreur(e.message);
      setRep(null);
    } finally {
      setChargement(false);
    }
  }

  return (
    <div>
      <h2>Assistant EduOnto · question en langage naturel</h2>
      {sante && (
        <p className="muted">
          Modèle spaCy : <code>{sante.modele_spacy}</code> ·{" "}
          {sante.zero_shot
            ? <span className="badge ok">zero-shot Hugging Face actif</span>
            : <span className="badge">zero-shot inactif (EDUONTO_HF=1 pour l'activer)</span>}
        </p>
      )}
      <div className="row">
        <input className="grow" value={question} onChange={(e) => setQuestion(e.target.value)}
               onKeyDown={(e) => e.key === "Enter" && poser()} placeholder="Posez une question sur l'ontologie…" />
        <button className="primary" onClick={() => poser()} disabled={chargement}>
          {chargement ? "…" : "Demander"}
        </button>
      </div>
      <div className="chips">
        {EXEMPLES.map((q) => <button key={q} className="chip" onClick={() => poser(q)}>{q}</button>)}
      </div>
      {erreur && <p className="error">{erreur}</p>}

      {rep && (
        <div className="grid2">
          <div className="card">
            <h4>Analyse NLP</h4>
            <p><b>Intention :</b> {rep.intention ?? "non reconnue"} {rep.membre ? `(membre ${rep.membre})` : ""}</p>
            <p><b>Méthode :</b> {rep.methode} · <b>modèle spaCy :</b> {rep.modele_spacy}</p>
            <p><b>Entités reconnues :</b></p>
            <ResultTable rows={rep.entites} />
            <p><b>Paramètres :</b> <code>{JSON.stringify(rep.parametres)}</code></p>
            {rep.methode?.startsWith("zero-shot") && rep.scores_zero_shot?.length > 0 && (
              <>
                <p><b>Scores zero-shot (3 meilleures intentions) :</b></p>
                <ResultTable rows={rep.scores_zero_shot} />
              </>
            )}
          </div>
          <div className="card">
            <h4>Requête SPARQL générée</h4>
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
