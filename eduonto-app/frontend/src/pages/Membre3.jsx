import { useState } from "react";
import ClassePage from "../components/ClassePage.jsx";
import QueryCard from "../components/QueryCard.jsx";
import Membre3Insights from "../components/Membre3Insights.jsx";

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

      <Membre3Insights />

      <h3>Requêtes SPARQL spécifiques</h3>
      <QueryCard titre="Compétences requises par un métier" url="/api/m3/metiers/{metier}/competences" params={{"metier": "DeveloppeurFullStack"}} />
      <QueryCard titre="Compétences manquantes d'un étudiant" url="/api/m3/etudiants/{etudiant}/competences-manquantes" params={{"etudiant": "Ahmed"}} />
      <QueryCard titre="Métiers en tension" url="/api/m3/metiers-en-tension" />
      <QueryCard titre="Cours qui développent une compétence" url="/api/m3/competences/{competence}/cours" params={{"competence": "DeveloppementFrontend"}} />
      <QueryCard titre="Métiers accessibles selon le niveau d'études" url="/api/m3/metiers/niveau-etudes" query={{"niveau": "Master"}} />

      <h3>Scénario de recommandation</h3>
      <p className="muted">Pour Ahmed : relier les compétences manquantes de son métier visé aux cours qui les développent.</p>
      <QueryCard titre="Compétences à acquérir et cours conseillés" url="/api/m3/etudiants/{etudiant}/recommandations-competences" params={{"etudiant": "Ahmed"}} />
    </div>
  );
}
