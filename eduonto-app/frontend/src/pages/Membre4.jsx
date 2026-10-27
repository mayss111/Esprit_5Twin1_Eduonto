import { useEffect, useState } from "react";
import { Award, BadgeCheck, ChartColumn, ClipboardCheck, Database, Gauge, Layers, PenLine, Search, TimerOff } from "lucide-react";
import { api } from "../api.js";
import Champ from "../components/Champ.jsx";
import ClassePage from "../components/ClassePage.jsx";
import QueryCard from "../components/QueryCard.jsx";
import ResultTable from "../components/ResultTable.jsx";
import Section from "../components/Section.jsx";
import StatCard from "../components/StatCard.jsx";
import { useToast } from "../components/Toast.jsx";
import { choix, decimal, identifiant, invalide } from "../validation.js";

// MEMBRE 4 — Evaluation + PreuveDeCompetence
const CLASSES = ["Evaluation", "PreuveDeCompetence"];
const TYPES = ["ExamenEcrit", "ExamenPratique", "QCM", "DevoirSurveille", "MiniProjet", "ExposeOral", "ProjetIntegre"];

export default function Membre4() {
  const [classe, setClasse] = useState(CLASSES[0]);
  const [version, setVersion] = useState(0);   // incrémenté après chaque modification -> rafraîchit les blocs
  const rafraichir = () => setVersion((v) => v + 1);

  return (
    <div>
      <ChiffresCles version={version} />

      <Section icone={ChartColumn} titre="Tableau de bord des notes">
        <div className="grid2" style={{ marginTop: 0 }}>
          <Statistiques version={version} />
          <SaisieNote onCree={rafraichir} />
        </div>
      </Section>

      <Section icone={Award} titre="Preuves de compétence">
        <Preuves version={version} onChange={rafraichir} />
      </Section>

      <Section icone={Layers} titre="Gestion des individus (CRUD)">
        <div className="tabs">
          {CLASSES.map((c) => (
            <button key={c} className={c === classe ? "active" : ""} onClick={() => setClasse(c)}>{c}</button>
          ))}
        </div>
        <ClassePage key={`${classe}-${version}`} classe={classe} />
      </Section>

      <Section icone={Database} titre="Requêtes SPARQL">
      <QueryCard titre="Évaluations au-dessus d'une note (FILTER)" url="/api/m4/evaluations" query={{ noteMin: 12 }} />
      <QueryCard titre="Évaluations d'une session (Principale / Rattrapage)" url="/api/m4/evaluations/session/{session}" params={{ session: "Rattrapage" }} />
      <QueryCard titre="Moyenne pondérée par étudiant (SUM coef / GROUP BY)" url="/api/m4/moyennes-ponderees" query={{ etudiant: "" }} />
      <QueryCard titre="Relevé de notes d'un étudiant (mention calculée par BIND + IF)" url="/api/m4/etudiants/{etudiant}/releve" params={{ etudiant: "Ahmed" }} />
      <QueryCard titre="Recherche de preuves (CONTAINS)" url="/api/m4/preuves" query={{ recherche: "esprit" }} />
      <QueryCard titre="Preuves expirées (date < aujourd'hui)" url="/api/m4/preuves-expirees" />
      <QueryCard titre="Compétences certifiées" url="/api/m4/competences-certifiees" />
      </Section>
    </div>
  );
}

