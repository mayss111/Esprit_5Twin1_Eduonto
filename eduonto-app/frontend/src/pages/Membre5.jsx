import { useState } from "react";
import ClassePage from "../components/ClassePage.jsx";
import QueryCard from "../components/QueryCard.jsx";

// MEMBRE 5 — RessourcePedagogique + AgentPedagogiqueIA
// Ce fichier est à vous : personnalisez l'affichage de vos deux classes.
// À faire :
//   [ ] ajouter une QueryCard pour chaque nouvelle requête de app/routers/membre5.py
//   [ ] (valeur ajoutée) un affichage plus parlant : cartes, graphique, badges…
const CLASSES = ["RessourcePedagogique", "AgentPedagogiqueIA"];

export default function Membre5() {
  const [classe, setClasse] = useState(CLASSES[0]);
  return (
    <div>
      <h2>Membre 5 · RessourcePedagogique + AgentPedagogiqueIA</h2>
      <div className="tabs">
        {CLASSES.map((c) => (
          <button key={c} className={c === classe ? "active" : ""} onClick={() => setClasse(c)}>{c}</button>
        ))}
      </div>
      <ClassePage classe={classe} />

      <h3>Requêtes SPARQL spécifiques</h3>
      <QueryCard titre="Agents IA fiables" url="/api/m5/agents-fiables" query={{"seuil": 0.9}} />
      <QueryCard titre="Recommandations pour un étudiant" url="/api/m5/recommandations/{etudiant}" params={{"etudiant": "Omar"}} />
    </div>
  );
}
