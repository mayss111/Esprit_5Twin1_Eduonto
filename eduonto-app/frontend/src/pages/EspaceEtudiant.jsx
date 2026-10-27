import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import ResultTable from "../components/ResultTable.jsx";

// FRONT-OFFICE — tableau de bord d'un étudiant.
// Construit uniquement avec les routes des membres 1 à 4 (et la fiche générique /api/individus/{id}) :
//   M1 profil, formation, encadrements · M2 peut-suivre · M3 recommandations · M4 relevé, moyenne, preuves.
const QUESTIONS = ["Quelle est ma moyenne ?", "Quelles sont mes notes ?", "Quels badges ai-je obtenus ?",
                   "Quelles compétences me manquent ?", "Qui m'encadre ?"];

export default function EspaceEtudiant() {
  const [etudiants, setEtudiants] = useState([]);
  const [id, setId] = useState("");
  const [d, setD] = useState(null);                 // toutes les données du tableau de bord
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const demande = useRef(0);                        // ignore les réponses d'un étudiant choisi précédemment

  useEffect(() => {
    api.get("/api/m1/etudiants").then((r) => {
      setEtudiants(r);
      if (r.length) setId(r[0].etudiant);
    }).catch((e) => setErreur(e.message));
  }, []);

  useEffect(() => {
    if (!id) return;
    const numero = ++demande.current;
    setChargement(true);
    setErreur("");
    charger(id)
      .then((donnees) => { if (numero === demande.current) setD(donnees); })
      .catch((e) => { if (numero === demande.current) setErreur(e.message); })
      .finally(() => { if (numero === demande.current) setChargement(false); });
  }, [id]);

  const ident = etudiants.find((e) => e.etudiant === id);
  const nom = ident ? [ident.prenom, ident.nom].filter(Boolean).join(" ") || id : id;

  return (
    <div className="fo">
      <div className="fo-entete">
        <div>
          <p className="fo-sur-titre">Espace étudiant</p>
          <h2>{d ? `Bonjour ${ident?.prenom || id}` : "Mon tableau de bord"}</h2>
          {d && <p className="muted">{d.formation?.intitule || d.formation?.formation || "Formation non renseignée"}
            {d.fiche.anneeEtude ? ` · ${d.fiche.anneeEtude}e année` : ""}</p>}
        </div>
        <label>Je suis
          <select value={id} onChange={(e) => setId(e.target.value)}>
            {etudiants.map((e) => (
              <option key={e.etudiant} value={e.etudiant}>{[e.prenom, e.nom].filter(Boolean).join(" ") || e.etudiant}</option>
            ))}
          </select>
        </label>
      </div>
      {erreur && <p className="error">{erreur}</p>}
      {chargement && !d && <p className="muted">Chargement…</p>}

      {d && (
        <>
          <div className="fo-kpis">
            <Kpi valeur={d.moyenne?.moyennePonderee ?? "—"} libelle="moyenne pondérée"
                 etat={d.moyenne ? (d.moyenne.decision === "Admis" ? "ok" : "ko") : ""}
                 detail={d.moyenne?.decision} />
            <Kpi valeur={d.releve.length} libelle={`évaluation${d.releve.length === 1 ? "" : "s"}`} />
            <Kpi valeur={d.preuves.length} libelle={`badge${d.preuves.length === 1 ? "" : "s"} / certification${d.preuves.length === 1 ? "" : "s"}`} />
            <Kpi valeur={d.manquantes.length} libelle={`compétence${d.manquantes.length === 1 ? "" : "s"} à acquérir`}
                 etat={d.manquantes.length ? "ko" : "ok"} detail={d.metier ? `pour ${d.metier}` : "aucun métier visé"} />
          </div>

          <div className="fo-grille">
            <section className="card">
              <h4>Mon profil</h4>
              <dl className="fo-fiche">
                <dt>Nom</dt><dd>{nom}</dd>
                <dt>Formation</dt><dd>{d.formation?.intitule || d.formation?.formation || "—"}</dd>
                <dt>Encadrant</dt><dd>{d.encadrants.length ? d.encadrants.join(", ") : "aucun"}</dd>
                <dt>Boursier</dt><dd>{d.fiche.estBoursier === true ? "oui" : "non"}</dd>
                <dt>Métier visé</dt><dd>{d.metier || "—"}</dd>
              </dl>
              <p className="muted">Mes classes dans l'ontologie :</p>
              <div className="chips">
                {d.profil.map((p) => (
                  <span key={p.classe} className={`badge ${p.origine === "affirmée" ? "neutre" : "ok"}`}
                        title={p.origine}>{p.classe}</span>
                ))}
              </div>
              <p className="muted fo-legende"><span className="badge ok">vert</span> = classe déduite par HermiT</p>
            </section>

            <section className="card">
              <h4>Cours de ma formation</h4>
              {d.cours.length === 0 && <p className="muted">Aucun cours rattaché à la formation.</p>}
              <ul className="fo-liste">
                {d.cours.map((c) => (
                  <li key={c.cours}>
                    <span>{c.cours}</span>
                    {c.valide ? <span className="badge ok">validé</span>
                      : c.manquants.length === 0 ? <span className="badge neutre">accessible</span>
                      : <span className="badge ko" title="prérequis non validés">il manque {c.manquants.join(", ")}</span>}
                  </li>
                ))}
              </ul>
            </section>

            <section className="card">
              <h4>Compétences à acquérir {d.metier && <span className="muted">· {d.metier}</span>}</h4>
              {d.manquantes.length === 0 && <p className="muted">
                {d.metier ? "Toutes les compétences du métier visé sont certifiées." : "Aucun métier visé."}</p>}
              <ul className="fo-liste">
                {d.manquantes.map((m) => (
                  <li key={m.competence}>
                    <span>{m.libelle || m.competence}</span>
                    <span className="muted">{m.cours.length ? `cours conseillé : ${m.cours.join(", ")}` : "aucun cours associé"}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="card">
              <h4>Badges et certifications</h4>
              {d.preuves.length === 0 && <p className="muted">Aucune preuve de compétence pour l'instant.</p>}
              <ul className="fo-liste">
                {d.preuves.map((p) => (
                  <li key={p.preuve}>
                    <span>{p.type || p.preuve} · {p.competence}</span>
                    <span className={`badge ${p.verifiee ? "ok" : "neutre"}`}>{p.verifiee ? "vérifiée" : "non vérifiée"}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="card fo-large">
              <h4>Relevé de notes</h4>
              {d.releve.length === 0 ? <p className="muted">Aucune évaluation.</p> : d.releve.map((r) => (
                <div className="barre" key={r.evaluation} title={r.evaluation}>
                  <span className="barre-label">{r.cours || r.evaluation}</span>
                  <div className="barre-fond">
                    <div className={`barre-valeur ${r.note >= 10 ? "ok" : "ko"}`} style={{ width: `${(r.note / 20) * 100}%` }} />
                  </div>
                  <span className="barre-chiffre">{r.note} / 20 · {r.mention}</span>
                </div>
              ))}
            </section>

            <QuestionEtudiant id={id} />
          </div>
        </>
      )}
    </div>
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

  // Cours de la formation (contientCours) et, pour chacun, les prérequis manquants (M2 peut-suivre)
  const contenus = formation ? [].concat(fiches(await api.detail(formation.formation)).contientCours ?? []) : [];
  const cours = await Promise.all(contenus.sort().map(async (c) => ({
    cours: c, valide: valides.has(c),
    manquants: valides.has(c) ? [] : (await api.get(`/api/m2/etudiants/${id}/peut-suivre/${c}`)).map((p) => p.prerequisManquant),
  })));

  // Compétences manquantes (M3) avec les cours qui les développent
  const parCompetence = new Map(manquantes.map((m) => [m.competence, { competence: m.competence, cours: [] }]));
  for (const r of recos) {
    const m = parCompetence.get(r.competence) ?? { competence: r.competence, cours: [] };
    m.libelle = r.libelleCompetence;
    if (!m.cours.includes(r.cours)) m.cours.push(r.cours);
    parCompetence.set(r.competence, m);
  }

  return {
    fiche, profil, formation, cours, releve,
    encadrants: [...new Set(encadrements.filter((e) => e.etudiant === id).map((e) => e.enseignant))],
    metier: manquantes[0]?.metier || recos[0]?.metier || [].concat(fiche.viseMetier ?? [])[0],
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

function Kpi({ valeur, libelle, detail, etat = "" }) {
  return (
    <div className={`fo-kpi ${etat}`}>
      <strong>{valeur}</strong>
      <span>{libelle}</span>
      {detail && <span className="muted">{detail}</span>}
    </div>
  );
}

// « Poser une question » : l'assistant reçoit l'étudiant choisi comme contexte (« ma moyenne » = la sienne).
function QuestionEtudiant({ id }) {
  const [question, setQuestion] = useState("");
  const [rep, setRep] = useState(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => { setRep(null); setQuestion(""); }, [id]);

  async function poser(q = question) {
    if (!q.trim()) return;
    setQuestion(q);
    setErreur("");
    try {
      setRep(await api.ask(q, [{ id, genre: "individu" }]));
    } catch (e) {
      setErreur(e.message);
    }
  }

  return (
    <section className="card fo-large">
      <h4>Poser une question</h4>
      <div className="row">
        <input className="grow" value={question} onChange={(e) => setQuestion(e.target.value)}
               onKeyDown={(e) => e.key === "Enter" && poser()} placeholder="Ex. Puis-je suivre Angular ?" />
        <button className="primary" onClick={() => poser()}>Demander</button>
      </div>
      <div className="chips">
        {QUESTIONS.map((q) => <button key={q} className="chip" onClick={() => poser(q)}>{q}</button>)}
      </div>
      {erreur && <p className="error">{erreur}</p>}
      {rep && (
        <>
          <p className="muted">
            {rep.intention ? <>Intention <b>{rep.intention}</b> · {rep.methode} · confiance {Math.round((rep.confiance ?? 0) * 100)} %</>
              : rep.message}
          </p>
          {rep.suggestions?.length > 0 && (
            <div className="chips">
              {rep.suggestions.map((s) => <button key={s} className="chip" onClick={() => poser(s)}>{s}</button>)}
            </div>
          )}
          <ResultTable rows={rep.resultats} />
        </>
      )}
    </section>
  );
}