// ---------- Chiffres clés (routes existantes du membre 4) ----------
function ChiffresCles({ version }) {
  const [c, setC] = useState(null);
  useEffect(() => {
    Promise.all([api.get("/api/m4/evaluations"), api.get("/api/m4/preuves"), api.get("/api/m4/preuves-expirees")])
      .then(([evals, preuves, expirees]) => {
        const notes = [...new Map(evals.map((e) => [e.evaluation, Number(e.note)])).values()];
        setC({ evaluations: notes.length,
               moyenne: notes.length ? (notes.reduce((t, n) => t + n, 0) / notes.length).toFixed(2).replace(".", ",") : "—",
               verifiees: preuves.filter((p) => p.verifiee).length, preuves: preuves.length, expirees: expirees.length });
      })
      .catch(() => setC({}));
  }, [version]);
  return (
    <div className="grille-stats">
      <StatCard icone={ClipboardCheck} valeur={c?.evaluations} libelle="évaluations" chargement={!c} />
      <StatCard icone={Gauge} valeur={c?.moyenne} libelle="moyenne générale /20" ton="ok" chargement={!c} />
      <StatCard icone={BadgeCheck} valeur={c && `${c.verifiees}/${c.preuves}`} libelle="preuves vérifiées" ton="deduit" chargement={!c} />
      <StatCard icone={TimerOff} valeur={c?.expirees} libelle="preuves expirées" ton="danger" chargement={!c} />
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
  const [erreurs, setErreurs] = useState({});
  const [soumis, setSoumis] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.individus("Etudiant").then(setEtudiants);
    api.individus("Cours").then(setCours);
  }, []);

  function regles(donnees) {
    return {
      etudiant: choix(donnees.etudiant, etudiants.map((x) => x.individu), "L'étudiant"),
      cours: choix(donnees.cours, cours.map((x) => x.individu), "Le cours"),
      type: choix(donnees.type, TYPES, "Le type"),
      note: decimal(donnees.note, { min: 0, max: 20, libelle: "La note" }),
      coefficient: decimal(donnees.coefficient, { minExclusif: 0, libelle: "Le coefficient" }),
      session: choix(donnees.session, ["Principale", "Rattrapage"], "La session"),
      id: identifiant(donnees.id, { obligatoire: false }),
    };
  }

  function maj(k, valeur) {
    const suivant = { ...f, [k]: valeur };
    setF(suivant);
    if (soumis) setErreurs(regles(suivant));
  }

  async function envoyer(e) {
    e.preventDefault();
    const eurs = regles(f);
    setErreurs(eurs);
    setSoumis(true);
    if (invalide(eurs)) return;
    try {
      const id = f.id.trim() || `${f.type}_${f.cours}_${f.etudiant}`;
      await api.post("/api/m4/evaluations", { ...f, id, note: Number(f.note), coefficient: Number(f.coefficient) });
      toast.succes(`${id} enregistrée`);
      setF(vide);
      setErreurs({});
      setSoumis(false);
      onCree();
    } catch (err) {
      toast.erreur(err.message);
    }
  }

  return (
    <form className="card" onSubmit={envoyer} noValidate>
      <h4><PenLine size={16} style={{ verticalAlign: "-3px" }} /> Saisir une note</h4>
      <div className="row">
        <Champ label="Étudiant" erreur={erreurs.etudiant}>
          <select value={f.etudiant} onChange={(e) => maj("etudiant", e.target.value)} aria-invalid={!!erreurs.etudiant}>
            <option value="">—</option>
            {etudiants.map((x) => <option key={x.individu}>{x.individu}</option>)}
          </select>
        </Champ>
        <Champ label="Cours" erreur={erreurs.cours}>
          <select value={f.cours} onChange={(e) => maj("cours", e.target.value)} aria-invalid={!!erreurs.cours}>
            <option value="">—</option>
            {cours.map((x) => <option key={x.individu}>{x.individu}</option>)}
          </select>
        </Champ>
        <Champ label="Type" erreur={erreurs.type}>
          <select value={f.type} onChange={(e) => maj("type", e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        </Champ>
      </div>
      <div className="row">
        <Champ label="Note /20" erreur={erreurs.note} aide="Entre 0 et 20">
          <input type="number" min="0" max="20" step="0.25" value={f.note} onChange={(e) => maj("note", e.target.value)} aria-invalid={!!erreurs.note} />
        </Champ>
        <Champ label="Coefficient" erreur={erreurs.coefficient} aide="Strictement positif">
          <input type="number" min="0.5" step="0.5" value={f.coefficient} onChange={(e) => maj("coefficient", e.target.value)} aria-invalid={!!erreurs.coefficient} />
        </Champ>
        <Champ label="Session" erreur={erreurs.session}>
          <select value={f.session} onChange={(e) => maj("session", e.target.value)}><option>Principale</option><option>Rattrapage</option></select>
        </Champ>
      </div>
      <Champ label="Identifiant (optionnel)" erreur={erreurs.id} aide="Lettres, chiffres et _">
        <input placeholder="généré automatiquement" value={f.id} onChange={(e) => maj("id", e.target.value)} aria-invalid={!!erreurs.id} />
      </Champ>
      <button className="primary" type="submit">Enregistrer</button>
      <p className="muted">INSERT DATA : l'évaluation + aPasse (étudiant) + estEvaluePar (cours)</p>
    </form>
  );
}

// ---------- UPDATE spécifique : vérifier une preuve -> la compétence devient certifiée ----------
function Preuves({ version, onChange }) {
  const [preuves, setPreuves] = useState([]);
  const [recherche, setRecherche] = useState("");
  const toast = useToast();

  const charger = () =>
    api.get(`/api/m4/preuves${recherche ? `?recherche=${encodeURIComponent(recherche)}` : ""}`).then(setPreuves);
  useEffect(() => { charger(); }, [version]);

  async function verifier(id) {
    try {
      await api.put(`/api/m4/preuves/${id}/verifier`);
      toast.succes(`${id} vérifiée : sa compétence devient certifiée`);
      onChange();
    } catch (err) {
      toast.erreur(err.message);
    }
  }

  return (
    <div className="card">
      <div className="barre-outils">
        <label className="champ-recherche">
          <Search size={16} />
          <input placeholder="Rechercher (étudiant, émetteur, compétence…)" value={recherche} aria-label="Rechercher une preuve"
                 onChange={(e) => setRecherche(e.target.value)} onKeyDown={(e) => e.key === "Enter" && charger()} />
        </label>
        <button onClick={charger}>Rechercher</button>
      </div>
      <ResultTable
        rows={preuves}
        actions={(p) =>
          p.verifiee ? <span className="badge ok"><BadgeCheck size={13} /> vérifiée</span>
                     : <button className="small primary" onClick={() => verifier(p.preuve)}>Vérifier</button>}
      />
    </div>
  );
}
