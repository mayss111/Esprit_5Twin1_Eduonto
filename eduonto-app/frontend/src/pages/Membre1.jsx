import { useEffect, useState } from "react";
import { BadgeCheck, Brain, Database, GraduationCap, HandCoins, Layers, School, UserPlus, Users } from "lucide-react";
import { api } from "../api.js";
import Champ from "../components/Champ.jsx";
import ClassePage from "../components/ClassePage.jsx";
import QueryCard from "../components/QueryCard.jsx";
import Section from "../components/Section.jsx";
import StatCard from "../components/StatCard.jsx";
import { useToast } from "../components/Toast.jsx";
import { choix, emailOptionnel, entier, identifiant, invalide, nomPersonne } from "../validation.js";

// MEMBRE 1 — Personne + Formation
const CLASSES = ["Personne", "Formation"];

export default function Membre1() {
  const [classe, setClasse] = useState(CLASSES[0]);
  const [version, setVersion] = useState(0);   // incrémenté après chaque modification -> rafraîchit les blocs
  const rafraichir = () => setVersion((v) => v + 1);

  return (
    <div>
      <ChiffresCles version={version} />

      <Section icone={School} titre="Tableau de bord des formations">
        <div className="grid2" style={{ marginTop: 0 }}>
          <StatistiquesFormations version={version} />
          <Inscription onCree={rafraichir} />
        </div>
      </Section>

      <Section icone={Brain} titre="Profil d'un étudiant (raisonnement)">
        <ProfilEtudiant version={version} onChange={rafraichir} />
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
      <QueryCard titre="Étudiants par année (FILTER numérique)" url="/api/m1/etudiants" query={{ annee: 4 }} />
      <QueryCard titre="Formation d'un étudiant (jointure)" url="/api/m1/etudiants/{etudiant}/formation" params={{ etudiant: "Ahmed" }} />
      <QueryCard titre="Classes affirmées / déduites d'un étudiant (owl:equivalentClass)" url="/api/m1/etudiants/{etudiant}/profil" params={{ etudiant: "Omar" }} />
      <QueryCard titre="Étudiants boursiers (FILTER booléen)" url="/api/m1/boursiers" query={{ formation: "" }} />
      <QueryCard titre="Enseignants par spécialité (CONTAINS + GROUP_CONCAT)" url="/api/m1/enseignants" query={{ specialite: "web" }} />
      <QueryCard titre="Enseignants avec au moins N années d'expérience" url="/api/m1/enseignants/experience" query={{ min: 10 }} />
      <QueryCard titre="Étudiants d'une formation" url="/api/m1/formations/{formation}/etudiants" params={{ formation: "Ingenieur_TWIN" }} />
      <QueryCard titre="Statistiques par formation (COUNT, SUM(IF), sous-requêtes)" url="/api/m1/formations/statistiques" />
      <QueryCard titre="Encadrements (relation + inverse, UNION)" url="/api/m1/encadrements" />
      </Section>
    </div>
  );
}

