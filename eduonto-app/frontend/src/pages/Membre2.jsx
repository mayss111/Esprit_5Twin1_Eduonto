import { useEffect, useState } from "react";
import { api } from "../api.js";
import ClassePage from "../components/ClassePage.jsx";
import QueryCard from "../components/QueryCard.jsx";

// MEMBRE 2 — Cours + Domaine
const CLASSES = ["Cours", "Domaine"];
const TYPES = ["CoursDeSpecialite", "CoursFondamental", "CoursTransversal", "OptionTechnique", "OptionLibre"];
const NIVEAUX = ["Débutant", "Intermédiaire", "Avancé"];

export default function Membre2() {
  const [classe, setClasse] = useState(CLASSES[0]);
  const [version, setVersion] = useState(0);   // incrémenté après chaque modification -> rafraîchit les blocs
  const rafraichir = () => setVersion((v) => v + 1);

  return (
    <div>
      <h2>Membre 2 · Cours + Domaine</h2>

      <h3>Parcours de prérequis</h3>
      <div className="grid2">
        <CheminPrerequis version={version} />
        <PeutSuivre version={version} />
      </div>

      <h3>Catalogue</h3>
      <div className="grid2">
        <StatistiquesDomaines version={version} />
        <NouveauCours onCree={rafraichir} />
      </div>
      <AjoutPrerequis version={version} onChange={rafraichir} />

      <h3>Gestion des individus (CRUD)</h3>
      <div className="tabs">
        {CLASSES.map((c) => (
          <button key={c} className={c === classe ? "active" : ""} onClick={() => setClasse(c)}>{c}</button>
        ))}
      </div>
      <ClassePage key={`${classe}-${version}`} classe={classe} />

      <h3>Requêtes SPARQL</h3>
      <QueryCard titre="Prérequis directs et indirects (chemin aPourPrerequis+)" url="/api/m2/cours/{cours}/prerequis" params={{ cours: "Angular" }} />
      <QueryCard titre="Cours accessibles ensuite (estPrerequisDe+)" url="/api/m2/cours/{cours}/suite" params={{ cours: "Algorithmique" }} />
      <QueryCard titre="Cours d'une classe de domaine (sous-classes incluses)" url="/api/m2/cours" query={{ domaine: "GenieLogiciel" }} />
      <QueryCard titre="Cours d'un niveau (énumération owl:oneOf)" url="/api/m2/cours/niveau/{niveau}" params={{ niveau: "Avancé" }} />
      <QueryCard titre="Cours d'au moins N crédits (FILTER + ORDER BY)" url="/api/m2/cours/credits" query={{ min: 4 }} />
      <QueryCard titre="Recherche plein texte (intitulé, code, mots-clés du domaine)" url="/api/m2/recherche" query={{ q: "web" }} />
      <QueryCard titre="Statistiques par domaine (COUNT, SUM, AVG)" url="/api/m2/domaines/statistiques" />
      <QueryCard titre="Prérequis non validés par un étudiant (FILTER NOT EXISTS)" url="/api/m2/etudiants/{etudiant}/peut-suivre/{cours}" params={{ etudiant: "Ahmed", cours: "Angular" }} />
    </div>
  );
}

// ---------- Valeur ajoutée : la chaîne prérequis -> cours -> suite, triée par semestre ----------
function CheminPrerequis({ version }) {
  const [cours, setCours] = useState([]);
  const [choix, setChoix] = useState("Angular");
  const [avant, setAvant] = useState([]);
  const [apres, setApres] = useState([]);

  useEffect(() => { api.individus("Cours").then(setCours); }, [version]);
  useEffect(() => {
    api.get(`/api/m2/cours/${choix}/prerequis`).then(setAvant);
    api.get(`/api/m2/cours/${choix}/suite`).then(setApres);
  }, [choix, version]);

  const etape = (nom, sem, style) => (
    <span key={nom} className="badge" style={{ padding: "6px 10px", ...style }}>
      {nom}{sem ? <small> · S{sem}</small> : null}
    </span>
  );

  return (
    <div className="card">
      <h4>Chemin d'apprentissage</h4>
      <label>Cours
        <select value={choix} onChange={(e) => setChoix(e.target.value)}>
          {cours.map((x) => <option key={x.individu}>{x.individu}</option>)}
        </select>
      </label>
      <div className="chips" style={{ alignItems: "center" }}>
        {avant.map((p) => [etape(p.prerequis, p.semestre, { background: "#eef1f6", color: "#374151" }), <span key={`f-${p.prerequis}`}>→</span>])}
        {etape(choix, null, { background: "#2563eb", color: "#fff", fontWeight: 600 })}
        {apres.map((s) => [<span key={`g-${s.coursSuivant}`}>→</span>, etape(s.coursSuivant, s.semestre, { background: "#dcfce7", color: "#166534" })])}
      </div>
      <p className="muted">Gris : prérequis (aPourPrerequis+, transitive). Vert : cours débloqués ensuite (estPrerequisDe+).</p>
    </div>
  );
}

