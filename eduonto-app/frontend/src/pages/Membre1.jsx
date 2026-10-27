import { useEffect, useState } from "react";
import { api } from "../api.js";
import ClassePage from "../components/ClassePage.jsx";
import QueryCard from "../components/QueryCard.jsx";

// MEMBRE 1 — Personne + Formation
const CLASSES = ["Personne", "Formation"];

export default function Membre1() {
  const [classe, setClasse] = useState(CLASSES[0]);
  const [version, setVersion] = useState(0);   // incrémenté après chaque modification -> rafraîchit les blocs
  const rafraichir = () => setVersion((v) => v + 1);

  return (
    <div>
      <h2>Membre 1 · Personne + Formation</h2>

      <h3>Tableau de bord des formations</h3>
      <div className="grid2">
        <StatistiquesFormations version={version} />
        <Inscription onCree={rafraichir} />
      </div>

      <h3>Profil d'un étudiant (raisonnement)</h3>
      <ProfilEtudiant version={version} onChange={rafraichir} />

      <h3>Gestion des individus (CRUD)</h3>
      <div className="tabs">
        {CLASSES.map((c) => (
          <button key={c} className={c === classe ? "active" : ""} onClick={() => setClasse(c)}>{c}</button>
        ))}
      </div>
      <ClassePage key={`${classe}-${version}`} classe={classe} />

      <h3>Requêtes SPARQL</h3>
      <QueryCard titre="Étudiants par année (FILTER numérique)" url="/api/m1/etudiants" query={{ annee: 4 }} />
      <QueryCard titre="Formation d'un étudiant (jointure)" url="/api/m1/etudiants/{etudiant}/formation" params={{ etudiant: "Ahmed" }} />
      <QueryCard titre="Classes affirmées / déduites d'un étudiant (owl:equivalentClass)" url="/api/m1/etudiants/{etudiant}/profil" params={{ etudiant: "Omar" }} />
      <QueryCard titre="Étudiants boursiers (FILTER booléen)" url="/api/m1/boursiers" query={{ formation: "" }} />
      <QueryCard titre="Enseignants par spécialité (CONTAINS + GROUP_CONCAT)" url="/api/m1/enseignants" query={{ specialite: "web" }} />
      <QueryCard titre="Étudiants d'une formation" url="/api/m1/formations/{formation}/etudiants" params={{ formation: "Ingenieur_TWIN" }} />
      <QueryCard titre="Statistiques par formation (COUNT, SUM(IF), sous-requêtes)" url="/api/m1/formations/statistiques" />
      <QueryCard titre="Encadrements (relation + inverse, UNION)" url="/api/m1/encadrements" />
    </div>
  );
}

// ---------- Valeur ajoutée : effectifs et taux de boursiers par formation ----------
function StatistiquesFormations({ version }) {
  const [stats, setStats] = useState([]);
  useEffect(() => { api.get("/api/m1/formations/statistiques").then(setStats); }, [version]);
  const max = Math.max(1, ...stats.map((s) => s.nbEtudiants));
  return (
    <div className="card">
      <h4>Étudiants par formation</h4>
      {stats.map((s) => (
        <div key={s.formation} className="barre" title={s.intitule}>
          <span className="barre-label">{s.formation}</span>
          <div className="barre-fond">
            <div className="barre-valeur ok" style={{ width: `${(s.nbEtudiants / max) * 100}%` }} />
          </div>
          <span className="barre-chiffre">
            {s.nbEtudiants} <small className="muted">({s.tauxBoursiers}% bours.)</small>
          </span>
        </div>
      ))}
      <p className="muted">COUNT(DISTINCT ?etudiant), SUM(IF(?boursier, 1, 0)) … GROUP BY ?formation</p>
    </div>
  );
}

