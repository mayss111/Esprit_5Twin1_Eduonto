import { useState } from "react";
import ClassePage from "../components/ClassePage.jsx";
import QueryCard from "../components/QueryCard.jsx";

// MEMBRE 4 — Evaluation + PreuveDeCompetence
// Ce fichier est à vous : personnalisez l'affichage de vos deux classes.
// À faire :
//   [ ] ajouter une QueryCard pour chaque nouvelle requête de app/routers/membre4.py
//   [ ] (valeur ajoutée) un affichage plus parlant : cartes, graphique, badges…
const CLASSES = ["Evaluation", "PreuveDeCompetence"];

export default function Membre4() {
  const [classe, setClasse] = useState(CLASSES[0]);
  return (
    <div>
      <h2>Membre 4 · Evaluation + PreuveDeCompetence</h2>
      <div className="tabs">
        {CLASSES.map((c) => (
          <button key={c} className={c === classe ? "active" : ""} onClick={() => setClasse(c)}>{c}</button>
        ))}
      </div>
      <ClassePage classe={classe} />

      <h3>Requêtes SPARQL spécifiques</h3>
      <QueryCard titre="Évaluations au-dessus d'une note" url="/api/m4/evaluations" query={{"noteMin": 12}} />
      <QueryCard titre="Compétences certifiées (classe définie)" url="/api/m4/competences-certifiees" />
    </div>
  );
}
