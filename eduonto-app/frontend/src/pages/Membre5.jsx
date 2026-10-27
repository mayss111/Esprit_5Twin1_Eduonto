import { useEffect, useState } from "react";
import {
  Bot, Clock, Database, Layers, Library, Link2, Plus, Sparkles, Unlock,
} from "lucide-react";
import { api } from "../api.js";
import Champ from "../components/Champ.jsx";
import ClassePage from "../components/ClassePage.jsx";
import QueryCard from "../components/QueryCard.jsx";
import Section from "../components/Section.jsx";
import StatCard from "../components/StatCard.jsx";
import { useToast } from "../components/Toast.jsx";
import { choix, decimal, entier, identifiant, invalide, texteLibre, urlOptionnelle } from "../validation.js";

// MEMBRE 5 — RessourcePedagogique + AgentPedagogiqueIA
const CLASSES = ["RessourcePedagogique", "AgentPedagogiqueIA"];
const LANGUES = ["FR", "EN", "AR"];
const NOMS_LANGUE = { FR: "Français", EN: "Anglais", AR: "Arabe" };

const fiable = (a) => a?.fiable === true || a?.fiable === "true";
const libre = (r) => r?.estLibreAcces === true || r?.estLibreAcces === "true";
const nombre = (v) => (typeof v === "number" ? v : Number(v));

export default function Membre5() {
  const [classe, setClasse] = useState(CLASSES[0]);
  const [version, setVersion] = useState(0);
  const rafraichir = () => setVersion((v) => v + 1);

  return (
    <div>
      <ChiffresCles version={version} />

      <Section icone={Library} titre="Catalogue des ressources"
               sousTitre="Durée, langue et libre accès. En vert : ressource ouverte.">
        <Durees version={version} />
        <div className="split" style={{ marginTop: 16 }}>
          <CreationRessource onChange={rafraichir} version={version} />
          <LienCours onChange={rafraichir} version={version} />
        </div>
      </Section>

      <Section icone={Bot} titre="Agents pédagogiques"
               sousTitre="AgentIAFiable est déduite par HermiT : précision ≥ 0,9 et explicable.">
        <div className="split">
          <ListeAgents version={version} />
          <CreationAgent onChange={rafraichir} version={version} />
        </div>
      </Section>

      <Section icone={Sparkles} titre="Kit de révision"
               sousTitre="Chemin suitParcours / comprendCours / utiliseRessource, puis filtre libre accès et durée.">
        <KitRevision version={version} />
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
        <QueryCard titre="Ressources en libre accès d'une langue (FR, EN, AR)" url="/api/m5/ressources/libre-acces" query={{ langue: "FR" }} />
        <QueryCard titre="Ressources utilisées par un cours" url="/api/m5/cours/{cours}/ressources" params={{ cours: "Angular" }} />
        <QueryCard titre="Ressources de moins de N minutes" url="/api/m5/ressources/courtes" query={{ max: 30 }} />
        <QueryCard titre="Recherche dans le titre, l'auteur ou l'URL (CONTAINS)" url="/api/m5/ressources/recherche" query={{ q: "angular" }} />
        <QueryCard titre="Statistiques par langue (COUNT, SUM)" url="/api/m5/statistiques" />
        <QueryCard titre="Ressources du parcours d'un étudiant (chemin de propriétés)" url="/api/m5/etudiants/{etudiant}/ressources-parcours" params={{ etudiant: "Ahmed" }} />
        <QueryCard titre="Kit de révision : libres et courtes, dans le parcours" url="/api/m5/etudiants/{etudiant}/kit-revision" params={{ etudiant: "Ahmed" }} query={{ max: 30 }} />
        <QueryCard titre="Agents IA fiables (précision et explicabilité)" url="/api/m5/agents-fiables" query={{ seuil: 0.9 }} />
        <QueryCard titre="Classes affirmées / déduites d'un agent (owl:equivalentClass)" url="/api/m5/agents/{agent}/profil" params={{ agent: "Tuteur_EduBot" }} />
        <QueryCard titre="Recommandations pour un étudiant" url="/api/m5/recommandations/{etudiant}" params={{ etudiant: "Omar" }} />
        <QueryCard titre="Ressources utilisées par aucun cours" url="/api/m5/ressources/sans-cours" />
      </Section>
    </div>
  );
}