// ---------- Valeur ajoutée : un étudiant peut-il suivre ce cours ? ----------
function PeutSuivre({ version }) {
  const [etudiants, setEtudiants] = useState([]);
  const [cours, setCours] = useState([]);
  const [etu, setEtu] = useState("Ahmed");
  const [c, setC] = useState("Angular");
  const [manquants, setManquants] = useState(null);

  useEffect(() => {
    api.individus("Etudiant").then(setEtudiants);
    api.individus("Cours").then(setCours);
  }, [version]);
  useEffect(() => { api.get(`/api/m2/etudiants/${etu}/peut-suivre/${c}`).then(setManquants); }, [etu, c, version]);

  return (
    <div className="card">
      <h4>Peut-il suivre ce cours ?</h4>
      <div className="row">
        <label>Étudiant
          <select value={etu} onChange={(e) => setEtu(e.target.value)}>
            {etudiants.map((x) => <option key={x.individu}>{x.individu}</option>)}
          </select>
        </label>
        <label>Cours
          <select value={c} onChange={(e) => setC(e.target.value)}>
            {cours.map((x) => <option key={x.individu}>{x.individu}</option>)}
          </select>
        </label>
      </div>
      {manquants && manquants.length === 0 && <p className="badge ok" style={{ fontSize: 14 }}>✔ {etu} a validé tous les prérequis de {c}</p>}
      {manquants && manquants.length > 0 && (
        <div>
          <p className="error">✘ Il manque {manquants.length} prérequis à {etu} :</p>
          <ul>{manquants.map((m) => <li key={m.prerequisManquant}>{m.intitule ?? m.prerequisManquant} (semestre {m.semestre})</li>)}</ul>
        </div>
      )}
      <p className="muted">aPourPrerequis+ … FILTER NOT EXISTS {"{"} étudiant aValide prérequis {"}"}</p>
    </div>
  );
}

// ---------- Agrégats par grand domaine ----------
function StatistiquesDomaines({ version }) {
  const [stats, setStats] = useState([]);
  useEffect(() => { api.get("/api/m2/domaines/statistiques").then(setStats); }, [version]);
  const max = Math.max(1, ...stats.map((s) => s.totalCredits ?? 0));
  return (
    <div className="card">
      <h4>Crédits par grand domaine</h4>
      {stats.map((s) => (
        <div key={s.grandDomaine} className="barre">
          <span className="barre-label">{s.grandDomaine.replace("Domaine", "")}</span>
          <div className="barre-fond">
            <div className="barre-valeur ok" style={{ width: `${((s.totalCredits ?? 0) / max) * 100}%` }} />
          </div>
          <span className="barre-chiffre">{s.totalCredits} cr. <small className="muted">({s.nbCours} cours)</small></span>
        </div>
      ))}
      <p className="muted">COUNT, SUM(?credits), AVG(?heures) … GROUP BY grand domaine (rdfs:subClassOf*)</p>
    </div>
  );
}

