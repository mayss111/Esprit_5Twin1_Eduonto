import { useEffect, useState } from "react";
import { Pencil, Plus, Search, Trash2, TriangleAlert, X } from "lucide-react";
import { api } from "../api.js";
import EmptyState from "./EmptyState.jsx";
import Modal from "./Modal.jsx";
import Skeleton from "./Skeleton.jsx";
import { useToast } from "./Toast.jsx";

/**
 * CRUD complet pour une grande classe de l'ontologie (et ses sous-classes) :
 *   lister + rechercher, voir le détail, créer, modifier, supprimer.
 * Le formulaire est construit automatiquement à partir des attributs et
 * relations de la classe (GET /api/classes/{classe}/proprietes).
 */
export default function ClassePage({ classe }) {
  const [individus, setIndividus] = useState(null);
  const [recherche, setRecherche] = useState("");
  const [selection, setSelection] = useState(null);   // { id, proprietes: [...] }
  const [mode, setMode] = useState(null);             // null | "creer" | "modifier"
  const [aSupprimer, setASupprimer] = useState(null);
  const [assertables, setAssertables] = useState(new Set());   // sous-classes non définies (les autres sont déduites)
  const toast = useToast();

  async function charger() {
    try {
      setIndividus(await api.individus(classe, recherche));
    } catch (e) {
      toast.erreur(e.message);
    }
  }

  useEffect(() => {
    setSelection(null);
    setMode(null);
    setRecherche("");
    setIndividus(null);
    api.individus(classe).then(setIndividus).catch((e) => toast.erreur(e.message));
    api.sousClasses(classe).then((r) => setAssertables(new Set([classe, ...r.map((x) => x.sousClasse)]))).catch(() => {});
  }, [classe]);

  async function ouvrir(id) {
    setMode(null);
    try {
      setSelection({ id, proprietes: await api.detail(id) });
    } catch (e) {
      toast.erreur(e.message);
    }
  }

  async function supprimer() {
    const id = aSupprimer;
    setASupprimer(null);
    try {
      await api.supprimer(id);
      toast.succes(`${id} supprimé`);
      if (selection?.id === id) setSelection(null);
      charger();
    } catch (e) {
      toast.erreur(e.message);
    }
  }

  const types = (texte) => (texte ?? "").split(",").map((t) => t.trim()).filter((t) => t && t !== "NamedIndividual");

  return (
    <section>
      <h3 className="sr-only">{classe}</h3>
      <form className="barre-outils" role="search" onSubmit={(e) => { e.preventDefault(); charger(); }}>
        <label className="champ-recherche">
          <Search size={16} />
          <input placeholder={`Rechercher dans ${classe}…`} value={recherche} aria-label={`Rechercher dans ${classe}`}
                 onChange={(e) => setRecherche(e.target.value)} />
        </label>
        <button type="submit">Rechercher</button>
        <button type="button" className="primary" onClick={() => { setSelection(null); setMode("creer"); }}>
          <Plus size={16} /> Ajouter
        </button>
      </form>

      <div className={`cp-split ${selection || mode ? "avec-panneau" : ""}`}>
        <div className="rt">
          {individus === null ? <div className="card"><Skeleton lignes={6} /></div>
            : individus.length === 0 ? <EmptyState titre="Aucun individu" texte="Modifiez la recherche ou ajoutez un individu." />
            : (
              <>
                <div className="rt-outils">
                  <span className="rt-compteur">{individus.length} individu{individus.length > 1 ? "s" : ""}</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Individu</th><th>Types</th><th><span className="sr-only">Actions</span></th></tr></thead>
                    <tbody>
                      {individus.map((r) => (
                        <tr key={r.individu} tabIndex={0}
                            className={`clickable ${selection?.id === r.individu ? "selectionnee" : ""}`}
                            onClick={() => ouvrir(r.individu)} onKeyDown={(e) => e.key === "Enter" && ouvrir(r.individu)}>
                          <td><code className="mono">{r.individu}</code></td>
                          <td>
                            <div className="types">
                              {types(r.types).map((t) => (
                                <span key={t} className={`badge ${assertables.has(t) ? "neutre" : "deduit"}`}
                                      title={assertables.has(t) ? "classe affirmée" : "classe déduite par le raisonneur"}>{t}</span>
                              ))}
                            </div>
                          </td>
                          <td className="actions" onClick={(e) => e.stopPropagation()}>
                            <button type="button" className="icone-btn danger" aria-label={`Supprimer ${r.individu}`}
                                    title="Supprimer" onClick={() => setASupprimer(r.individu)}>
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
        </div>

        {selection && !mode && (
          <div className="card cp-panneau">
            <div className="cp-panneau-entete">
              <h4>{selection.id}</h4>
              <button type="button" className="icone-btn" aria-label="Fermer le détail" onClick={() => setSelection(null)}><X size={16} /></button>
            </div>
            <dl className="fiche">
              {selection.proprietes.map((p, i) => (
                <FicheLigne key={i} p={p} deduit={p.propriete === "type" && !assertables.has(p.valeur)} />
              ))}
            </dl>
            <div className="form-actions">
              <button type="button" onClick={() => setMode("modifier")}><Pencil size={15} /> Modifier</button>
              <button type="button" className="danger" onClick={() => setASupprimer(selection.id)}><Trash2 size={15} /> Supprimer</button>
            </div>
          </div>
        )}

        {mode && (
          <Formulaire
            classe={classe}
            individu={mode === "modifier" ? selection : null}
            onDone={(txt) => { toast.succes(txt); setMode(null); charger(); if (selection) ouvrir(selection.id); }}
            onCancel={() => setMode(null)}
          />
        )}
      </div>

      <Modal ouvert={!!aSupprimer} titre="Supprimer cet individu ?" icone={TriangleAlert} onFermer={() => setASupprimer(null)}
             actions={<>
               <button type="button" onClick={() => setASupprimer(null)}>Annuler</button>
               <button type="button" className="danger plein" onClick={supprimer}><Trash2 size={15} /> Supprimer</button>
             </>}>
        <p><code className="mono">{aSupprimer}</code> et tous les liens qui pointent vers lui seront supprimés
          (deux requêtes DELETE WHERE). Cette action est définitive.</p>
      </Modal>
    </section>
  );
}

function FicheLigne({ p, deduit }) {
  const v = typeof p.valeur === "boolean" ? (p.valeur ? "oui" : "non") : String(p.valeur);
  return (
    <>
      <dt>{p.propriete}</dt>
      <dd>{p.propriete === "type"
        ? <span className={`badge ${deduit ? "deduit" : "neutre"}`}>{v}</span>
        : v}</dd>
    </>
  );
}

function Formulaire({ classe, individu, onDone, onCancel }) {
  const [proprietes, setProprietes] = useState([]);
  const [sousClasses, setSousClasses] = useState([]);
  const [id, setId] = useState(individu?.id ?? "");
  const [type, setType] = useState(classe);
  const [valeurs, setValeurs] = useState({});
  const [erreur, setErreur] = useState("");

  // Valeurs actuelles en mode modification
  useEffect(() => {
    if (!individu) return;
    const v = {};
    for (const p of individu.proprietes) {
      if (p.propriete === "type") continue;
      v[p.propriete] = v[p.propriete] ? `${v[p.propriete]}, ${p.valeur}` : String(p.valeur);
    }
    setValeurs(v);
  }, [individu]);

  // Sous-classes (pour choisir le type exact) et propriétés de la classe choisie
  useEffect(() => { api.sousClasses(classe).then(setSousClasses); }, [classe]);
  useEffect(() => {
    // En modification : propriétés de tous les types de l'individu (ex. Etudiant, EtudiantIngenieur…)
    const types = individu
      ? individu.proprietes.filter((p) => p.propriete === "type" && p.valeur !== "NamedIndividual").map((p) => p.valeur)
      : [type];
    Promise.all(types.map((t) => api.proprietes(t))).then((listes) => {
      const vues = new Map();
      listes.flat().forEach((p) => vues.set(p.propriete, p));
      setProprietes([...vues.values()].sort((a, b) => a.genre.localeCompare(b.genre) || a.propriete.localeCompare(b.propriete)));
    });
  }, [type, individu]);

  async function envoyer(e) {
    e.preventDefault();
    setErreur("");
    const props = {};
    for (const p of proprietes) {
      const v = (valeurs[p.propriete] ?? "").trim();
      if (!v) continue;
      // Une relation peut avoir plusieurs valeurs séparées par des virgules
      props[p.propriete] = p.genre === "relation" ? v.split(",").map((s) => s.trim()).filter(Boolean) : v;
    }
    try {
      if (individu) {
        await api.modifier(individu.id, props);
        onDone(`${individu.id} modifié`);
      } else {
        await api.creer(id, type, props);
        onDone(`${id} créé`);
      }
    } catch (err) {
      setErreur(err.message);
    }
  }

  return (
    <form className="card cp-panneau" onSubmit={envoyer}>
      <div className="cp-panneau-entete">
        <h4>{individu ? `Modifier ${individu.id}` : `Nouvel individu de ${classe}`}</h4>
        <button type="button" className="icone-btn" aria-label="Fermer le formulaire" onClick={onCancel}><X size={16} /></button>
      </div>
      <div className="form-grille">
        {!individu && (
          <>
            <label>Identifiant (sans espace ni accent)
              <input required value={id} onChange={(e) => setId(e.target.value)} placeholder="ex. Rim_Saidi" />
            </label>
            <label>Classe
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option>{classe}</option>
                {sousClasses.map((s) => <option key={s.sousClasse}>{s.sousClasse}</option>)}
              </select>
            </label>
          </>
        )}
        {proprietes.map((p) => (
          <label key={p.propriete}>
            <span>{p.propriete} <span className="muted">({p.genre})</span></span>
            <input
              value={valeurs[p.propriete] ?? ""}
              onChange={(e) => setValeurs({ ...valeurs, [p.propriete]: e.target.value })}
              placeholder={p.genre === "relation" ? "identifiant(s), séparés par des virgules" : ""}
            />
          </label>
        ))}
      </div>
      {erreur && <p className="error" role="alert">{erreur}</p>}
      <div className="form-actions">
        <button className="primary" type="submit">Enregistrer</button>
        <button type="button" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}