function ChiffresCles({ version }) {
  const [c, setC] = useState(null);
  useEffect(() => {
    Promise.all([api.get("/api/m5/ressources"), api.get("/api/m5/agents")])
      .then(([ressources, agents]) => {
        const durees = ressources.map((r) => nombre(r.dureeMinutes)).filter((n) => !Number.isNaN(n));
        setC({
          ressources: ressources.length,
          libres: ressources.filter(libre).length,
          fiables: agents.filter(fiable).length,
          agents: agents.length,
          duree: durees.length ? Math.round(durees.reduce((s, n) => s + n, 0) / durees.length) : null,
        });
      })
      .catch(() => setC({}));
  }, [version]);
  return (
    <div className="grille-stats">
      <StatCard icone={Library} valeur={c?.ressources} libelle="ressources" chargement={!c} />
      <StatCard icone={Unlock} valeur={c?.libres} libelle="en libre accès" ton="ok" chargement={!c} />
      <StatCard icone={Bot} valeur={c?.fiables} libelle={`agents fiables${c?.agents != null ? ` / ${c.agents}` : ""}`} ton="deduit" chargement={!c} />
      <StatCard icone={Clock} valeur={c?.duree != null ? `${c.duree} min` : null} libelle="durée moyenne" chargement={!c} />
    </div>
  );
}

function Durees({ version }) {
  const [rows, setRows] = useState([]);
  const toast = useToast();
  useEffect(() => {
    api.get("/api/m5/ressources").then(setRows).catch((e) => toast.erreur(e.message));
  }, [version]);
  const max = Math.max(1, ...rows.map((r) => nombre(r.dureeMinutes) || 0));
  return (
    <div className="card">
      {rows.map((r) => {
        const d = nombre(r.dureeMinutes);
        const connue = !Number.isNaN(d);
        return (
          <div className="barre" key={r.ressource} title={r.cours ? `Utilisée par ${r.cours}` : "Aucun cours"}>
            <span className="barre-label">{r.titre || r.ressource}</span>
            <div className="barre-fond">
              <div className={`barre-valeur ${libre(r) ? "ok" : "moyen"}`}
                   style={{ width: connue ? `${(100 * d) / max}%` : "4%" }} />
            </div>
            <span className="barre-chiffre">{connue ? `${d} min` : "—"} · {r.langue}</span>
          </div>
        );
      })}
    </div>
  );
}

