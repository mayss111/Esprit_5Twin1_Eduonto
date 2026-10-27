import { useEffect, useState } from "react";
import { BookOpen, CircleCheck, CircleX, Database, FolderTree, GitBranch, Hash, Layers, Library, Plus, TrendingUp } from "lucide-react";
import { api } from "../api.js";
import Champ from "../components/Champ.jsx";
import ClassePage from "../components/ClassePage.jsx";
import QueryCard from "../components/QueryCard.jsx";
import Section from "../components/Section.jsx";
import StatCard from "../components/StatCard.jsx";
import { useToast } from "../components/Toast.jsx";
import { choix, codeCours, entier, identifiant, invalide, texteLibre } from "../validation.js";

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
      <ChiffresCles version={version} />

      <Section icone={GitBranch} titre="Parcours de prérequis">
        <div className="grid2" style={{ marginTop: 0 }}>
          <CheminPrerequis version={version} />
          <PeutSuivre version={version} />
        </div>
      </Section>

      <Section icone={Library} titre="Catalogue">
        <div className="grid2" style={{ marginTop: 0, marginBottom: 16 }}>
          <StatistiquesDomaines version={version} />
          <NouveauCours onCree={rafraichir} />
        </div>
        <AjoutPrerequis version={version} onChange={rafraichir} />
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
      <QueryCard titre="Prérequis directs et indirects (chemin aPourPrerequis+)" url="/api/m2/cours/{cours}/prerequis" params={{ cours: "Angular" }} />
      <QueryCard titre="Cours accessibles ensuite (estPrerequisDe+)" url="/api/m2/cours/{cours}/suite" params={{ cours: "Algorithmique" }} />
      <QueryCard titre="Cours d'une classe de domaine (sous-classes incluses)" url="/api/m2/cours" query={{ domaine: "GenieLogiciel" }} />
      <QueryCard titre="Cours d'un niveau (énumération owl:oneOf)" url="/api/m2/cours/niveau/{niveau}" params={{ niveau: "Avancé" }} />
      <QueryCard titre="Cours d'au moins N crédits (FILTER + ORDER BY)" url="/api/m2/cours/credits" query={{ min: 4 }} />
      <QueryCard titre="Recherche plein texte (intitulé, code, mots-clés du domaine)" url="/api/m2/recherche" query={{ q: "web" }} />
      <QueryCard titre="Statistiques par domaine (COUNT, SUM, AVG)" url="/api/m2/domaines/statistiques" />
      <QueryCard titre="Prérequis non validés par un étudiant (FILTER NOT EXISTS)" url="/api/m2/etudiants/{etudiant}/peut-suivre/{cours}" params={{ etudiant: "Ahmed", cours: "Angular" }} />
      </Section>
    </div>
  );
}

