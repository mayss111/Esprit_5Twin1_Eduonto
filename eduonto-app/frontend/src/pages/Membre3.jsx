import { useEffect, useState } from "react";
import { ChartColumn, Briefcase, Database, Flame, Layers, Lightbulb, Pencil, Plus, Target, Users } from "lucide-react";
import { api } from "../api.js";
import Champ from "../components/Champ.jsx";
import ClassePage from "../components/ClassePage.jsx";
import QueryCard from "../components/QueryCard.jsx";
import Membre3Insights from "../components/Membre3Insights.jsx";
import Section from "../components/Section.jsx";
import StatCard from "../components/StatCard.jsx";
import { useToast } from "../components/Toast.jsx";
import { choix, codeIsco, identifiant, invalide, texteLibre } from "../validation.js";

// MEMBRE 3 — Competence + Metier
const CLASSES = ["Competence", "Metier"];
const NIVEAUX = ["Licence", "Master", "Ingénieur", "Doctorat"];

export default function Membre3() {
  const [classe, setClasse] = useState(CLASSES[0]);
  const [version, setVersion] = useState(0);   // incrémentée après une création / modification : recharge les blocs
  const rafraichir = () => setVersion((v) => v + 1);
  return (
    <div>
      <ChiffresCles version={version} />

      <Section icone={Flame} titre="Vue d'ensemble">
        <Membre3Insights />
      </Section>

      <Section icone={ChartColumn} titre="Compétences requises par métier">
        <GraphiqueCompetences version={version} />
        <div className="split" style={{ marginTop: 16 }}>
          <CreationMetier onChange={rafraichir} version={version} />
          <CompetenceMetier onChange={rafraichir} version={version} />
        </div>
      </Section>

      <Section icone={Layers} titre="Gestion des individus (CRUD)">
        <div className="tabs">
          {CLASSES.map((c) => (
            <button key={c} className={c === classe ? "active" : ""} onClick={() => setClasse(c)}>{c}</button>
          ))}
        </div>
        <ClassePage key={`${classe}-${version}`} classe={classe} />
      </Section>

      <Section icone={Database} titre="Requêtes SPARQL spécifiques">
        <QueryCard titre="Compétences requises par un métier" url="/api/m3/metiers/{metier}/competences" params={{"metier": "DeveloppeurFullStack"}} />
        <QueryCard titre="Compétences manquantes d'un étudiant" url="/api/m3/etudiants/{etudiant}/competences-manquantes" params={{"etudiant": "Ahmed"}} />
        <QueryCard titre="Métiers en tension" url="/api/m3/metiers-en-tension" />
        <QueryCard titre="Cours qui développent une compétence" url="/api/m3/competences/{competence}/cours" params={{"competence": "DeveloppementFrontend"}} />
        <QueryCard titre="Métiers accessibles selon le niveau d'études (Licence, Master, Ingénieur, Doctorat)" url="/api/m3/metiers/niveau-etudes" query={{"niveau": "Master"}} />
        <QueryCard titre="Statistiques par métier : compétences requises, étudiants intéressés (COUNT + GROUP BY)" url="/api/m3/statistiques-metiers" />
      </Section>

      <Section icone={Lightbulb} titre="Scénario de recommandation"
               sousTitre="Pour Ahmed : relier les compétences manquantes de son métier visé aux cours qui les développent.">
        <QueryCard titre="Compétences à acquérir et cours conseillés" url="/api/m3/etudiants/{etudiant}/recommandations-competences" params={{"etudiant": "Ahmed"}} />
      </Section>
    </div>
  );
}

// ---------- Chiffres clés (routes existantes du membre 3) ----------
function ChiffresCles({ version }) {
  const [c, setC] = useState(null);
  useEffect(() => {
    Promise.all([api.get("/api/m3/statistiques-metiers"), api.individus("Competence")])
      .then(([metiers, competences]) => setC({
        metiers: metiers.length, tension: metiers.filter((m) => m.estEnTension).length, competences: competences.length,
        etudiants: metiers.reduce((t, m) => t + (m.nbEtudiants ?? 0), 0),
      }))
      .catch(() => setC({}));
  }, [version]);
  return (
    <div className="grille-stats">
      <StatCard icone={Briefcase} valeur={c?.metiers} libelle="métiers" chargement={!c} />
      <StatCard icone={Flame} valeur={c?.tension} libelle="métiers en tension" ton="danger" chargement={!c} />
      <StatCard icone={Target} valeur={c?.competences} libelle="compétences" ton="ok" chargement={!c} />
      <StatCard icone={Users} valeur={c?.etudiants} libelle="étudiants avec un métier visé" ton="deduit" chargement={!c} />
    </div>
  );
}

