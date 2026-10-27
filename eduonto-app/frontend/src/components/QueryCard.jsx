import { useState } from "react";
import { LoaderCircle, Play } from "lucide-react";
import { api } from "../api.js";
import ResultTable from "./ResultTable.jsx";
import SparqlBlock from "./SparqlBlock.jsx";
import { controlerRequete, invalide } from "../validation.js";

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
  const [erreurs, setErreurs] = useState({});
  const [chargement, setChargement] = useState(false);

  async function lancer(e) {
    e?.preventDefault();
    const propres = Object.fromEntries(Object.entries(valeurs).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]));
    const eurs = controlerRequete(url, propres);
    setErreurs(eurs);
    if (invalide(eurs)) return;
    setErreur("");
    setChargement(true);
    let chemin = url.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(propres[k] ?? ""));
    const qs = Object.keys(query)
      .filter((k) => propres[k] !== "")
      .map((k) => `${k}=${encodeURIComponent(propres[k])}`)
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
    <form className="card" onSubmit={lancer} noValidate>
      <div className="qc-entete">
        <h4>{titre}</h4>
        <span className="tag-get">GET</span>
      </div>
      <code className="url">{url}</code>
      <div className="qc-champs">
        {Object.keys(valeurs).map((k) => (
          <label key={k} className={erreurs[k] ? "invalide" : ""}>
            {k}
            <input value={valeurs[k]} aria-invalid={!!erreurs[k]}
                   onChange={(e) => {
                     const suivant = { ...valeurs, [k]: e.target.value };
                     setValeurs(suivant);
                     if (erreurs[k]) setErreurs(controlerRequete(url, suivant));
                   }} />
            {erreurs[k] && <span className="champ-erreur" role="alert">{erreurs[k]}</span>}
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
