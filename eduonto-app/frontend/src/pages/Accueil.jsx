import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Accueil() {
  const [etat, setEtat] = useState(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    api.get("/api/health").then(setEtat).catch(() => setErreur("Back-end injoignable : lancez uvicorn sur le port 8000."));
  }, []);

  async function reset() {
    if (!window.confirm("Effacer toutes les modifications et revenir à l'ontologie d'origine ?")) return;
    setEtat(await api.post("/api/reset"));
  }

  return (
    <div>
      <h2>EduOnto · ontologie Éducation et Formation</h2>
      {erreur && <p className="error">{erreur}</p>}
      {etat && (
        <div className="card">
          <p>Ontologie chargée : <b>{etat.ontologie}</b> — {etat.triplets} triplets</p>
          <button className="danger" onClick={reset}>Réinitialiser les données</button>
        </div>
      )}
      <div className="card">
        <h4>Architecture</h4>
        <pre>{`React (Vite)  ──HTTP/JSON──▶  FastAPI  ──SPARQL 1.1──▶  rdflib  ──▶  EduOnto_inferred.owl
                                   │                                       ▲
                                   └─▶ spaCy + Hugging Face (NLP → SPARQL)   └── HermiT (owlready2)`}</pre>
        <p>Documentation interactive du back-end : <a href="http://localhost:8000/docs" target="_blank">localhost:8000/docs</a></p>
      </div>
    </div>
  );
}
