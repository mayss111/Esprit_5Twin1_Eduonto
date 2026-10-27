import { useEffect, useRef, useState } from "react";
import {
  Award, BadgeCheck, BookOpen, CircleCheck, ClipboardCheck, Lock, LockOpen, MessageSquare, Send, Target, TriangleAlert,
} from "lucide-react";
import { api } from "../api.js";
import EmptyState from "../components/EmptyState.jsx";
import Section from "../components/Section.jsx";
import Skeleton from "../components/Skeleton.jsx";
import { useToast } from "../components/Toast.jsx";

// FRONT-OFFICE — tableau de bord d'un étudiant.
// Construit uniquement avec les routes des membres 1 à 4 (et la fiche générique /api/individus/{id}) :
//   M1 profil, formation, encadrements · M2 peut-suivre · M3 recommandations · M4 relevé, moyenne, preuves.
const QUESTIONS = ["Quelle est ma moyenne ?", "Quelles sont mes notes ?", "Quels badges ai-je obtenus ?",
                   "Quelles compétences me manquent ?", "Qui m'encadre ?", "Puis-je suivre Angular ?"];
const MENTIONS = { "Très bien": "tb", "Bien": "b", "Assez bien": "ab", "Passable": "p", "Non validé": "nv" };

const initiales = (e) => ((e.prenom?.[0] ?? e.etudiant[0]) + (e.nom?.[0] ?? "")).toUpperCase();
// « DeveloppementFrontend » → « Developpement Frontend » (identifiants affichés lisiblement)
const lisible = (id) => String(id).replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
const nomComplet = (e) => [e.prenom, e.nom].filter(Boolean).join(" ") || e.etudiant;

