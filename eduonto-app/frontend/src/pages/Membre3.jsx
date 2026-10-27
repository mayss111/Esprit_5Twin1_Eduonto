import { useEffect, useState } from "react";
import { api } from "../api.js";
import ClassePage from "../components/ClassePage.jsx";
import QueryCard from "../components/QueryCard.jsx";
import Membre3Insights from "../components/Membre3Insights.jsx";

// MEMBRE 3 — Competence + Metier
const CLASSES = ["Competence", "Metier"];
const NIVEAUX = ["Licence", "Master", "Ingénieur", "Doctorat"];

export default function Membre3() {
  const [classe, setClasse] = useState(CLASSES[0]);
  const [version, setVersion] = useState(0);   // incrémentée après une création / modification : recharge le graphique
  return (
    <div>
      <h2>Membre 3 · Competence + Metier</h2>
      <div className="tabs">
        {CLASSES.map((c) => (
          <button key={c} className={c === classe ? "active" : ""} onClick={() => setClasse(c)}>{c}</button>
        ))}
      </div>
      <ClassePage classe={classe} />

      <Membre3Insights />

      <GraphiqueCompetences version={version} />

      <div className="split">
        <CreationMetier onChange={() => setVersion((v) => v + 1)} version={version} />
        <CompetenceMetier onChange={() => setVersion((v) => v + 1)} version={version} />
      </div>

      <h3>Requêtes SPARQL spécifiques</h3>
      <QueryCard titre="Compétences requises par un métier" url="/api/m3/metiers/{metier}/competences" params={{"metier": "DeveloppeurFullStack"}} />
      <QueryCard titre="Compétences manquantes d'un étudiant" url="/api/m3/etudiants/{etudiant}/competences-manquantes" params={{"etudiant": "Ahmed"}} />
      <QueryCard titre="Métiers en tension" url="/api/m3/metiers-en-tension" />
      <QueryCard titre="Cours qui développent une compétence" url="/api/m3/competences/{competence}/cours" params={{"competence": "DeveloppementFrontend"}} />
      <QueryCard titre="Métiers accessibles selon le niveau d'études (Licence, Master, Ingénieur, Doctorat)" url="/api/m3/metiers/niveau-etudes" query={{"niveau": "Master"}} />
      <QueryCard titre="Statistiques par métier : compétences requises, étudiants intéressés (COUNT + GROUP BY)" url="/api/m3/statistiques-metiers" />

      <h3>Scénario de recommandation</h3>
      <p className="muted">Pour Ahmed : relier les compétences manquantes de son métier visé aux cours qui les développent.</p>
      <QueryCard titre="Compétences à acquérir et cours conseillés" url="/api/m3/etudiants/{etudiant}/recommandations-competences" params={{"etudiant": "Ahmed"}} />
    </div>
  );
}

// Graphique en barres : nombre de compétences requises par métier (GET /api/m3/statistiques-metiers).
function GraphiqueCompetences({ version }) {
  const [stats, setStats] = useState([]);
  const [erreur, setErreur] = useState("");
  useEffect(() => {
    api.get("/api/m3/statistiques-metiers").then(setStats).catch((e) => setErreur(e.message));
  }, [version]);
  const max = Math.max(1, ...stats.map((s) => s.nbCompetences ?? 0));
  return (
    <section className="card">
      <h3>Compétences requises par métier</h3>
      <p className="muted">Agrégat SPARQL COUNT + GROUP BY. En rouge : métiers en tension.</p>
      {erreur && <p className="error">{erreur}</p>}
      {stats.map((s) => (
        <div className="barre" key={s.metier} title={`${s.nbEtudiants} étudiant(s) visent ce métier`}>
          <span className="barre-label">{s.intituleMetier || s.metier}</span>
          <div className="barre-fond">
            <div className={`barre-valeur ${s.estEnTension ? "ko" : "ok"}`}
                 style={{ width: `${(100 * (s.nbCompetences ?? 0)) / max}%` }} />
          </div>
          <span className="barre-chiffre">{s.nbCompetences} compétence{s.nbCompetences === 1 ? "" : "s"}</span>
        </div>
      ))}
    </section>
  );
}

