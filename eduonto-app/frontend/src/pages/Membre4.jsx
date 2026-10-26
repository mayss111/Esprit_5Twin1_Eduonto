import { useEffect, useState } from "react";
import { api } from "../api.js";
import ClassePage from "../components/ClassePage.jsx";
import QueryCard from "../components/QueryCard.jsx";
import ResultTable from "../components/ResultTable.jsx";

// MEMBRE 4 — Evaluation + PreuveDeCompetence
const CLASSES = ["Evaluation", "PreuveDeCompetence"];
const TYPES = ["ExamenEcrit", "ExamenPratique", "QCM", "DevoirSurveille", "MiniProjet", "ExposeOral", "ProjetIntegre"];

export default function Membre4() {
  const [classe, setClasse] = useState(CLASSES[0]);
  const [version, setVersion] = useState(0);   // incrémenté après chaque modification -> rafraîchit les blocs
  const rafraichir = () => setVersion((v) => v + 1);

  return (
    <div>
      <h2>Membre 4 · Evaluation + PreuveDeCompetence</h2>

      <h3>Tableau de bord des notes</h3>
      <div className="grid2">
        <Statistiques version={version} />
        <SaisieNote onCree={rafraichir} />
      </div>

      <h3>Preuves de compétence</h3>
      <Preuves version={version} onChange={rafraichir} />

      <h3>Gestion des individus (CRUD)</h3>
      <div className="tabs">
        {CLASSES.map((c) => (
          <button key={c} className={c === classe ? "active" : ""} onClick={() => setClasse(c)}>{c}</button>
        ))}
      </div>
      <ClassePage key={`${classe}-${version}`} classe={classe} />

      <h3>Requêtes SPARQL</h3>
      <QueryCard titre="Évaluations au-dessus d'une note (FILTER)" url="/api/m4/evaluations" query={{ noteMin: 12 }} />
      <QueryCard titre="Évaluations d'une session (Principale / Rattrapage)" url="/api/m4/evaluations/session/{session}" params={{ session: "Rattrapage" }} />
      <QueryCard titre="Moyenne pondérée par étudiant (SUM coef / GROUP BY)" url="/api/m4/moyennes-ponderees" query={{ etudiant: "" }} />
      <QueryCard titre="Relevé de notes d'un étudiant (mention calculée par BIND + IF)" url="/api/m4/etudiants/{etudiant}/releve" params={{ etudiant: "Ahmed" }} />
      <QueryCard titre="Recherche de preuves (CONTAINS)" url="/api/m4/preuves" query={{ recherche: "esprit" }} />
      <QueryCard titre="Preuves expirées (date < aujourd'hui)" url="/api/m4/preuves-expirees" />
      <QueryCard titre="Compétences certifiées" url="/api/m4/competences-certifiees" />
    </div>
  );
}

// ---------- Valeur ajoutée : moyenne par cours en barres (AVG + GROUP BY) ----------
function Statistiques({ version }) {
  const [stats, setStats] = useState([]);
  useEffect(() => { api.get("/api/m4/statistiques").then(setStats); }, [version]);
  return (
    <div className="card">
      <h4>Moyenne par cours /20</h4>
      {stats.map((s) => (
        <div key={s.cours} className="barre">
          <span className="barre-label">{s.cours}</span>
          <div className="barre-fond">
            <div className={`barre-valeur ${s.moyenne >= 10 ? "ok" : "ko"}`} style={{ width: `${(s.moyenne / 20) * 100}%` }} />
          </div>
          <span className="barre-chiffre">{s.moyenne} <small className="muted">({s.nbEvaluations} éval.)</small></span>
        </div>
      ))}
      <p className="muted">Requête : AVG(?note), COUNT, MIN, MAX … GROUP BY ?cours</p>
    </div>
  );
}

// ---------- CREATE spécifique : une note = évaluation + liens étudiant / cours ----------
function SaisieNote({ onCree }) {
  const vide = { id: "", type: "ExamenEcrit", etudiant: "", cours: "", note: "", coefficient: 1, session: "Principale" };
  const [f, setF] = useState(vide);
  const [etudiants, setEtudiants] = useState([]);
  const [cours, setCours] = useState([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.individus("Etudiant").then(setEtudiants);
    api.individus("Cours").then(setCours);
  }, []);

  const champ = (k) => ({ value: f[k], onChange: (e) => setF({ ...f, [k]: e.target.value }) });

  async function envoyer(e) {
    e.preventDefault();
    try {
      const id = f.id || `${f.type}_${f.cours}_${f.etudiant}`;
      await api.post("/api/m4/evaluations", { ...f, id, note: Number(f.note), coefficient: Number(f.coefficient) });
      setMsg(`✔ ${id} enregistrée`);
      setF(vide);
      onCree();
    } catch (err) {
      setMsg(`✘ ${err.message}`);
    }
  }

  return (
    <form className="card" onSubmit={envoyer}>
      <h4>Saisir une note</h4>
      <div className="row">
        <label>Étudiant
          <select required {...champ("etudiant")}>
            <option value="">—</option>
            {etudiants.map((x) => <option key={x.individu}>{x.individu}</option>)}
          </select>
        </label>
        <label>Cours
          <select required {...champ("cours")}>
            <option value="">—</option>
            {cours.map((x) => <option key={x.individu}>{x.individu}</option>)}
          </select>
        </label>
        <label>Type
          <select {...champ("type")}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        </label>
      </div>
      <div className="row">
        <label>Note /20<input required type="number" min="0" max="20" step="0.25" {...champ("note")} /></label>
        <label>Coefficient<input type="number" min="0.5" step="0.5" {...champ("coefficient")} /></label>
        <label>Session
          <select {...champ("session")}><option>Principale</option><option>Rattrapage</option></select>
        </label>
      </div>
      <label>Identifiant (optionnel)<input placeholder="généré automatiquement" {...champ("id")} /></label>
      <button className="primary" type="submit">Enregistrer</button>
      {msg && <p className={msg.startsWith("✔") ? "info" : "error"}>{msg}</p>}
      <p className="muted">INSERT DATA : l'évaluation + aPasse (étudiant) + estEvaluePar (cours)</p>
    </form>
  );
}

// ---------- UPDATE spécifique : vérifier une preuve -> la compétence devient certifiée ----------
function Preuves({ version, onChange }) {
  const [preuves, setPreuves] = useState([]);
  const [recherche, setRecherche] = useState("");

  const charger = () =>
    api.get(`/api/m4/preuves${recherche ? `?recherche=${encodeURIComponent(recherche)}` : ""}`).then(setPreuves);
  useEffect(() => { charger(); }, [version]);

  async function verifier(id) {
    await api.put(`/api/m4/preuves/${id}/verifier`);
    onChange();
  }

  return (
    <div className="card">
      <div className="row">
        <input placeholder="Rechercher (étudiant, émetteur, compétence…)" value={recherche}
               onChange={(e) => setRecherche(e.target.value)} onKeyDown={(e) => e.key === "Enter" && charger()} />
        <button onClick={charger}>Rechercher</button>
      </div>
      <ResultTable
        rows={preuves}
        actions={(p) =>
          p.verifiee ? <span className="badge ok">vérifiée</span>
                     : <button className="small primary" onClick={() => verifier(p.preuve)}>Vérifier</button>}
      />
    </div>
  );
}
