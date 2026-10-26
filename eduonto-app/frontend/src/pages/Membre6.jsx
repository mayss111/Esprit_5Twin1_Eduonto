import { useState } from "react";
import ClassePage from "../components/ClassePage.jsx";
import QueryCard from "../components/QueryCard.jsx";

// MEMBRE 6 — ParcoursApprentissage + IndicateurApprentissage
// Ce fichier est à vous : personnalisez l'affichage de vos deux classes.
// À faire :
//   [ ] ajouter une QueryCard pour chaque nouvelle requête de app/routers/membre6.py
//   [ ] (valeur ajoutée) un affichage plus parlant : cartes, graphique, badges…
const CLASSES = ["ParcoursApprentissage", "IndicateurApprentissage"];

export default function Membre6() {
  const [classe, setClasse] = useState(CLASSES[0]);
  return (
    <div>
      <h2>Membre 6 · ParcoursApprentissage + IndicateurApprentissage</h2>
      <div className="tabs">
        {CLASSES.map((c) => (
          <button key={c} className={c === classe ? "active" : ""} onClick={() => setClasse(c)}>{c}</button>
        ))}
      </div>
      <ClassePage classe={classe} />

      <h3>Requêtes SPARQL spécifiques</h3>
      <QueryCard titre="Étudiants à risque (assiduité < seuil)" url="/api/m6/etudiants-a-risque" query={{"seuil": 0.6}} />
      <QueryCard titre="Cours d'un parcours" url="/api/m6/parcours/{parcours}/cours" params={{"parcours": "Parcours_FullStack"}} />
    </div>
  );
}