function CreationRessource({ onChange, version }) {
  const vide = { id: "", type: "", titre: "", langue: "FR", estLibreAcces: true, dureeMinutes: "", auteur: "", url: "", cours: "" };
  const [form, setForm] = useState(vide);
  const [types, setTypes] = useState([]);
  const [cours, setCours] = useState([]);
  const [erreurs, setErreurs] = useState({});
  const [soumis, setSoumis] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.sousClasses("RessourcePedagogique").then((r) => {
      const noms = r.map((x) => x.sousClasse);
      setTypes(noms);
      setForm((f) => ({ ...f, type: f.type || (noms.includes("Tutoriel") ? "Tutoriel" : noms[0] || "") }));
    }).catch((e) => toast.erreur(e.message));
  }, []);
  useEffect(() => {
    api.individus("Cours").then((r) => setCours(r.map((x) => x.individu))).catch((e) => toast.erreur(e.message));
  }, [version]);

  function regles(donnees) {
    return {
      id: identifiant(donnees.id),
      type: choix(donnees.type, types, "Le type"),
      titre: texteLibre(donnees.titre, { max: 160, libelle: "Le titre" }),
      langue: choix(donnees.langue, LANGUES, "La langue"),
      dureeMinutes: entier(donnees.dureeMinutes, { min: 0, obligatoire: false, libelle: "La durée" }),
      auteur: texteLibre(donnees.auteur, { obligatoire: false, min: 2, max: 80, libelle: "L'auteur" }),
      url: urlOptionnelle(donnees.url),
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
      const corps = {
        ...form,
        id: form.id.trim(),
        titre: form.titre.trim(),
        dureeMinutes: form.dureeMinutes === "" ? null : Number(form.dureeMinutes),
        auteur: form.auteur.trim() || null,
        url: form.url.trim() || null,
        cours: form.cours || null,
      };
      const r = await api.post("/api/m5/ressources", corps);
      toast.succes(`Ressource ${r.cree} créée${r.cours ? ` et reliée à ${r.cours}` : ""}.`);
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
      <h4><Plus size={16} style={{ verticalAlign: "-3px" }} /> Créer une ressource</h4>
      <code className="url">POST /api/m5/ressources</code>
      <div className="form-grille">
        <Champ label="Identifiant" erreur={erreurs.id} aide="Sans espace ni accent">
          <input value={form.id} onChange={(e) => maj("id", e.target.value)} placeholder="Video_React" aria-invalid={!!erreurs.id} />
        </Champ>
        <Champ label="Type" erreur={erreurs.type}>
          <select value={form.type} onChange={(e) => maj("type", e.target.value)}>
            {types.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Champ>
        <Champ className="plein" label="Titre" erreur={erreurs.titre}>
          <input value={form.titre} onChange={(e) => maj("titre", e.target.value)} placeholder="Découvrir React en 20 minutes" aria-invalid={!!erreurs.titre} />
        </Champ>
        <Champ label="Langue" erreur={erreurs.langue}>
          <select value={form.langue} onChange={(e) => maj("langue", e.target.value)}>
            {LANGUES.map((l) => <option key={l} value={l}>{NOMS_LANGUE[l]}</option>)}
          </select>
        </Champ>
        <Champ label="Durée (minutes)" erreur={erreurs.dureeMinutes} aide="Optionnel, entier ≥ 0">
          <input type="number" min="0" value={form.dureeMinutes} onChange={(e) => maj("dureeMinutes", e.target.value)} placeholder="20" aria-invalid={!!erreurs.dureeMinutes} />
        </Champ>
        <Champ label="Auteur" erreur={erreurs.auteur}>
          <input value={form.auteur} onChange={(e) => maj("auteur", e.target.value)} placeholder="Amel Trabelsi" aria-invalid={!!erreurs.auteur} />
        </Champ>
        <Champ label="URL" erreur={erreurs.url}>
          <input value={form.url} onChange={(e) => maj("url", e.target.value)} placeholder="https://…" aria-invalid={!!erreurs.url} />
        </Champ>
        <label>Rattacher au cours
          <select value={form.cours} onChange={(e) => maj("cours", e.target.value)}>
            <option value="">— aucun —</option>
            {cours.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="case" style={{ alignSelf: "end", marginBottom: 20 }}>
          <input type="checkbox" checked={form.estLibreAcces}
                 onChange={(ev) => setForm({ ...form, estLibreAcces: ev.target.checked })} />
          Libre accès
        </label>
      </div>
      <button className="primary" type="submit"><Plus size={16} /> Créer</button>
    </form>
  );
}

function LienCours({ onChange, version }) {
  const [cours, setCours] = useState([]);
  const [ressources, setRessources] = useState([]);
  const [form, setForm] = useState({ cours: "", ressource: "", action: "ajouter" });
  const toast = useToast();

  useEffect(() => {
    Promise.all([api.individus("Cours"), api.individus("RessourcePedagogique")]).then(([c, r]) => {
      setCours(c.map((x) => x.individu));
      setRessources(r.map((x) => x.individu));
      setForm((f) => ({
        ...f,
        cours: f.cours || c[0]?.individu || "",
        ressource: f.ressource || r[0]?.individu || "",
      }));
    }).catch((e) => toast.erreur(e.message));
  }, [version]);

  async function envoyer(e) {
    e.preventDefault();
    if (!form.cours || !form.ressource) {
      toast.erreur("Choisissez un cours et une ressource.");
      return;
    }
    try {
      const r = await api.put(`/api/m5/cours/${form.cours}/ressources`,
                              { ressource: form.ressource, action: form.action });
      toast.succes(`${r.ressource} ${r.action === "ajouter" ? "ajoutée à" : "retirée de"} ${r.cours}.`);
      onChange();
    } catch (err) {
      toast.erreur(err.message);
    }
  }

  return (
    <form className="card" onSubmit={envoyer}>
      <h4><Link2 size={16} style={{ verticalAlign: "-3px" }} /> Relier une ressource à un cours</h4>
      <code className="url">PUT /api/m5/cours/{"{cours}"}/ressources</code>
      <div className="form-grille">
        <label>Cours
          <select value={form.cours} onChange={(e) => setForm({ ...form, cours: e.target.value })}>
            {cours.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label>Ressource
          <select value={form.ressource} onChange={(e) => setForm({ ...form, ressource: e.target.value })}>
            {ressources.map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
        <label>Action
          <select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}>
            <option value="ajouter">Ajouter</option>
            <option value="retirer">Retirer</option>
          </select>
        </label>
      </div>
      <button className="primary" type="submit"><Link2 size={16} /> Enregistrer</button>
    </form>
  );
}

function ListeAgents({ version }) {
  const [rows, setRows] = useState([]);
  const toast = useToast();
  useEffect(() => {
    api.get("/api/m5/agents").then(setRows).catch((e) => toast.erreur(e.message));
  }, [version]);
  return (
    <div className="card">
      {rows.map((a) => {
        const p = nombre(a.precision);
        const pct = Number.isNaN(p) ? 0 : Math.round(p * 100);
        return (
          <div key={a.agent} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
              <strong>{a.agent}</strong>
              <span className={`badge ${fiable(a) ? "deduit" : "ko"}`}>{fiable(a) ? "AgentIAFiable" : "non fiable"}</span>
            </div>
            <p className="muted" style={{ margin: "4px 0 6px" }}>{a.type}{a.modele ? ` · ${a.modele}` : ""}</p>
            <div className="barre">
              <span className="barre-label">{pct} %</span>
              <div className="barre-fond">
                <div className={`barre-valeur ${fiable(a) ? "ok" : "ko"}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="barre-chiffre">{a.explicable === true || a.explicable === "true" ? "explicable" : "boîte noire"}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CreationAgent({ onChange, version }) {
  const vide = { id: "", type: "", modeleIA: "", tauxPrecision: "0.9", estExplicable: true,
                 fournisseur: "", etudiant: "", recommandation: "" };
  const [form, setForm] = useState(vide);
  const [types, setTypes] = useState([]);
  const [etudiants, setEtudiants] = useState([]);
  const [cibles, setCibles] = useState([]);
  const [erreurs, setErreurs] = useState({});
  const [soumis, setSoumis] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.sousClasses("AgentPedagogiqueIA").then((r) => {
      const noms = r.map((x) => x.sousClasse);
      setTypes(noms);
      setForm((f) => ({ ...f, type: f.type || (noms.includes("TuteurConversationnel") ? "TuteurConversationnel" : noms[0] || "") }));
    }).catch((e) => toast.erreur(e.message));
  }, []);
  useEffect(() => {
    Promise.all([api.individus("Etudiant"), api.individus("Cours"), api.individus("RessourcePedagogique"), api.individus("ParcoursApprentissage")])
      .then(([e, c, r, p]) => {
        setEtudiants(e.map((x) => x.individu));
        setCibles([...c, ...r, ...p].map((x) => x.individu));
      })
      .catch((err) => toast.erreur(err.message));
  }, [version]);

  function regles(donnees) {
    return {
      id: identifiant(donnees.id),
      type: choix(donnees.type, types.filter((t) => t !== "AgentIAFiable"), "Le type"),
      modeleIA: texteLibre(donnees.modeleIA, { max: 160, libelle: "Le modèle" }),
      tauxPrecision: decimal(donnees.tauxPrecision, { min: 0, max: 1, libelle: "La précision" }),
      fournisseur: texteLibre(donnees.fournisseur, { obligatoire: false, min: 2, max: 80, libelle: "Le fournisseur" }),
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
      const r = await api.post("/api/m5/agents", {
        ...form,
        id: form.id.trim(),
        modeleIA: form.modeleIA.trim(),
        tauxPrecision: Number(form.tauxPrecision),
        fournisseur: form.fournisseur.trim() || null,
        etudiant: form.etudiant || null,
        recommandation: form.recommandation || null,
        versionModele: null,
      });
      toast.succes(`Agent ${r.cree} créé.`);
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
      <h4><Plus size={16} style={{ verticalAlign: "-3px" }} /> Créer un agent</h4>
      <code className="url">POST /api/m5/agents</code>
      <p className="muted">La pastille AgentIAFiable des agents déjà chargés vient d'HermiT. Un agent créé ici ne la reçoit qu'après avoir régénéré l'ontologie inférée.</p>
      <div className="form-grille">
        <Champ label="Identifiant" erreur={erreurs.id} aide="Sans espace ni accent">
          <input value={form.id} onChange={(e) => maj("id", e.target.value)} placeholder="Tuteur_React" aria-invalid={!!erreurs.id} />
        </Champ>
        <Champ label="Type" erreur={erreurs.type}>
          <select value={form.type} onChange={(e) => maj("type", e.target.value)}>
            {types.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Champ>
        <Champ className="plein" label="Modèle" erreur={erreurs.modeleIA}>
          <input value={form.modeleIA} onChange={(e) => maj("modeleIA", e.target.value)} placeholder="Règles pédagogiques" aria-invalid={!!erreurs.modeleIA} />
        </Champ>
        <Champ label="Précision (0 à 1)" erreur={erreurs.tauxPrecision}>
          <input type="number" min="0" max="1" step="0.01" value={form.tauxPrecision} onChange={(e) => maj("tauxPrecision", e.target.value)} aria-invalid={!!erreurs.tauxPrecision} />
        </Champ>
        <Champ label="Fournisseur" erreur={erreurs.fournisseur}>
          <input value={form.fournisseur} onChange={(e) => maj("fournisseur", e.target.value)} placeholder="Équipe EduOnto" aria-invalid={!!erreurs.fournisseur} />
        </Champ>
        <label>Assiste
          <select value={form.etudiant} onChange={(e) => maj("etudiant", e.target.value)}>
            <option value="">— personne —</option>
            {etudiants.map((x) => <option key={x}>{x}</option>)}
          </select>
        </label>
        <label>Recommande
          <select value={form.recommandation} onChange={(e) => maj("recommandation", e.target.value)}>
            <option value="">— rien —</option>
            {cibles.map((x) => <option key={x}>{x}</option>)}
          </select>
        </label>
        <label className="case" style={{ alignSelf: "end", marginBottom: 20 }}>
          <input type="checkbox" checked={form.estExplicable}
                 onChange={(ev) => setForm({ ...form, estExplicable: ev.target.checked })} />
          Explicable
        </label>
      </div>
      <button className="primary" type="submit"><Plus size={16} /> Créer</button>
    </form>
  );
}

function KitRevision({ version }) {
  const [etudiants, setEtudiants] = useState([]);
  const [etudiant, setEtudiant] = useState("Ahmed");
  const [max, setMax] = useState("30");
  const [rows, setRows] = useState(null);
  const toast = useToast();
  const erreurMax = entier(max, { min: 0, libelle: "La durée maximale" });

  useEffect(() => {
    api.individus("Etudiant").then((r) => {
      const noms = r.map((x) => x.individu);
      setEtudiants(noms);
      setEtudiant((e) => (noms.includes(e) ? e : noms[0] || ""));
    }).catch((e) => toast.erreur(e.message));
  }, [version]);

  useEffect(() => {
    if (!etudiant || erreurMax) return;
    api.get(`/api/m5/etudiants/${encodeURIComponent(etudiant)}/kit-revision?max=${encodeURIComponent(max)}`)
      .then(setRows)
      .catch((e) => { setRows([]); toast.erreur(e.message); });
  }, [etudiant, max, version]);

  return (
    <div className="card">
      <div className="form-grille">
        <label>Étudiant
          <select value={etudiant} onChange={(e) => setEtudiant(e.target.value)}>
            {etudiants.map((e) => <option key={e}>{e}</option>)}
          </select>
        </label>
        <Champ label="Moins de (minutes)" erreur={erreurMax} aide="Entier ≥ 0">
          <input type="number" min="0" value={max} onChange={(e) => setMax(e.target.value)} aria-invalid={!!erreurMax} />
        </Champ>
      </div>
      {rows && rows.length === 0 && <p className="muted">Aucune ressource libre et assez courte dans ce parcours.</p>}
      <div className="badges-grille">
        {(rows || []).map((r) => (
          <div className="badge-carte verifie" key={`${r.ressource}-${r.cours}`}>
            <strong>{r.titre || r.ressource}</strong>
            <span>{r.dureeMinutes} min · {r.langue}</span>
            <span>{r.intitule || r.cours}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
