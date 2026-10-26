import { useState } from "react";
import ClassePage from "../components/ClassePage.jsx";
import QueryCard from "../components/QueryCard.jsx";

// MEMBRE 2 — Cours + Domaine
// Ce fichier est à vous : personnalisez l'affichage de vos deux classes.
// À faire :
//   [ ] ajouter une QueryCard pour chaque nouvelle requête de app/routers/membre2.py
//   [ ] (valeur ajoutée) un affichage plus parlant : cartes, graphique, badges…
const CLASSES = ["Cours", "Domaine"];

export default function Membre2() {
  const [classe, setClasse] = useState(CLASSES[0]);
  return (
    <div>
      <h2>Membre 2 · Cours + Domaine</h2>
      <div className="tabs">
        {CLASSES.map((c) => (
          <button key={c} className={c === classe ? "active" : ""} onClick={() => setClasse(c)}>{c}</button>
        ))}
      </div>
      <ClassePage classe={classe} />

      <h3>Requêtes SPARQL spécifiques</h3>
      <QueryCard titre="Prérequis d'un cours (transitif : aPourPrerequis+)" url="/api/m2/cours/{cours}/prerequis" params={{"cours": "Angular"}} />
      <QueryCard titre="Cours d'un domaine (et de ses sous-domaines)" url="/api/m2/cours" query={{"domaine": "GenieLogiciel"}} />
    </div>
  );
}
