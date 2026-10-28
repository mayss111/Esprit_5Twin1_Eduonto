import { useEffect, useState } from "react";
import {
  Activity, Compass, Database, Gauge, Layers, LogIn, Pencil, Plus, Route, Search, TriangleAlert, Users,
} from "lucide-react";
import { api } from "../api.js";
import Champ from "../components/Champ.jsx";
import ClassePage from "../components/ClassePage.jsx";
import EmptyState from "../components/EmptyState.jsx";
import QueryCard from "../components/QueryCard.jsx";
import Section from "../components/Section.jsx";
import StatCard from "../components/StatCard.jsx";
import { useToast } from "../components/Toast.jsx";
import { choix, decimal, entier, identifiant, invalide, texteLibre } from "../validation.js";

// MEMBRE 6 — ParcoursApprentissage + IndicateurApprentissage
// Suivi et alertes : chaque indicateur est comparé à son propre seuil, dans le sens donné par sa classe
// (bien-être : valeur haute = alerte ; engagement et performance : valeur basse = alerte).
const CLASSES = ["ParcoursApprentissage", "IndicateurApprentissage"];
const PERIODES = ["Hebdomadaire", "Mensuelle", "Semestrielle"];

const vrai = (v) => v === true || v === "true";
const nombre = (v) => (typeof v === "number" ? v : Number(v));
const pct = (v) => `${Math.round(nombre(v) * 100)} %`;

export default function Membre6() {
  const [classe, setClasse] = useState(CLASSES[0]);
  const [version, setVersion] = useState(0);
  const [etudiant, setEtudiant] = useState("Omar");
  const rafraichir = () => setVersion((v) => v + 1);

  return (
    <div>
      <ChiffresCles version={version} />

      <Section icone={TriangleAlert} titre="Tableau de suivi"
               sousTitre="Alertes calculées en SPARQL ; EtudiantARisque est déduite par HermiT. Cliquez sur un étudiant.">
        <TableauSuivi version={version} choisi={etudiant} onChoix={setEtudiant} />
      </Section>

      <Section icone={Activity} titre={`Suivi de ${etudiant}`}
               sousTitre="Chaque barre montre la valeur ; le trait vertical est le seuil d'alerte de l'indicateur.">
        <div className="split">
          <IndicateursEtudiant etudiant={etudiant} version={version} />
          <Recommandation etudiant={etudiant} version={version} onChange={rafraichir} />
        </div>
      </Section>

      <Section icone={Route} titre="Parcours d'apprentissage"
               sousTitre="Catalogue (COUNT, GROUP_CONCAT) et recherche CONTAINS sur le nom, l'objectif et le code.">
        <CatalogueParcours version={version} />
        <div className="split" style={{ marginTop: 16 }}>
          <CreationParcours onChange={rafraichir} version={version} />
          <Inscription onChange={rafraichir} version={version} />
        </div>
      </Section>

      <Section icone={Gauge} titre="Mesures"
               sousTitre="Créer une mesure (INSERT DATA) ou la mettre à jour (DELETE / INSERT) : l'alerte est recalculée.">
        <div className="split">
          <CreationIndicateur onChange={rafraichir} version={version} />
          <MiseAJourIndicateur onChange={rafraichir} version={version} />
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
        <QueryCard titre="Alertes : chaque indicateur comparé à son propre seuil (IF + EXISTS)" url="/api/m6/alertes" query={{ toutes: false }} />
        <QueryCard titre="Indicateurs d'un étudiant (famille, seuil, alerte)" url="/api/m6/etudiants/{etudiant}/indicateurs" params={{ etudiant: "Omar" }} />
        <QueryCard titre="Classes affirmées / déduites d'un étudiant (owl:equivalentClass)" url="/api/m6/etudiants/{etudiant}/profil-risque" params={{ etudiant: "Omar" }} />
        <QueryCard titre="Parcours conseillé (FILTER NOT EXISTS, note < 10)" url="/api/m6/etudiants/{etudiant}/recommandation" params={{ etudiant: "Omar" }} />
        <QueryCard titre="Étudiants qui suivent un parcours" url="/api/m6/parcours/{parcours}/etudiants" params={{ parcours: "Parcours_FullStack" }} />
        <QueryCard titre="Parcours suivi par un étudiant (cours validés ou non)" url="/api/m6/etudiants/{etudiant}/parcours" params={{ etudiant: "Ahmed" }} />
        <QueryCard titre="Cours d'un parcours" url="/api/m6/parcours/{parcours}/cours" params={{ parcours: "Parcours_FullStack" }} />
        <QueryCard titre="Recherche de parcours (CONTAINS)" url="/api/m6/parcours/recherche" query={{ q: "sql" }} />
        <QueryCard titre="Statistiques par type d'indicateur (AVG, MIN, MAX, SUM)" url="/api/m6/statistiques" />
        <QueryCard titre="Tableau de suivi (sous-requête, COALESCE)" url="/api/m6/suivi" />
        <QueryCard titre="Étudiants à risque (assiduité < seuil)" url="/api/m6/etudiants-a-risque" query={{ seuil: 0.6 }} />
      </Section>
    </div>
  );
}