// ---------- Chiffres clés (routes existantes du membre 1) ----------
function ChiffresCles({ version }) {
  const [c, setC] = useState(null);
  useEffect(() => {
    Promise.all([api.get("/api/m1/etudiants"), api.get("/api/m1/formations/statistiques"),
                 api.get("/api/m1/boursiers"), api.get("/api/m1/enseignants")])
      .then(([e, f, b, ens]) => setC({ etudiants: e.length, formations: f.length, boursiers: b.length, enseignants: ens.length }))
      .catch(() => setC({}));
  }, [version]);
  return (
    <div className="grille-stats">
      <StatCard icone={GraduationCap} valeur={c?.etudiants} libelle="étudiants" chargement={!c} />
      <StatCard icone={School} valeur={c?.formations} libelle="formations" ton="deduit" chargement={!c} />
      <StatCard icone={HandCoins} valeur={c?.boursiers} libelle="boursiers" ton="ok" chargement={!c}
                detail={c?.etudiants ? `${Math.round((100 * c.boursiers) / c.etudiants)} % des étudiants` : null} />
      <StatCard icone={Users} valeur={c?.enseignants} libelle="enseignants" chargement={!c} />
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
  const [erreurs, setErreurs] = useState({});
  const [soumis, setSoumis] = useState(false);
  const toast = useToast();

  useEffect(() => { api.individus("Formation").then(setFormations); }, []);

  // Identifiant sans accent ni espace, construit à partir du prénom et du nom : « Rim Saïdi » -> Rim_Saidi
  const matriculeSaisi = `${f.prenom}_${f.nom}`
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9_]/g, "");

  function regles(donnees) {
    const id = `${donnees.prenom}_${donnees.nom}`
      .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9_]/g, "");
    return {
      prenom: nomPersonne(donnees.prenom, "prénom"),
      nom: nomPersonne(donnees.nom, "nom"),
      email: emailOptionnel(donnees.email),
      formation: choix(donnees.formation, formations.map((x) => x.individu), "La formation"),
      annee: entier(donnees.annee, { min: 1, max: 5, libelle: "L'année" }),
      id: donnees.prenom.trim() && donnees.nom.trim() ? identifiant(id) : "",
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
      const r = await api.post("/api/m1/etudiants", {
        ...f, id: matriculeSaisi, prenom: f.prenom.trim(), nom: f.nom.trim(),
        annee: Number(f.annee), email: f.email.trim() || null,
      });
      toast.succes(`${r.cree} inscrit (matricule ${r.matricule})`);
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
      <h4><UserPlus size={16} style={{ verticalAlign: "-3px" }} /> Inscrire un étudiant</h4>
      <div className="row">
        <Champ label="Prénom" erreur={erreurs.prenom}>
          <input value={f.prenom} onChange={(e) => maj("prenom", e.target.value)} aria-invalid={!!erreurs.prenom} />
        </Champ>
        <Champ label="Nom" erreur={erreurs.nom}>
          <input value={f.nom} onChange={(e) => maj("nom", e.target.value)} aria-invalid={!!erreurs.nom} />
        </Champ>
      </div>
      <div className="row">
        <Champ label="Formation" erreur={erreurs.formation}>
          <select value={f.formation} onChange={(e) => maj("formation", e.target.value)} aria-invalid={!!erreurs.formation}>
            <option value="">—</option>
            {formations.map((x) => <option key={x.individu}>{x.individu}</option>)}
          </select>
        </Champ>
        <Champ label="Année" erreur={erreurs.annee} aide="Entre 1 et 5">
          <input type="number" min="1" max="5" value={f.annee} onChange={(e) => maj("annee", e.target.value)} aria-invalid={!!erreurs.annee} />
        </Champ>
        <label className="case">
          <input type="checkbox" checked={f.boursier} onChange={(e) => setF({ ...f, boursier: e.target.checked })} />
          Boursier
        </label>
      </div>
      <Champ label="Email (optionnel)" erreur={erreurs.email}>
        <input type="email" value={f.email} onChange={(e) => maj("email", e.target.value)} placeholder="prenom.nom@esprit.tn" aria-invalid={!!erreurs.email} />
      </Champ>
      {erreurs.id && <p className="error" role="alert">{erreurs.id}</p>}
      <button className="primary" type="submit" disabled={!matriculeSaisi || matriculeSaisi === "_"}>
        <UserPlus size={16} /> Inscrire {matriculeSaisi !== "_" ? matriculeSaisi : ""}
      </button>
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
  const toast = useToast();

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
      toast.succes(`${prof} encadre maintenant ${choix}`);
      onChange();
    } catch (err) {
      toast.erreur(err.message);
    }
  }

  return (
    <div className="card">
      <div className="row">
        <label>Étudiant
          <select value={choix} onChange={(e) => setChoix(e.target.value)}>
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
          <span key={c.classe} className={`badge ${c.origine === "affirmée" ? "neutre" : "deduit"}`} title={c.origine}>
            {c.origine !== "affirmée" && <BadgeCheck size={13} />}{c.classe} · {c.origine}
          </span>
        ))}
      </div>
      <p className="muted">
        En ambre : classes définies (≡) remplies par le raisonneur HermiT, ex. EtudiantOption, EtudiantARisque.
        L'affectation met à jour estEncadrePar ET son inverse encadre (DELETE / INSERT).
      </p>
    </div>
  );
}
