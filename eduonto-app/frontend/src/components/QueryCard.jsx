import { useState } from "react";
import { api } from "../api.js";
import ResultTable from "./ResultTable.jsx";

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
  const [erreur, setErreur] = useState("");

  async function lancer() {
    setErreur("");
    let chemin = url.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(valeurs[k] ?? ""));
    const qs = Object.keys(query)
      .filter((k) => valeurs[k] !== "")
      .map((k) => `${k}=${encodeURIComponent(valeurs[k])}`)
      .join("&");
    if (qs) chemin += `?${qs}`;
    try {
      setRows(await api.get(chemin));
    } catch (e) {
      setErreur(e.message);
    }
  }

  return (
    <div className="card">
      <h4>{titre}</h4>
      <div className="row">
        {Object.keys(valeurs).map((k) => (
          <label key={k}>
            {k}
            <input value={valeurs[k]} onChange={(e) => setValeurs({ ...valeurs, [k]: e.target.value })} />
          </label>
        ))}
        <button onClick={lancer}>Exécuter</button>
      </div>
      <code className="url">GET {url}</code>
      {erreur && <p className="error">{erreur}</p>}
      <ResultTable rows={rows} />
    </div>
  );
}