function ChiffresCles({ version }) {
  const [c, setC] = useState(null);
  useEffect(() => {
    Promise.all([api.get("/api/m6/parcours"), api.get("/api/m6/suivi")])
      .then(([parcours, suivi]) => setC({
        parcours: parcours.length,
        suivis: suivi.filter((s) => s.parcours).length,
        etudiants: suivi.length,
        indicateurs: suivi.reduce((s, e) => s + nombre(e.nbIndicateurs || 0), 0),
        alertes: suivi.reduce((s, e) => s + nombre(e.nbAlertes || 0), 0),
        aRisque: suivi.filter((s) => vrai(s.aRisque)).length,
      }))
      .catch(() => setC({}));
  }, [version]);
  return (
    <div className="grille-stats">
      <StatCard icone={Route} valeur={c?.parcours} libelle="parcours" chargement={!c} />
      <StatCard icone={Users} valeur={c?.suivis} libelle={`étudiants inscrits${c?.etudiants != null ? ` / ${c.etudiants}` : ""}`} ton="ok" chargement={!c} />
      <StatCard icone={TriangleAlert} valeur={c?.alertes} libelle={`alertes sur ${c?.indicateurs ?? "—"} mesures`} ton="danger" chargement={!c} />
      <StatCard icone={Activity} valeur={c?.aRisque} libelle="EtudiantARisque (déduit)" ton="deduit" chargement={!c} />
    </div>
  );
}