// ---------- CREATE spécifique : un cours avec domaine et prérequis ----------
function NouveauCours({ onCree }) {
  const vide = { id: "", intitule: "", code: "", type: TYPES[0], domaine: "", credits: 4, volumeHoraire: 42, niveau: "Intermédiaire", semestre: 1, prerequis: [] };
  const [f, setF] = useState(vide);
  const [domaines, setDomaines] = useState([]);
  const [cours, setCours] = useState([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.individus("Domaine").then(setDomaines);
    api.individus("Cours").then(setCours);
  }, []);
  const champ = (k) => ({ value: f[k], onChange: (e) => setF({ ...f, [k]: e.target.value }) });

  async function envoyer(e) {
    e.preventDefault();
    try {
      await api.post("/api/m2/cours", {
        ...f, code: f.code || null,
        credits: Number(f.credits), volumeHoraire: Number(f.volumeHoraire), semestre: Number(f.semestre),
      });
      setMsg(`✔ ${f.id} créé`);
      setF(vide);
      onCree();
      api.individus("Cours").then(setCours);
    } catch (err) {
      setMsg(`✘ ${err.message}`);
    }
  }

  return (
    <form className="card" onSubmit={envoyer}>
      <h4>Créer un cours</h4>
      <div className="row">
        <label>Identifiant<input required placeholder="ex. React" {...champ("id")} /></label>
        <label>Intitulé<input required {...champ("intitule")} /></label>
        <label>Code<input placeholder="WEB302" {...champ("code")} /></label>
      </div>
      <div className="row">
        <label>Type<select {...champ("type")}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
        <label>Domaine
          <select required {...champ("domaine")}>
            <option value="">—</option>
            {domaines.map((x) => <option key={x.individu}>{x.individu}</option>)}
          </select>
        </label>
        <label>Niveau<select {...champ("niveau")}>{NIVEAUX.map((n) => <option key={n}>{n}</option>)}</select></label>
      </div>
      <div className="row">
        <label>Crédits<input type="number" min="1" max="10" {...champ("credits")} /></label>
        <label>Heures<input type="number" min="1" {...champ("volumeHoraire")} /></label>
        <label>Semestre<input type="number" min="1" max="10" {...champ("semestre")} /></label>
      </div>
      <label>Prérequis (Ctrl + clic pour en choisir plusieurs)
        <select multiple size={4} value={f.prerequis}
                onChange={(e) => setF({ ...f, prerequis: [...e.target.selectedOptions].map((o) => o.value) })}>
          {cours.map((x) => <option key={x.individu}>{x.individu}</option>)}
        </select>
      </label>
      <button className="primary" type="submit">Créer</button>
      {msg && <p className={msg.startsWith("✔") ? "info" : "error"}>{msg}</p>}
      <p className="muted">INSERT DATA : le cours + appartientADomaine + aPourPrerequis et son inverse estPrerequisDe</p>
    </form>
  );
}

// ---------- UPDATE spécifique : ajouter un prérequis, avec refus des cycles ----------
function AjoutPrerequis({ version, onChange }) {
  const [cours, setCours] = useState([]);
  const [c, setC] = useState("Algorithmique");
  const [p, setP] = useState("Angular");
  const [msg, setMsg] = useState("");

  useEffect(() => { api.individus("Cours").then(setCours); }, [version]);

  async function ajouter() {
    try {
      await api.put(`/api/m2/cours/${c}/prerequis`, { prerequis: p });
      setMsg(`✔ ${p} est maintenant un prérequis de ${c}`);
      onChange();
    } catch (err) {
      setMsg(`✘ ${err.message}`);
    }
  }

  return (
    <div className="card">
      <h4>Ajouter un prérequis (avec détection de cycle)</h4>
      <div className="row">
        <label>Cours
          <select value={c} onChange={(e) => setC(e.target.value)}>
            {cours.map((x) => <option key={x.individu}>{x.individu}</option>)}
          </select>
        </label>
        <span style={{ alignSelf: "center" }}>a pour prérequis</span>
        <label>Prérequis
          <select value={p} onChange={(e) => setP(e.target.value)}>
            {cours.map((x) => <option key={x.individu}>{x.individu}</option>)}
          </select>
        </label>
        <button className="primary" onClick={ajouter}>Ajouter</button>
      </div>
      {msg && <p className={msg.startsWith("✔") ? "info" : "error"}>{msg}</p>}
      <p className="muted">Avant l'INSERT, une requête vérifie que le prérequis ne dépend pas déjà du cours (aPourPrerequis+) : pas de boucle.</p>
    </div>
  );
}