// ---------- Chiffres clés (routes existantes du membre 2) ----------
function ChiffresCles({ version }) {
  const [c, setC] = useState(null);
  useEffect(() => {
    Promise.all([api.get("/api/m2/cours"), api.get("/api/m2/domaines/statistiques"), api.get("/api/m2/cours/niveau/Avancé")])
      .then(([cours, domaines, avances]) => {
        const uniques = new Map(cours.map((x) => [x.cours, x]));
        setC({ cours: uniques.size, domaines: domaines.length, avances: avances.length,
               credits: [...uniques.values()].reduce((t, x) => t + (x.credits ?? 0), 0) });
      })
      .catch(() => setC({}));
  }, [version]);
  return (
    <div className="grille-stats">
      <StatCard icone={BookOpen} valeur={c?.cours} libelle="cours au catalogue" chargement={!c} />
      <StatCard icone={FolderTree} valeur={c?.domaines} libelle="grands domaines" ton="deduit" chargement={!c} />
      <StatCard icone={Hash} valeur={c?.credits} libelle="crédits ECTS au total" ton="ok" chargement={!c} />
      <StatCard icone={TrendingUp} valeur={c?.avances} libelle="cours de niveau avancé" chargement={!c} />
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
        {avant.map((p) => [etape(p.prerequis, p.semestre, { background: "var(--panel-hover)", color: "var(--text-2)" }), <span key={`f-${p.prerequis}`}>→</span>])}
        {etape(choix, null, { background: "var(--primary)", color: "#fff", fontWeight: 600 })}
        {apres.map((s) => [<span key={`g-${s.coursSuivant}`}>→</span>, etape(s.coursSuivant, s.semestre, { background: "var(--ok-soft)", color: "var(--ok-text)" })])}
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
      {manquants && manquants.length === 0 && (
        <p className="badge ok" style={{ fontSize: 14, padding: "6px 12px", whiteSpace: "normal" }}>
          <CircleCheck size={16} /> {etu} a validé tous les prérequis de {c}
        </p>
      )}
      {manquants && manquants.length > 0 && (
        <div>
          <p className="badge ko" style={{ fontSize: 14, padding: "6px 12px", whiteSpace: "normal" }}>
            <CircleX size={16} /> Il manque {manquants.length} prérequis à {etu} :
          </p>
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
  const [erreurs, setErreurs] = useState({});
  const [soumis, setSoumis] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.individus("Domaine").then(setDomaines);
    api.individus("Cours").then(setCours);
  }, []);

  function regles(donnees) {
    const propre = identifiant(donnees.id);
    return {
      id: propre || (donnees.prerequis.includes(donnees.id.trim()) ? "Un cours ne peut pas être son propre prérequis." : ""),
      intitule: texteLibre(donnees.intitule, { libelle: "L'intitulé" }),
      code: codeCours(donnees.code),
      domaine: choix(donnees.domaine, domaines.map((x) => x.individu), "Le domaine"),
      niveau: choix(donnees.niveau, NIVEAUX, "Le niveau"),
      credits: entier(donnees.credits, { min: 1, max: 10, libelle: "Les crédits" }),
      volumeHoraire: entier(donnees.volumeHoraire, { min: 1, libelle: "Le volume horaire" }),
      semestre: entier(donnees.semestre, { min: 1, max: 10, libelle: "Le semestre" }),
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
      await api.post("/api/m2/cours", {
        ...f, id: f.id.trim(), intitule: f.intitule.trim(), code: f.code.trim() || null,
        credits: Number(f.credits), volumeHoraire: Number(f.volumeHoraire), semestre: Number(f.semestre),
      });
      toast.succes(`${f.id} créé`);
      setF(vide);
      setErreurs({});
      setSoumis(false);
      onCree();
      api.individus("Cours").then(setCours);
    } catch (err) {
      toast.erreur(err.message);
    }
  }

  return (
    <form className="card" onSubmit={envoyer} noValidate>
      <h4><Plus size={16} style={{ verticalAlign: "-3px" }} /> Créer un cours</h4>
      <div className="row">
        <Champ label="Identifiant" erreur={erreurs.id} aide="Sans espace ni accent">
          <input placeholder="ex. React" value={f.id} onChange={(e) => maj("id", e.target.value)} aria-invalid={!!erreurs.id} />
        </Champ>
        <Champ label="Intitulé" erreur={erreurs.intitule}>
          <input value={f.intitule} onChange={(e) => maj("intitule", e.target.value)} aria-invalid={!!erreurs.intitule} />
        </Champ>
        <Champ label="Code" erreur={erreurs.code} aide="Optionnel, ex. WEB302">
          <input placeholder="WEB302" value={f.code} onChange={(e) => maj("code", e.target.value)} aria-invalid={!!erreurs.code} />
        </Champ>
      </div>
      <div className="row">
        <label>Type<select value={f.type} onChange={(e) => maj("type", e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
        <Champ label="Domaine" erreur={erreurs.domaine}>
          <select value={f.domaine} onChange={(e) => maj("domaine", e.target.value)} aria-invalid={!!erreurs.domaine}>
            <option value="">—</option>
            {domaines.map((x) => <option key={x.individu}>{x.individu}</option>)}
          </select>
        </Champ>
        <Champ label="Niveau" erreur={erreurs.niveau}>
          <select value={f.niveau} onChange={(e) => maj("niveau", e.target.value)}>{NIVEAUX.map((n) => <option key={n}>{n}</option>)}</select>
        </Champ>
      </div>
      <div className="row">
        <Champ label="Crédits" erreur={erreurs.credits} aide="De 1 à 10">
          <input type="number" min="1" max="10" value={f.credits} onChange={(e) => maj("credits", e.target.value)} aria-invalid={!!erreurs.credits} />
        </Champ>
        <Champ label="Heures" erreur={erreurs.volumeHoraire} aide="Au moins 1">
          <input type="number" min="1" value={f.volumeHoraire} onChange={(e) => maj("volumeHoraire", e.target.value)} aria-invalid={!!erreurs.volumeHoraire} />
        </Champ>
        <Champ label="Semestre" erreur={erreurs.semestre} aide="De 1 à 10">
          <input type="number" min="1" max="10" value={f.semestre} onChange={(e) => maj("semestre", e.target.value)} aria-invalid={!!erreurs.semestre} />
        </Champ>
      </div>
      <label>Prérequis (Ctrl + clic pour en choisir plusieurs)
        <select multiple size={4} value={f.prerequis}
                onChange={(e) => setF({ ...f, prerequis: [...e.target.selectedOptions].map((o) => o.value) })}>
          {cours.map((x) => <option key={x.individu}>{x.individu}</option>)}
        </select>
      </label>
      <button className="primary" type="submit"><Plus size={16} /> Créer</button>
      <p className="muted">INSERT DATA : le cours + appartientADomaine + aPourPrerequis et son inverse estPrerequisDe</p>
    </form>
  );
}

// ---------- UPDATE spécifique : ajouter un prérequis, avec refus des cycles ----------
function AjoutPrerequis({ version, onChange }) {
  const [cours, setCours] = useState([]);
  const [c, setC] = useState("Algorithmique");
  const [p, setP] = useState("Angular");
  const toast = useToast();

  useEffect(() => { api.individus("Cours").then(setCours); }, [version]);

  async function ajouter() {
    if (c === p) {
      toast.erreur("Un cours ne peut pas être son propre prérequis.");
      return;
    }
    try {
      await api.put(`/api/m2/cours/${c}/prerequis`, { prerequis: p });
      toast.succes(`${p} est maintenant un prérequis de ${c}`);
      onChange();
    } catch (err) {
      toast.erreur(err.message);
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
        <button className="primary" onClick={ajouter}><Plus size={16} /> Ajouter</button>
      </div>
      <p className="muted">Avant l'INSERT, une requête vérifie que le prérequis ne dépend pas déjà du cours (aPourPrerequis+) : pas de boucle.</p>
    </div>
  );
}