function TableauSuivi({ version, choisi, onChoix }) {
  const [rows, setRows] = useState([]);
  const toast = useToast();
  useEffect(() => {
    api.get("/api/m6/suivi").then(setRows).catch((e) => toast.erreur(e.message));
  }, [version]);
  return (
    <div className="card table-wrap">
      <table>
        <thead>
          <tr><th>Étudiant</th><th>Parcours</th><th className="num">Mesures</th><th className="num">Alertes</th><th>Raisonneur</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.etudiant} className={`clickable${r.etudiant === choisi ? " choisi" : ""}`} tabIndex={0}
                onClick={() => onChoix(r.etudiant)} onKeyDown={(e) => e.key === "Enter" && onChoix(r.etudiant)}
                aria-label={`Voir le suivi de ${r.prenom || r.etudiant}`}>
              <td><strong>{r.prenom || r.etudiant}</strong> <span className="muted">{r.nom}</span></td>
              <td>{r.parcours ? <code className="mono">{r.parcours}</code> : <span className="muted">aucun</span>}</td>
              <td className="num">{r.nbIndicateurs}</td>
              <td className="num">
                <span className={`badge ${nombre(r.nbAlertes) > 0 ? "ko" : "ok"}`}>{r.nbAlertes}</span>
              </td>
              <td>{vrai(r.aRisque) ? <span className="badge deduit">EtudiantARisque</span> : <span className="muted">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IndicateursEtudiant({ etudiant, version }) {
  const [rows, setRows] = useState(null);
  const [profil, setProfil] = useState([]);
  const toast = useToast();
  useEffect(() => {
    Promise.all([api.get(`/api/m6/etudiants/${etudiant}/indicateurs`), api.get(`/api/m6/etudiants/${etudiant}/profil-risque`)])
      .then(([i, p]) => { setRows(i); setProfil(p); })
      .catch((e) => toast.erreur(e.message));
  }, [etudiant, version]);
  return (
    <div className="card">
      <h4>Indicateurs</h4>
      <div style={{ marginBottom: 12 }}>
        {profil.map((p) => (
          <span key={p.classe} className={`badge ${p.origine === "affirmée" ? "neutre" : "deduit"}`} title={p.origine}>
            {p.classe}
          </span>
        ))}
      </div>
      {rows && rows.length === 0 && <EmptyState compact titre="Aucune mesure" texte="Ajoutez une mesure dans la section Mesures." />}
      {(rows || []).map((r) => {
        const alerte = vrai(r.alerte);
        return (
          <div key={r.indicateur} style={{ marginBottom: 12 }}>
            <div className="barre" title={`${r.famille} · source : ${r.sourceDonnees || "—"}`}>
              <span className="barre-label">{r.type}</span>
              <div className="barre-fond seuil-conteneur">
                <div className={`barre-valeur ${alerte ? "ko" : "ok"}`} style={{ width: `${Math.max(2, 100 * nombre(r.valeur))}%` }} />
                <span className="barre-seuil" style={{ left: `${100 * nombre(r.seuil)}%` }} aria-hidden="true" />
              </div>
              <span className="barre-chiffre">{pct(r.valeur)}</span>
            </div>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>
              seuil {pct(r.seuil)} · {r.famille === "IndicateurBienEtre" ? "valeur haute = alerte" : "valeur basse = alerte"} ·{" "}
              <span className={`badge ${alerte ? "ko" : "ok"}`}>{alerte ? "alerte" : "normal"}</span>
            </p>
          </div>
        );
      })}
    </div>
  );
}

function Recommandation({ etudiant, version, onChange }) {
  const [rows, setRows] = useState(null);
  const [actuel, setActuel] = useState([]);
  const toast = useToast();
  useEffect(() => {
    Promise.all([api.get(`/api/m6/etudiants/${etudiant}/recommandation`), api.get(`/api/m6/etudiants/${etudiant}/parcours`)])
      .then(([r, p]) => { setRows(r); setActuel([...new Set(p.map((x) => x.parcours))]); })
      .catch((e) => toast.erreur(e.message));
  }, [etudiant, version]);

  async function inscrire(parcours) {
    try {
      await api.put(`/api/m6/etudiants/${etudiant}/parcours`, { parcours });
      toast.succes(`${etudiant} suit maintenant ${parcours}.`);
      onChange();
    } catch (e) {
      toast.erreur(e.message);
    }
  }

  return (
    <div className="card">
      <h4><Compass size={16} style={{ verticalAlign: "-3px" }} /> Parcours conseillé</h4>
      <p className="muted" style={{ marginTop: 0 }}>
        Parcours actuel : {actuel.length ? actuel.map((p) => <code key={p} className="mono">{p}</code>) : "aucun"}
      </p>
      {rows && rows.length === 0 && <EmptyState compact titre="Aucune recommandation" texte="Aucun parcours personnalisé ne correspond." />}
      {(rows || []).map((r) => (
        <div key={r.parcours} className="reco-carte">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
            <strong>{r.nomParcours || r.parcours}</strong>
            <span className="badge neutre">{r.type}</span>
          </div>
          <p className="muted" style={{ margin: "4px 0" }}>Motif : {r.motif}</p>
          <p style={{ margin: "4px 0 8px" }}>Cours visés : {r.coursCibles}</p>
          {vrai(r.dejaSuivi)
            ? <span className="badge ok">déjà suivi</span>
            : <button className="primary" onClick={() => inscrire(r.parcours)}><LogIn size={16} /> Inscrire à ce parcours</button>}
        </div>
      ))}
    </div>
  );
}

function CatalogueParcours({ version }) {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const toast = useToast();
  useEffect(() => {
    const url = q.trim() ? `/api/m6/parcours/recherche?q=${encodeURIComponent(q.trim())}` : "/api/m6/parcours";
    const t = setTimeout(() => api.get(url).then(setRows).catch((e) => toast.erreur(e.message)), 250);
    return () => clearTimeout(t);
  }, [q, version]);
  return (
    <div>
      <label className="champ-recherche" style={{ maxWidth: 360 }}>
        <Search size={15} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un parcours (nom, objectif, code)…"
               aria-label="Rechercher un parcours" />
      </label>
      {rows.length === 0 && <EmptyState compact titre="Aucun parcours" texte="Aucun parcours ne correspond à la recherche." />}
      <div className="parcours-grille">
        {rows.map((p) => (
          <div key={p.parcours} className="card parcours-carte">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
              <strong>{p.nomParcours || p.parcours}</strong>
              <span className={`badge ${p.type === "ParcoursRattrapage" ? "ko" : p.type === "ParcoursExcellence" ? "deduit" : "neutre"}`}>{p.type}</span>
            </div>
            <p className="muted" style={{ margin: "4px 0 8px" }}>
              {p.codeParcours} · {p.dureeSemestres} semestre{nombre(p.dureeSemestres) > 1 ? "s" : ""} · {p.nbEtudiants} étudiant{nombre(p.nbEtudiants) > 1 ? "s" : ""}
            </p>
            {p.objectifParcours && <p style={{ margin: "0 0 8px" }}>{p.objectifParcours}</p>}
            <div>{(p.listeCours || "").split(", ").filter(Boolean).map((c) => <span key={c} className="badge neutre">{c}</span>)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreationParcours({ onChange, version }) {
  const vide = { id: "", type: "", nomParcours: "", codeParcours: "", dureeSemestres: "1", objectifParcours: "", cours: [], formation: "" };
  const [form, setForm] = useState(vide);
  const [types, setTypes] = useState([]);
  const [cours, setCours] = useState([]);
  const [formations, setFormations] = useState([]);
  const [erreurs, setErreurs] = useState({});
  const [soumis, setSoumis] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.sousClasses("ParcoursApprentissage").then((r) => {
      const noms = r.map((x) => x.sousClasse);
      setTypes(noms);
      setForm((f) => ({ ...f, type: f.type || (noms.includes("ParcoursRattrapage") ? "ParcoursRattrapage" : noms[0] || "") }));
    }).catch((e) => toast.erreur(e.message));
  }, []);
  useEffect(() => {
    Promise.all([api.individus("Cours"), api.individus("Formation")]).then(([c, f]) => {
      setCours(c.map((x) => x.individu));
      setFormations(f.map((x) => x.individu));
    }).catch((e) => toast.erreur(e.message));
  }, [version]);

  function regles(d) {
    return {
      id: identifiant(d.id),
      type: choix(d.type, types, "Le type"),
      nomParcours: texteLibre(d.nomParcours, { libelle: "Le nom" }),
      codeParcours: /^[A-Za-z][A-Za-z0-9]{1,11}$/.test(d.codeParcours.trim())
        ? "" : "Code : 2 à 12 lettres ou chiffres, en commençant par une lettre.",
      dureeSemestres: entier(d.dureeSemestres, { min: 1, libelle: "La durée" }),
      objectifParcours: texteLibre(d.objectifParcours, { obligatoire: false, libelle: "L'objectif" }),
      cours: d.cours.length >= 2 ? "" : "Choisissez au moins 2 cours (comprendCours min 2).",
    };
  }

  function maj(k, valeur) {
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
      const r = await api.post("/api/m6/parcours", {
        ...form,
        id: form.id.trim(),
        nomParcours: form.nomParcours.trim(),
        codeParcours: form.codeParcours.trim(),
        dureeSemestres: Number(form.dureeSemestres),
        objectifParcours: form.objectifParcours.trim() || null,
        formation: form.formation || null,
      });
      toast.succes(`Parcours ${r.cree} créé avec ${r.cours.length} cours.`);
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
      <h4><Plus size={16} style={{ verticalAlign: "-3px" }} /> Créer un parcours</h4>
      <code className="url">POST /api/m6/parcours</code>
      <div className="form-grille">
        <Champ label="Identifiant" erreur={erreurs.id} aide="Sans espace ni accent">
          <input value={form.id} onChange={(e) => maj("id", e.target.value)} placeholder="Parcours_Cloud" aria-invalid={!!erreurs.id} />
        </Champ>
        <Champ label="Type" erreur={erreurs.type}>
          <select value={form.type} onChange={(e) => maj("type", e.target.value)}>
            {types.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Champ>
        <Champ label="Nom" erreur={erreurs.nomParcours}>
          <input value={form.nomParcours} onChange={(e) => maj("nomParcours", e.target.value)} placeholder="Parcours Cloud" aria-invalid={!!erreurs.nomParcours} />
        </Champ>
        <Champ label="Code" erreur={erreurs.codeParcours}>
          <input value={form.codeParcours} onChange={(e) => maj("codeParcours", e.target.value)} placeholder="PCLOUD" aria-invalid={!!erreurs.codeParcours} />
        </Champ>
        <Champ label="Durée (semestres)" erreur={erreurs.dureeSemestres}>
          <input type="number" min="1" value={form.dureeSemestres} onChange={(e) => maj("dureeSemestres", e.target.value)} aria-invalid={!!erreurs.dureeSemestres} />
        </Champ>
        <label>Proposé par la formation
          <select value={form.formation} onChange={(e) => maj("formation", e.target.value)}>
            <option value="">— aucune —</option>
            {formations.map((f) => <option key={f}>{f}</option>)}
          </select>
        </label>
        <Champ className="plein" label="Objectif" erreur={erreurs.objectifParcours}>
          <input value={form.objectifParcours} onChange={(e) => maj("objectifParcours", e.target.value)} placeholder="Déployer des applications dans le cloud" />
        </Champ>
        <Champ className="plein" label="Cours (au moins 2)" erreur={erreurs.cours} aide="Ctrl + clic pour en choisir plusieurs">
          <select multiple size={5} value={form.cours} aria-invalid={!!erreurs.cours}
                  onChange={(e) => maj("cours", [...e.target.selectedOptions].map((o) => o.value))}>
            {cours.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Champ>
      </div>
      <button className="primary" type="submit"><Plus size={16} /> Créer</button>
    </form>
  );
}

function Inscription({ onChange, version }) {
  const [etudiants, setEtudiants] = useState([]);
  const [parcours, setParcours] = useState([]);
  const [form, setForm] = useState({ etudiant: "", parcours: "" });
  const toast = useToast();

  useEffect(() => {
    Promise.all([api.individus("Etudiant"), api.individus("ParcoursApprentissage")]).then(([e, p]) => {
      setEtudiants(e.map((x) => x.individu));
      setParcours(p.map((x) => x.individu));
      setForm((f) => ({ etudiant: f.etudiant || e[0]?.individu || "", parcours: f.parcours }));
    }).catch((err) => toast.erreur(err.message));
  }, [version]);

  async function envoyer(e) {
    e.preventDefault();
    if (!form.etudiant) {
      toast.erreur("Choisissez un étudiant.");
      return;
    }
    try {
      const r = await api.put(`/api/m6/etudiants/${form.etudiant}/parcours`, { parcours: form.parcours || null });
      toast.succes(r.parcours ? `${r.etudiant} suit maintenant ${r.parcours}.` : `${r.etudiant} ne suit plus de parcours.`);
      onChange();
    } catch (err) {
      toast.erreur(err.message);
    }
  }

  return (
    <form className="card" onSubmit={envoyer}>
      <h4><LogIn size={16} style={{ verticalAlign: "-3px" }} /> Inscrire un étudiant à un parcours</h4>
      <code className="url">PUT /api/m6/etudiants/{"{etudiant}"}/parcours</code>
      <div className="form-grille">
        <label>Étudiant
          <select value={form.etudiant} onChange={(e) => setForm({ ...form, etudiant: e.target.value })}>
            {etudiants.map((x) => <option key={x}>{x}</option>)}
          </select>
        </label>
        <label>Parcours
          <select value={form.parcours} onChange={(e) => setForm({ ...form, parcours: e.target.value })}>
            <option value="">— retirer du parcours —</option>
            {parcours.map((x) => <option key={x}>{x}</option>)}
          </select>
        </label>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>Un seul DELETE / INSERT : l'ancien parcours est remplacé.</p>
      <button className="primary" type="submit"><LogIn size={16} /> Enregistrer</button>
    </form>
  );
}

function CreationIndicateur({ onChange, version }) {
  const vide = { id: "", type: "", etudiant: "", valeur: "", seuilAlerte: "", periodeMesure: "Mensuelle", sourceDonnees: "" };
  const [form, setForm] = useState(vide);
  const [types, setTypes] = useState([]);
  const [etudiants, setEtudiants] = useState([]);
  const [erreurs, setErreurs] = useState({});
  const [soumis, setSoumis] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.sousClasses("IndicateurApprentissage").then((r) => {
      // seules les classes feuilles (TauxAssiduite, NiveauStress…) : les familles servent au sens de l'alerte
      const familles = ["IndicateurEngagement", "IndicateurPerformance", "IndicateurBienEtre"];
      const noms = r.map((x) => x.sousClasse).filter((n) => !familles.includes(n));
      setTypes(noms);
      setForm((f) => ({ ...f, type: f.type || (noms.includes("NiveauStress") ? "NiveauStress" : noms[0] || "") }));
    }).catch((e) => toast.erreur(e.message));
  }, []);
  useEffect(() => {
    api.individus("Etudiant").then((r) => {
      setEtudiants(r.map((x) => x.individu));
      setForm((f) => ({ ...f, etudiant: f.etudiant || r[0]?.individu || "" }));
    }).catch((e) => toast.erreur(e.message));
  }, [version]);

  function regles(d) {
    return {
      id: identifiant(d.id),
      type: choix(d.type, types, "Le type"),
      etudiant: choix(d.etudiant, etudiants, "L'étudiant"),
      valeur: decimal(d.valeur, { min: 0, max: 1, libelle: "La valeur" }),
      seuilAlerte: decimal(d.seuilAlerte, { min: 0, max: 1, libelle: "Le seuil" }),
      periodeMesure: choix(d.periodeMesure, PERIODES, "La période"),
      sourceDonnees: texteLibre(d.sourceDonnees, { obligatoire: false, max: 80, libelle: "La source" }),
    };
  }

  function maj(k, valeur) {
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
      const r = await api.post("/api/m6/indicateurs", {
        ...form,
        id: form.id.trim(),
        valeur: Number(form.valeur.replace(",", ".")),
        seuilAlerte: Number(form.seuilAlerte.replace(",", ".")),
        sourceDonnees: form.sourceDonnees.trim() || null,
      });
      toast.succes(`Mesure ${r.cree} enregistrée pour ${r.etudiant}${r.alerte ? " : ALERTE" : ""}.`);
      setForm({ ...vide, type: form.type, etudiant: form.etudiant });
      setErreurs({});
      setSoumis(false);
      onChange();
    } catch (err) {
      toast.erreur(err.message);
    }
  }

  return (
    <form className="card" onSubmit={creer} noValidate>
      <h4><Plus size={16} style={{ verticalAlign: "-3px" }} /> Nouvelle mesure</h4>
      <code className="url">POST /api/m6/indicateurs</code>
      <div className="form-grille">
        <Champ label="Identifiant" erreur={erreurs.id} aide="Sans espace ni accent">
          <input value={form.id} onChange={(e) => maj("id", e.target.value)} placeholder="Stress_Yassine" aria-invalid={!!erreurs.id} />
        </Champ>
        <Champ label="Type" erreur={erreurs.type}>
          <select value={form.type} onChange={(e) => maj("type", e.target.value)}>
            {types.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Champ>
        <Champ label="Étudiant" erreur={erreurs.etudiant}>
          <select value={form.etudiant} onChange={(e) => maj("etudiant", e.target.value)}>
            {etudiants.map((x) => <option key={x}>{x}</option>)}
          </select>
        </Champ>
        <Champ label="Période" erreur={erreurs.periodeMesure}>
          <select value={form.periodeMesure} onChange={(e) => maj("periodeMesure", e.target.value)}>
            {PERIODES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Champ>
        <Champ label="Valeur (0 à 1)" erreur={erreurs.valeur}>
          <input inputMode="decimal" value={form.valeur} onChange={(e) => maj("valeur", e.target.value)} placeholder="0.82" aria-invalid={!!erreurs.valeur} />
        </Champ>
        <Champ label="Seuil d'alerte (0 à 1)" erreur={erreurs.seuilAlerte}>
          <input inputMode="decimal" value={form.seuilAlerte} onChange={(e) => maj("seuilAlerte", e.target.value)} placeholder="0.7" aria-invalid={!!erreurs.seuilAlerte} />
        </Champ>
        <Champ className="plein" label="Source des données" erreur={erreurs.sourceDonnees}>
          <input value={form.sourceDonnees} onChange={(e) => maj("sourceDonnees", e.target.value)} placeholder="Questionnaire bien-être" />
        </Champ>
      </div>
      <button className="primary" type="submit"><Plus size={16} /> Enregistrer</button>
    </form>
  );
}

function MiseAJourIndicateur({ onChange, version }) {
  const [indicateurs, setIndicateurs] = useState([]);
  const [form, setForm] = useState({ indicateur: "", valeur: "", seuilAlerte: "" });
  const [erreurs, setErreurs] = useState({});
  const toast = useToast();

  useEffect(() => {
    api.get("/api/m6/alertes?toutes=true").then((r) => {
      setIndicateurs(r);
      setForm((f) => ({ ...f, indicateur: f.indicateur || r[0]?.indicateur || "" }));
    }).catch((e) => toast.erreur(e.message));
  }, [version]);

  const actuel = indicateurs.find((i) => i.indicateur === form.indicateur);

  async function envoyer(e) {
    e.preventDefault();
    const eurs = {
      valeur: decimal(form.valeur, { min: 0, max: 1, libelle: "La valeur" }),
      seuilAlerte: decimal(form.seuilAlerte, { min: 0, max: 1, obligatoire: false, libelle: "Le seuil" }),
    };
    setErreurs(eurs);
    if (invalide(eurs) || !form.indicateur) return;
    try {
      const corps = { valeur: Number(form.valeur.replace(",", ".")) };
      if (form.seuilAlerte.trim()) corps.seuilAlerte = Number(form.seuilAlerte.replace(",", "."));
      const r = await api.put(`/api/m6/indicateurs/${form.indicateur}`, corps);
      toast.succes(`${r.modifie} : ${pct(r.valeur)}${r.alerte ? " → alerte" : " → normal"}.`);
      setForm({ ...form, valeur: "", seuilAlerte: "" });
      onChange();
    } catch (err) {
      toast.erreur(err.message);
    }
  }

  return (
    <form className="card" onSubmit={envoyer} noValidate>
      <h4><Pencil size={16} style={{ verticalAlign: "-3px" }} /> Mettre à jour une mesure</h4>
      <code className="url">PUT /api/m6/indicateurs/{"{indicateur}"}</code>
      <div className="form-grille">
        <label className="plein">Indicateur
          <select value={form.indicateur} onChange={(e) => setForm({ ...form, indicateur: e.target.value })}>
            {indicateurs.map((i) => (
              <option key={i.indicateur} value={i.indicateur}>{i.indicateur} ({i.etudiant}, {pct(i.valeur)})</option>
            ))}
          </select>
        </label>
        <Champ label="Nouvelle valeur (0 à 1)" erreur={erreurs.valeur}
               aide={actuel ? `actuelle : ${pct(actuel.valeur)} · ${actuel.sens}` : undefined}>
          <input inputMode="decimal" value={form.valeur} onChange={(e) => setForm({ ...form, valeur: e.target.value })} placeholder="0.65" aria-invalid={!!erreurs.valeur} />
        </Champ>
        <Champ label="Nouveau seuil (optionnel)" erreur={erreurs.seuilAlerte}
               aide={actuel ? `actuel : ${pct(actuel.seuil)}` : undefined}>
          <input inputMode="decimal" value={form.seuilAlerte} onChange={(e) => setForm({ ...form, seuilAlerte: e.target.value })} placeholder="0.6" aria-invalid={!!erreurs.seuilAlerte} />
        </Champ>
      </div>
      <button className="primary" type="submit"><Pencil size={16} /> Mettre à jour</button>
    </form>
  );
}
