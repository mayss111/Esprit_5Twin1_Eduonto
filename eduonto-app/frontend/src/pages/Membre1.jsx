import { useState } from "react";
import ClassePage from "../components/ClassePage.jsx";
import QueryCard from "../components/QueryCard.jsx";

// MEMBRE 1 — Personne + Formation
// Ce fichier est à vous : personnalisez l'affichage de vos deux classes.
// À faire :
//   [ ] ajouter une QueryCard pour chaque nouvelle requête de app/routers/membre1.py
//   [ ] (valeur ajoutée) un affichage plus parlant : cartes, graphique, badges…
const CLASSES = ["Personne", "Formation"];

export default function Membre1() {
  const [classe, setClasse] = useState(CLASSES[0]);
  return (
    <div>
      <h2>Membre 1 · Personne + Formation</h2>
      <div className="tabs">
        {CLASSES.map((c) => (
          <button key={c} className={c === classe ? "active" : ""} onClick={() => setClasse(c)}>{c}</button>
        ))}
      </div>
      <ClassePage classe={classe} />

      <h3>Requêtes SPARQL spécifiques</h3>
      <QueryCard titre="Étudiants par année" url="/api/m1/etudiants" query={{"annee": 4}} />
      <QueryCard titre="Formation d'un étudiant" url="/api/m1/etudiants/{etudiant}/formation" params={{"etudiant": "Ahmed"}} />
    </div>
  );
}
