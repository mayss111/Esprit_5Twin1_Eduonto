import { useState } from "react";
import { LoaderCircle, Play } from "lucide-react";
import { api } from "../api.js";
import ResultTable from "./ResultTable.jsx";
import SparqlBlock from "./SparqlBlock.jsx";

/**
 * Carte qui appelle une requête spécifique d'un membre (GET).
 *   titre  : texte affiché
 *   url    : chemin avec paramètres entre accolades, ex. "/api/m2/cours/{cours}/prerequis"
 *   params : valeurs par défaut, ex. { cours: "Angular" }
 *   query  : paramètres ?clé=valeur, ex. { noteMin: 12 }
 */
export default function QueryCard({ titre, url, params = {}, query = {} }) {
  const [valeurs, setValeurs] = useState({ ...params, ...query });
  const [rows, setRows] = useState(null);
  const [sparql, setSparql] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);

  async function lancer(e) {
    e?.preventDefault();
    setErreur("");
    setChargement(true);
    let chemin = url.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(valeurs[k] ?? ""));
    const qs = Object.keys(query)
      .filter((k) => valeurs[k] !== "")
      .map((k) => `${k}=${encodeURIComponent(valeurs[k])}`)
      .join("&");
    if (qs) chemin += `?${qs}`;
    try {
      const { data, sparql } = await api.getAvecSparql(chemin);
      setRows(data);
      setSparql(sparql);
    } catch (e2) {
      setErreur(e2.message);
      setSparql("");
    } finally {
      setChargement(false);
    }
  }

  return (
    <form className="card" onSubmit={lancer}>
      <div className="qc-entete">
        <h4>{titre}</h4>
        <span className="tag-get">GET</span>
      </div>
      <code className="url">{url}</code>
      <div className="qc-champs">
        {Object.keys(valeurs).map((k) => (
          <label key={k}>
            {k}
            <input value={valeurs[k]} onChange={(e) => setValeurs({ ...valeurs, [k]: e.target.value })} />
          </label>
        ))}
        <div>
          <button type="submit" className="primary" disabled={chargement}>
            {chargement ? <LoaderCircle size={16} className="spinner" /> : <Play size={16} />}
            {chargement ? "Exécution…" : "Exécuter"}
          </button>
        </div>
      </div>
      {erreur && <p className="error" role="alert">{erreur}</p>}
      {rows && <div className="qc-resultat"><ResultTable rows={rows} /></div>}
      <SparqlBlock sparql={sparql} />
    </form>
  );
}