// ---------- CREATE spécifique : inscription d'un étudiant ----------
function Inscription({ onCree }) {
  const vide = { prenom: "", nom: "", email: "", formation: "", annee: 1, boursier: false };
  const [f, setF] = useState(vide);
  const [formations, setFormations] = useState([]);
  const [msg, setMsg] = useState("");

  useEffect(() => { api.individus("Formation").then(setFormations); }, []);
  const champ = (k) => ({ value: f[k], onChange: (e) => setF({ ...f, [k]: e.target.value }) });

  // Identifiant sans accent ni espace, construit à partir du prénom et du nom : « Rim Saïdi » -> Rim_Saidi
  const identifiant = `${f.prenom}_${f.nom}`
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9_]/g, "");

  async function envoyer(e) {
    e.preventDefault();
    try {
      const r = await api.post("/api/m1/etudiants", {
        ...f, id: identifiant, annee: Number(f.annee), email: f.email || null,
      });
      setMsg(`✔ ${r.cree} inscrit (matricule ${r.matricule})`);
      setF(vide);
      onCree();
    } catch (err) {
      setMsg(`✘ ${err.message}`);
    }
  }

  return (
    <form className="card" onSubmit={envoyer}>
      <h4>Inscrire un étudiant</h4>
      <div className="row">
        <label>Prénom<input required {...champ("prenom")} /></label>
        <label>Nom<input required {...champ("nom")} /></label>
      </div>
      <div className="row">
        <label>Formation
          <select required {...champ("formation")}>
            <option value="">—</option>
            {formations.map((x) => <option key={x.individu}>{x.individu}</option>)}
          </select>
        </label>
        <label>Année<input type="number" min="1" max="5" {...champ("annee")} /></label>
        <label style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={f.boursier} onChange={(e) => setF({ ...f, boursier: e.target.checked })} />
          Boursier
        </label>
      </div>
      <label>Email (optionnel)<input type="email" {...champ("email")} /></label>
      <button className="primary" type="submit" disabled={!identifiant || identifiant === "_"}>
        Inscrire {identifiant !== "_" ? identifiant : ""}
      </button>
      {msg && <p className={msg.startsWith("✔") ? "info" : "error"}>{msg}</p>}
      <p className="muted">INSERT DATA : l'étudiant + inscritA (formation) + matricule et date générés</p>
    </form>
  );
}

// ---------- Raisonnement visible + UPDATE : affecter un encadrant ----------
function ProfilEtudiant({ version, onChange }) {
  const [etudiants, setEtudiants] = useState([]);
  const [enseignants, setEnseignants] = useState([]);
  const [choix, setChoix] = useState("Omar");
  const [classes, setClasses] = useState([]);
  const [encadrant, setEncadrant] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.individus("Etudiant").then(setEtudiants);
    api.get("/api/m1/enseignants").then(setEnseignants);
  }, [version]);

  useEffect(() => {
    if (!choix) return;
    api.get(`/api/m1/etudiants/${choix}/profil`).then(setClasses);
    api.get("/api/m1/encadrements").then((rows) => {
      const e = rows.find((r) => r.etudiant === choix);
      setEncadrant(e ? e.enseignant : "");
    });
  }, [choix, version]);

  async function affecter(prof) {
    try {
      await api.put(`/api/m1/etudiants/${choix}/encadrant`, { encadrant: prof });
      setMsg(`✔ ${prof} encadre maintenant ${choix}`);
      onChange();
    } catch (err) {
      setMsg(`✘ ${err.message}`);
    }
  }

  return (
    <div className="card">
      <div className="row">
        <label>Étudiant
          <select value={choix} onChange={(e) => { setChoix(e.target.value); setMsg(""); }}>
            {etudiants.map((x) => <option key={x.individu}>{x.individu}</option>)}
          </select>
        </label>
        <label>Encadrant
          <select value={encadrant} onChange={(e) => affecter(e.target.value)}>
            <option value="">— aucun —</option>
            {enseignants.map((x) => <option key={x.enseignant} value={x.enseignant}>{x.prenom} {x.nom} ({x.grade})</option>)}
          </select>
        </label>
      </div>
      <div className="chips">
        {classes.map((c) => (
          <span key={c.classe} className="badge" title={c.origine}
                style={c.origine === "affirmée"
                  ? { background: "#e8efff", color: "#1d4ed8" }
                  : { background: "#fef3c7", color: "#92400e" }}>
            {c.classe} · {c.origine}
          </span>
        ))}
      </div>
      {msg && <p className={msg.startsWith("✔") ? "info" : "error"}>{msg}</p>}
      <p className="muted">
        En jaune : classes définies (≡) remplies par le raisonneur HermiT, ex. EtudiantOption, EtudiantARisque.
        L'affectation met à jour estEncadrePar ET son inverse encadre (DELETE / INSERT).
      </p>
    </div>
  );
}
