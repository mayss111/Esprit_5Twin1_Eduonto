import { useEffect, useState } from "react";
import { api } from "../api.js";
import ResultTable from "./ResultTable.jsx";

/**
 * CRUD complet pour une grande classe de l'ontologie (et ses sous-classes) :
 *   lister + rechercher, voir le détail, créer, modifier, supprimer.
 * Le formulaire est construit automatiquement à partir des attributs et
 * relations de la classe (GET /api/classes/{classe}/proprietes).
 */
export default function ClassePage({ classe }) {
  const [individus, setIndividus] = useState([]);
  const [recherche, setRecherche] = useState("");
  const [selection, setSelection] = useState(null);   // { id, proprietes: [...] }
  const [mode, setMode] = useState(null);             // null | "creer" | "modifier"
  const [message, setMessage] = useState("");

  async function charger() {
    try {
      setIndividus(await api.individus(classe, recherche));
    } catch (e) {
      setMessage(e.message);
    }
  }

  useEffect(() => {
    setSelection(null);
    setMode(null);
    setRecherche("");
    api.individus(classe).then(setIndividus).catch((e) => setMessage(e.message));
  }, [classe]);

  async function ouvrir(id) {
    setMode(null);
    setSelection({ id, proprietes: await api.detail(id) });
  }

  async function supprimer(id) {
    if (!window.confirm(`Supprimer ${id} ?`)) return;
    await api.supprimer(id);
    setMessage(`${id} supprimé`);
    setSelection(null);
    charger();
  }

  return (
    <section>
      <h3>{classe}</h3>
      <div className="row">
        <input placeholder="Rechercher…" value={recherche} onChange={(e) => setRecherche(e.target.value)}
               onKeyDown={(e) => e.key === "Enter" && charger()} />
        <button onClick={charger}>Rechercher</button>
        <button className="primary" onClick={() => { setSelection(null); setMode("creer"); }}>+ Ajouter</button>
      </div>
      {message && <p className="info" onClick={() => setMessage("")}>{message}</p>}

      <div className="split">
        <ResultTable
          rows={individus}
          onRowClick={(r) => ouvrir(r.individu)}
          actions={(r) => <button className="danger small" onClick={() => supprimer(r.individu)}>Supprimer</button>}
        />

        {selection && !mode && (
          <div className="card">
            <h4>{selection.id}</h4>
            <ResultTable rows={selection.proprietes} />
            <button onClick={() => setMode("modifier")}>Modifier</button>
          </div>
        )}

        {mode && (
          <Formulaire
            classe={classe}
            individu={mode === "modifier" ? selection : null}
            onDone={(txt) => { setMessage(txt); setMode(null); charger(); if (selection) ouvrir(selection.id); }}
            onCancel={() => setMode(null)}
          />
        )}
      </div>
    </section>
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
    <form className="card" onSubmit={envoyer}>
      <h4>{individu ? `Modifier ${individu.id}` : `Nouvel individu de ${classe}`}</h4>
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
          {p.propriete} <span className="muted">({p.genre})</span>
          <input
            value={valeurs[p.propriete] ?? ""}
            onChange={(e) => setValeurs({ ...valeurs, [p.propriete]: e.target.value })}
            placeholder={p.genre === "relation" ? "identifiant(s) d'individu, séparés par des virgules" : ""}
          />
        </label>
      ))}
      {erreur && <p className="error">{erreur}</p>}
      <div className="row">
        <button className="primary" type="submit">Enregistrer</button>
        <button type="button" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}