// Formulaire de création d'un métier (POST /api/m3/metiers) : une seule requête INSERT DATA.
function CreationMetier({ onChange, version }) {
  const vide = { id: "", type: "", intituleMetier: "", codeISCO: "", niveauEtudesRequis: "Ingénieur",
                 estEnTension: false, competences: [] };
  const [form, setForm] = useState(vide);
  const [types, setTypes] = useState([]);
  const [competences, setCompetences] = useState([]);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    api.sousClasses("Metier").then((r) => {
      setTypes(r.map((x) => x.sousClasse));
      setForm((f) => ({ ...f, type: f.type || r[0]?.sousClasse || "" }));
    }).catch((e) => setErreur(e.message));
  }, []);
  useEffect(() => {
    api.individus("Competence").then((r) => setCompetences(r.map((x) => x.individu))).catch((e) => setErreur(e.message));
  }, [version]);

  async function creer(e) {
    e.preventDefault();
    setMessage("");
    setErreur("");
    try {
      const r = await api.post("/api/m3/metiers", { ...form, codeISCO: form.codeISCO || null });
      setMessage(`Métier ${r.cree} créé (${r.competences.length} compétence(s) requise(s)).`);
      setForm({ ...vide, type: form.type });
      onChange();
    } catch (err) {
      setErreur(err.message);
    }
  }

  const maj = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <form className="card" onSubmit={creer}>
      <h4>Créer un métier</h4>
      <code className="url">POST /api/m3/metiers</code>
      <div className="row">
        <label>Identifiant<input value={form.id} onChange={maj("id")} placeholder="IngenieurCloud" required /></label>
        <label>Type
          <select value={form.type} onChange={maj("type")}>
            {types.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
      </div>
      <div className="row">
        <label className="grow">Intitulé<input value={form.intituleMetier} onChange={maj("intituleMetier")} placeholder="Ingénieur cloud" required /></label>
        <label>Code ISCO<input value={form.codeISCO} onChange={maj("codeISCO")} placeholder="2523" /></label>
      </div>
      <div className="row">
        <label>Niveau d'études
          <select value={form.niveauEtudesRequis} onChange={maj("niveauEtudesRequis")}>
            {NIVEAUX.map((n) => <option key={n}>{n}</option>)}
          </select>
        </label>
        <label className="case">
          <input type="checkbox" checked={form.estEnTension}
                 onChange={(e) => setForm({ ...form, estEnTension: e.target.checked })} />
          En tension
        </label>
      </div>
      <label>Compétences requises (Ctrl + clic pour en choisir plusieurs)
        <select multiple size={Math.min(6, Math.max(3, competences.length))} value={form.competences}
                onChange={(e) => setForm({ ...form, competences: [...e.target.selectedOptions].map((o) => o.value) })}>
          {competences.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <button className="primary" type="submit">Créer</button>
      {message && <p className="badge ok">{message}</p>}
      {erreur && <p className="error">{erreur}</p>}
    </form>
  );
}

// Ajouter / retirer une compétence requise (PUT /api/m3/metiers/{id}/competences).
function CompetenceMetier({ onChange, version }) {
  const [metiers, setMetiers] = useState([]);
  const [competences, setCompetences] = useState([]);
  const [form, setForm] = useState({ metier: "", competence: "", action: "ajouter" });
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    Promise.all([api.individus("Metier"), api.individus("Competence")]).then(([m, c]) => {
      setMetiers(m.map((x) => x.individu));
      setCompetences(c.map((x) => x.individu));
      setForm((f) => ({ ...f, metier: f.metier || m[0]?.individu || "", competence: f.competence || c[0]?.individu || "" }));
    }).catch((e) => setErreur(e.message));
  }, [version]);

  async function envoyer(e) {
    e.preventDefault();
    setMessage("");
    setErreur("");
    try {
      const r = await api.put(`/api/m3/metiers/${form.metier}/competences`,
                              { competence: form.competence, action: form.action });
      setMessage(`${r.competence} ${r.action === "ajouter" ? "ajoutée à" : "retirée de"} ${r.metier}.`);
      onChange();
    } catch (err) {
      setErreur(err.message);
    }
  }

  const maj = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <form className="card" onSubmit={envoyer}>
      <h4>Compétences requises d'un métier</h4>
      <code className="url">PUT /api/m3/metiers/{"{id}"}/competences</code>
      <label>Métier
        <select value={form.metier} onChange={maj("metier")}>
          {metiers.map((m) => <option key={m}>{m}</option>)}
        </select>
      </label>
      <label>Compétence
        <select value={form.competence} onChange={maj("competence")}>
          {competences.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <div className="row">
        <label className="case">
          <input type="radio" checked={form.action === "ajouter"} onChange={() => setForm({ ...form, action: "ajouter" })} />
          Ajouter
        </label>
        <label className="case">
          <input type="radio" checked={form.action === "retirer"} onChange={() => setForm({ ...form, action: "retirer" })} />
          Retirer
        </label>
        <button className="primary" type="submit">Appliquer</button>
      </div>
      {message && <p className="badge ok">{message}</p>}
      {erreur && <p className="error">{erreur}</p>}
    </form>
  );
}
