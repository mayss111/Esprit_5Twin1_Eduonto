import { useState } from "react";
import ClassePage from "../components/ClassePage.jsx";
import QueryCard from "../components/QueryCard.jsx";

// MEMBRE 3 — Competence + Metier
// Ce fichier est à vous : personnalisez l'affichage de vos deux classes.
// À faire :
//   [ ] ajouter une QueryCard pour chaque nouvelle requête de app/routers/membre3.py
//   [ ] (valeur ajoutée) un affichage plus parlant : cartes, graphique, badges…
const CLASSES = ["Competence", "Metier"];

export default function Membre3() {
  const [classe, setClasse] = useState(CLASSES[0]);
  return (
    <div>
      <h2>Membre 3 · Competence + Metier</h2>
      <div className="tabs">
        {CLASSES.map((c) => (
          <button key={c} className={c === classe ? "active" : ""} onClick={() => setClasse(c)}>{c}</button>
        ))}
      </div>
      <ClassePage classe={classe} />

      <h3>Requêtes SPARQL spécifiques</h3>
      <QueryCard titre="Compétences requises par un métier" url="/api/m3/metiers/{metier}/competences" params={{"metier": "DeveloppeurFullStack"}} />
      <QueryCard titre="Compétences manquantes d'un étudiant" url="/api/m3/etudiants/{etudiant}/competences-manquantes" params={{"etudiant": "Ahmed"}} />
    </div>
  );
}