// Graphique en barres : nombre de compétences requises par métier (GET /api/m3/statistiques-metiers).
function GraphiqueCompetences({ version }) {
  const [stats, setStats] = useState([]);
  const toast = useToast();
  useEffect(() => {
    api.get("/api/m3/statistiques-metiers").then(setStats).catch((e) => toast.erreur(e.message));
  }, [version]);
  const max = Math.max(1, ...stats.map((s) => s.nbCompetences ?? 0));
  return (
    <div className="card">
      <p className="muted">Agrégat SPARQL COUNT + GROUP BY. En rouge : métiers en tension.</p>
      {stats.map((s) => (
        <div className="barre" key={s.metier} title={`${s.intituleMetier || s.metier} · ${s.nbEtudiants} étudiant(s) visent ce métier`}>
          <span className="barre-label">{s.intituleMetier || s.metier}</span>
          <div className="barre-fond">
            <div className={`barre-valeur ${s.estEnTension ? "ko" : "ok"}`}
                 style={{ width: `${(100 * (s.nbCompetences ?? 0)) / max}%` }} />
          </div>
          <span className="barre-chiffre">{s.nbCompetences} comp.</span>
        </div>
      ))}
    </div>
  );
}

// Formulaire de création d'un métier (POST /api/m3/metiers) : une seule requête INSERT DATA.
function CreationMetier({ onChange, version }) {
  const vide = { id: "", type: "", intituleMetier: "", codeISCO: "", niveauEtudesRequis: "Ingénieur",
                 estEnTension: false, competences: [] };
  const [form, setForm] = useState(vide);
  const [types, setTypes] = useState([]);
  const [competences, setCompetences] = useState([]);
  const [erreurs, setErreurs] = useState({});
  const [soumis, setSoumis] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.sousClasses("Metier").then((r) => {
      setTypes(r.map((x) => x.sousClasse));
      setForm((f) => ({ ...f, type: f.type || r[0]?.sousClasse || "" }));
    }).catch((e) => toast.erreur(e.message));
  }, []);
  useEffect(() => {
    api.individus("Competence").then((r) => setCompetences(r.map((x) => x.individu))).catch((e) => toast.erreur(e.message));
  }, [version]);

  function regles(donnees) {
    return {
      id: identifiant(donnees.id),
      type: choix(donnees.type, types, "Le type"),
      intituleMetier: texteLibre(donnees.intituleMetier, { libelle: "L'intitulé" }),
      codeISCO: codeIsco(donnees.codeISCO),
      niveauEtudesRequis: choix(donnees.niveauEtudesRequis, NIVEAUX, "Le niveau d'études"),
    };
  }

  function majValeur(k, valeur) {
    const suivant = { ...form, [k]: valeur };
    setForm(suivant);
    if (soumis) setErreurs(regles(suivant));
  }

  async function creer(e) {
    e.preventDefault();
    const eurs = regles(form);
    setErreurs(eurs);
    setSoumis(true);
    if (invalide(eurs)) return;
    try {
      const r = await api.post("/api/m3/metiers", {
        ...form, id: form.id.trim(), intituleMetier: form.intituleMetier.trim(),
        codeISCO: form.codeISCO.trim() || null,
      });
      toast.succes(`Métier ${r.cree} créé (${r.competences.length} compétence(s) requise(s)).`);
      setForm({ ...vide, type: form.type });
      setErreurs({});
      setSoumis(false);
      onChange();
    } catch (err) {
      toast.erreur(err.message);
    }
  }

  return (
    <form className="card" onSubmit={creer} noValidate>
      <h4><Plus size={16} style={{ verticalAlign: "-3px" }} /> Créer un métier</h4>
      <code className="url">POST /api/m3/metiers</code>
      <div className="form-grille">
        <Champ label="Identifiant" erreur={erreurs.id} aide="Sans espace ni accent">
          <input value={form.id} onChange={(e) => majValeur("id", e.target.value)} placeholder="IngenieurCloud" aria-invalid={!!erreurs.id} />
        </Champ>
        <Champ label="Type" erreur={erreurs.type}>
          <select value={form.type} onChange={(e) => majValeur("type", e.target.value)} aria-invalid={!!erreurs.type}>
            {types.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Champ>
        <Champ label="Intitulé" erreur={erreurs.intituleMetier}>
          <input value={form.intituleMetier} onChange={(e) => majValeur("intituleMetier", e.target.value)} placeholder="Ingénieur cloud" aria-invalid={!!erreurs.intituleMetier} />
        </Champ>
        <Champ label="Code ISCO" erreur={erreurs.codeISCO} aide="Optionnel, 4 chiffres">
          <input value={form.codeISCO} onChange={(e) => majValeur("codeISCO", e.target.value)} placeholder="2523" inputMode="numeric" aria-invalid={!!erreurs.codeISCO} />
        </Champ>
        <Champ label="Niveau d'études" erreur={erreurs.niveauEtudesRequis}>
          <select value={form.niveauEtudesRequis} onChange={(e) => majValeur("niveauEtudesRequis", e.target.value)}>
            {NIVEAUX.map((n) => <option key={n}>{n}</option>)}
          </select>
        </Champ>
        <label className="case" style={{ alignSelf: "end", marginBottom: 20 }}>
          <input type="checkbox" checked={form.estEnTension}
                 onChange={(e) => setForm({ ...form, estEnTension: e.target.checked })} />
          En tension
        </label>
        <label className="plein">Compétences requises (Ctrl + clic pour en choisir plusieurs)
          <select multiple size={Math.min(6, Math.max(3, competences.length))} value={form.competences}
                  onChange={(e) => setForm({ ...form, competences: [...e.target.selectedOptions].map((o) => o.value) })}>
            {competences.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
      </div>
      <button className="primary" type="submit"><Plus size={16} /> Créer</button>
    </form>
  );
}

// Ajouter / retirer une compétence requise (PUT /api/m3/metiers/{id}/competences).
function CompetenceMetier({ onChange, version }) {
  const [metiers, setMetiers] = useState([]);
  const [competences, setCompetences] = useState([]);
  const [form, setForm] = useState({ metier: "", competence: "", action: "ajouter" });
  const toast = useToast();

  useEffect(() => {
    Promise.all([api.individus("Metier"), api.individus("Competence")]).then(([m, c]) => {
      setMetiers(m.map((x) => x.individu));
      setCompetences(c.map((x) => x.individu));
      setForm((f) => ({ ...f, metier: f.metier || m[0]?.individu || "", competence: f.competence || c[0]?.individu || "" }));
    }).catch((e) => toast.erreur(e.message));
  }, [version]);

  async function envoyer(e) {
    e.preventDefault();
    if (!form.metier || !form.competence) {
      toast.erreur("Choisissez un métier et une compétence.");
      return;
    }
    try {
      const r = await api.put(`/api/m3/metiers/${form.metier}/competences`,
                              { competence: form.competence, action: form.action });
      toast.succes(`${r.competence} ${r.action === "ajouter" ? "ajoutée à" : "retirée de"} ${r.metier}.`);
      onChange();
    } catch (err) {
      toast.erreur(err.message);
    }
  }

  const maj = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <form className="card" onSubmit={envoyer}>
      <h4><Pencil size={16} style={{ verticalAlign: "-3px" }} /> Compétences requises d'un métier</h4>
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
      <fieldset className="row" style={{ border: 0, padding: 0, margin: "0 0 12px", alignItems: "center" }}>
        <legend className="sr-only">Action</legend>
        <label className="case">
          <input type="radio" name="action-competence" checked={form.action === "ajouter"} onChange={() => setForm({ ...form, action: "ajouter" })} />
          Ajouter
        </label>
        <label className="case">
          <input type="radio" name="action-competence" checked={form.action === "retirer"} onChange={() => setForm({ ...form, action: "retirer" })} />
          Retirer
        </label>
      </fieldset>
      <button className="primary" type="submit">Appliquer</button>
    </form>
  );
}
