import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Membre3Insights() {
  const [metiers, setMetiers] = useState([]);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    api.get("/api/m3/metiers-en-tension")
      .then(setMetiers)
      .catch((e) => setErreur(e.message));
  }, []);

  return (
    <section className="card">
      <h3>Panorama des métiers en tension</h3>
      <p className="muted">Une synthèse visuelle des métiers signalés par l’ontologie et de leur niveau d’études requis.</p>
      {erreur ? <p className="error">{erreur}</p> : (
        <>
          <div className="m3-kpi">
            <strong>{metiers.length}</strong>
            <span>métier{metiers.length === 1 ? "" : "s"} en tension</span>
          </div>
          {metiers.length === 0 ? <p className="muted">Aucun métier en tension n’est renseigné dans l’ontologie.</p> : (
            <div className="m3-metiers">
              {metiers.map((metier) => (
                <article className="m3-metier" key={metier.metier}>
                  <span className="badge ko">En tension</span>
                  <strong>{metier.intituleMetier || metier.metier}</strong>
                  <span className="muted">Niveau requis : {metier.niveauEtudesRequis || "non renseigné"}</span>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