export default function EspaceEtudiant({ naviguer }) {
  const [etudiants, setEtudiants] = useState([]);
  const [intitules, setIntitules] = useState({});   // formation -> intitulé
  const [id, setId] = useState("");
  const [d, setD] = useState(null);                 // toutes les données du tableau de bord
  const demande = useRef(0);                        // ignore les réponses d'un étudiant choisi précédemment
  const toast = useToast();

  useEffect(() => {
    api.get("/api/m1/etudiants").then((r) => {
      setEtudiants(r);
      if (r.length) setId(r[0].etudiant);
    }).catch((e) => toast.erreur(e.message));
    api.get("/api/m1/formations/statistiques")
      .then((r) => setIntitules(Object.fromEntries(r.map((f) => [f.formation, f.intitule || f.formation])))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    const numero = ++demande.current;
    setD(null);
    charger(id)
      .then((donnees) => { if (numero === demande.current) setD(donnees); })
      .catch((e) => { if (numero === demande.current) toast.erreur(e.message); });
  }, [id]);

  const ident = etudiants.find((e) => e.etudiant === id);

  return (
    <div>
      <div className="etu-choix" role="group" aria-label="Choisir un étudiant">
        {etudiants.map((e) => (
          <button key={e.etudiant} type="button" className="etu-carte" aria-pressed={e.etudiant === id} onClick={() => setId(e.etudiant)}>
            <span className="avatar" aria-hidden="true">{initiales(e)}</span>
            <span><strong>{nomComplet(e)}</strong><span>{intitules[e.formation] ?? e.formation ?? "—"}</span></span>
          </button>
        ))}
      </div>

      {!d || !ident ? <div className="card"><Skeleton lignes={5} hauteur={18} /></div> : <Tableau d={d} ident={ident} naviguer={naviguer} />}
    </div>
  );
}

function Tableau({ d, ident, naviguer }) {
  const deduites = d.profil.filter((p) => p.origine !== "affirmée");
  const aRisque = d.profil.some((p) => p.classe === "EtudiantARisque");
  const requises = d.requises.length;
  const acquises = Math.max(0, requises - d.manquantes.length);
  const pct = requises ? Math.round((100 * acquises) / requises) : 0;
  const accessibles = d.cours.filter((c) => !c.valide && c.manquants.length === 0);
  const bloques = d.cours.filter((c) => !c.valide && c.manquants.length > 0);
  const valides = d.cours.filter((c) => c.valide);

  return (
    <>
      <div className="etu-profil">
        <span className="avatar grand" aria-hidden="true">{initiales(ident)}</span>
        <div className="etu-profil-corps">
          <h2>{nomComplet(ident)}</h2>
          <p>{d.formation?.intitule || d.formation?.formation || "Formation non renseignée"}
            {d.fiche.anneeEtude ? ` · ${d.fiche.anneeEtude}e année` : ""}
            {d.encadrants.length ? ` · encadré par ${d.encadrants.join(", ")}` : ""}</p>
          <div className="chips" style={{ marginTop: 10 }}>
            {d.fiche.estBoursier === true && <span className="badge">Boursier</span>}
            {d.metier && <span className="badge">Vise : {d.metier}</span>}
            {deduites.map((p) => <span key={p.classe} className="badge deduit" title="classe déduite par HermiT">{p.classe}</span>)}
          </div>
        </div>
        <div className="etu-profil-moyenne">
          <strong>{d.moyenne?.moyennePonderee ?? "—"}</strong>
          <span>moyenne pondérée{d.moyenne ? ` · ${d.moyenne.decision}` : ""}</span>
        </div>
      </div>

      {aRisque && (
        <div className="alerte" role="alert">
          <TriangleAlert size={20} />
          <div><strong>Étudiant à risque de décrochage</strong>
            Le raisonneur a classé {ident.prenom || ident.etudiant} dans EtudiantARisque (assiduité sous le seuil d'alerte).
            Un suivi par l'encadrant est recommandé.</div>
        </div>
      )}

      <div className="grille-3" style={{ marginBottom: 32 }}>
        <section className="card">
          <h4><Target size={16} style={{ verticalAlign: "-3px" }} /> Progression vers le métier visé</h4>
          {!d.metier ? <EmptyState compact icone={Target} titre="Aucun métier visé" /> : (
            <div className="progression">
              <div className="anneau" style={{ "--p": pct }} role="img" aria-label={`${pct} % des compétences acquises`}>
                <div className="anneau-centre"><div><strong>{pct} %</strong><br /><span>{acquises}/{requises}</span></div></div>
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <p><b>{d.metier}</b></p>
                <p className="muted">{acquises} compétence{acquises > 1 ? "s" : ""} certifiée{acquises > 1 ? "s" : ""} sur {requises} requise{requises > 1 ? "s" : ""}.</p>
              </div>
            </div>
          )}
          {d.manquantes.length > 0 && (
            <ul className="liste">
              {d.manquantes.map((m) => (
                <li key={m.competence}>
                  <span>{m.libelle || m.competence}</span>
                  <span className="muted">{m.cours.length ? `→ ${m.cours.join(", ")}` : "aucun cours associé"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h4><BookOpen size={16} style={{ verticalAlign: "-3px" }} /> Cours de ma formation</h4>
          {d.cours.length === 0 ? <EmptyState compact titre="Aucun cours rattaché" /> : (
            <>
              <p className="muted">{valides.length} validé{valides.length > 1 ? "s" : ""} · {accessibles.length} accessible{accessibles.length > 1 ? "s" : ""} · {bloques.length} bloqué{bloques.length > 1 ? "s" : ""}</p>
              <div className="chips">
                {valides.map((c) => <span key={c.cours} className="badge ok"><CircleCheck size={13} /> {c.cours}</span>)}
                {accessibles.map((c) => <span key={c.cours} className="badge neutre"><LockOpen size={13} /> {c.cours}</span>)}
                {bloques.map((c) => (
                  <span key={c.cours} className="badge ko" title={`Prérequis manquants : ${c.manquants.join(", ")}`}>
                    <Lock size={13} /> {c.cours}
                  </span>
                ))}
              </div>
              {bloques.length > 0 && (
                <ul className="liste">
                  {bloques.map((c) => <li key={c.cours}><span>{c.cours}</span><span className="muted">il manque {c.manquants.join(", ")}</span></li>)}
                </ul>
              )}
            </>
          )}
        </section>

        <section className="card">
          <h4><ClipboardCheck size={16} style={{ verticalAlign: "-3px" }} /> Relevé de notes</h4>
          {d.releve.length === 0 ? <EmptyState compact titre="Aucune évaluation" /> : (
            <>
              {d.releve.map((r) => (
                <div className="barre" key={r.evaluation} title={r.evaluation}>
                  <span className="barre-label">{r.cours || r.evaluation}</span>
                  <div className="barre-fond">
                    <div className={`barre-valeur ${r.note >= 12 ? "ok" : r.note >= 10 ? "moyen" : "ko"}`} style={{ width: `${(r.note / 20) * 100}%` }} />
                  </div>
                  <span className="barre-chiffre">
                    {r.note}/20 <span className={`mention ${MENTIONS[r.mention] ?? ""}`}>{r.mention}</span>
                  </span>
                </div>
              ))}
              {d.releve.some((r) => r.session === "Rattrapage") && <p className="muted">Inclut des évaluations de rattrapage.</p>}
            </>
          )}
        </section>
      </div>

      <Section icone={Award} titre="Badges et certifications">
        {d.preuves.length === 0 ? <EmptyState icone={Award} titre="Aucune preuve de compétence pour l'instant" /> : (
          <div className="badges-grille">
            {d.preuves.map((p) => (
              <div key={p.preuve} className={`badge-carte ${p.verifiee ? "verifie" : ""}`}>
                {p.verifiee && <BadgeCheck size={18} className="badge-coche" aria-label="vérifié" />}
                <span className="badge-medaille" aria-hidden="true"><Award size={24} /></span>
                <strong>{lisible(p.competence ?? p.preuve)}</strong>
                <span>{p.type ?? "Preuve"}{p.emetteur ? ` · ${p.emetteur}` : ""}</span>
                <span>{p.verifiee ? "vérifiée" : "en attente de vérification"}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <PoseTaQuestion id={ident.etudiant} naviguer={naviguer} />
    </>
  );
}

// « Pose ta question » : ouvre l'assistant avec l'étudiant choisi comme contexte (« ma moyenne » = la sienne).
function PoseTaQuestion({ id, naviguer }) {
  const [question, setQuestion] = useState("");
  const ouvrir = (q) => q.trim() && naviguer?.("Assistant IA", { contexte: [{ id, genre: "individu" }], question: q });
  return (
    <Section icone={MessageSquare} titre="Pose ta question" sousTitre="L'assistant sait que tu parles de toi : « ma moyenne », « mes badges »…">
      <div className="card">
        <form className="question-rapide" onSubmit={(e) => { e.preventDefault(); ouvrir(question); }}>
          <input value={question} onChange={(e) => setQuestion(e.target.value)} aria-label="Ta question"
                 placeholder="Ex. Puis-je suivre Angular ?" />
          <button type="submit" className="primary" disabled={!question.trim()}><Send size={16} /> Demander</button>
        </form>
        <div className="chips" style={{ marginTop: 12 }}>
          {QUESTIONS.map((q) => <button key={q} type="button" className="chip" onClick={() => ouvrir(q)}>{q}</button>)}
        </div>
      </div>
    </Section>
  );
}

// Charge en parallèle toutes les données de l'étudiant, puis les regroupe pour l'affichage.
async function charger(id) {
  const [etudiant, profil, formations, encadrements, recos, manquantes, releve, moyennes, preuves] = await Promise.all([
    api.detail(id),
    api.get(`/api/m1/etudiants/${id}/profil`),
    api.get(`/api/m1/etudiants/${id}/formation`),
    api.get("/api/m1/encadrements"),
    api.get(`/api/m3/etudiants/${id}/recommandations-competences`),
    api.get(`/api/m3/etudiants/${id}/competences-manquantes`),
    api.get(`/api/m4/etudiants/${id}/releve`),
    api.get(`/api/m4/moyennes-ponderees?etudiant=${encodeURIComponent(id)}`),
    api.get("/api/m4/preuves"),
  ]);
  const fiche = fiches(etudiant);
  const formation = formations[0];
  const valides = new Set([].concat(fiche.aValide ?? []));
  const metier = manquantes[0]?.metier || recos[0]?.metier || [].concat(fiche.viseMetier ?? [])[0];

  // Cours de la formation (contientCours) et, pour chacun, les prérequis manquants (M2 peut-suivre)
  const contenus = formation ? [].concat(fiches(await api.detail(formation.formation)).contientCours ?? []) : [];
  const [cours, requises] = await Promise.all([
    Promise.all(contenus.sort().map(async (c) => ({
      cours: c, valide: valides.has(c),
      manquants: valides.has(c) ? [] : (await api.get(`/api/m2/etudiants/${id}/peut-suivre/${c}`)).map((p) => p.prerequisManquant),
    }))),
    metier ? api.get(`/api/m3/metiers/${metier}/competences`) : [],
  ]);

  // Compétences manquantes (M3) avec les cours qui les développent
  const parCompetence = new Map(manquantes.map((m) => [m.competence, { competence: m.competence, cours: [] }]));
  for (const r of recos) {
    const m = parCompetence.get(r.competence) ?? { competence: r.competence, cours: [] };
    m.libelle = r.libelleCompetence;
    if (!m.cours.includes(r.cours)) m.cours.push(r.cours);
    parCompetence.set(r.competence, m);
  }

  return {
    fiche, profil, formation, cours, releve, metier,
    requises: [...new Set(requises.map((r) => r.competence))],
    encadrants: [...new Set(encadrements.filter((e) => e.etudiant === id).map((e) => e.enseignant))],
    manquantes: [...parCompetence.values()],
    moyenne: moyennes[0],
    preuves: preuves.filter((p) => p.etudiant === id),
  };
}

// [{propriete, valeur}] (route générique) -> {propriete: valeur ou [valeurs]}
function fiches(lignes) {
  const f = {};
  for (const { propriete, valeur } of lignes) {
    f[propriete] = propriete in f ? [].concat(f[propriete], valeur) : valeur;
  }
  return f;
}
