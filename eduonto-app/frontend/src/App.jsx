import { useState } from "react";
import Accueil from "./pages/Accueil.jsx";
import Assistant from "./pages/Assistant.jsx";
import Membre1 from "./pages/Membre1.jsx";
import Membre2 from "./pages/Membre2.jsx";
import Membre3 from "./pages/Membre3.jsx";
import Membre4 from "./pages/Membre4.jsx";
import Membre5 from "./pages/Membre5.jsx";
import Membre6 from "./pages/Membre6.jsx";

const PAGES = [
  { titre: "Accueil", composant: Accueil },
  { titre: "Personne · Formation", composant: Membre1 },
  { titre: "Cours · Domaine", composant: Membre2 },
  { titre: "Compétence · Métier", composant: Membre3 },
  { titre: "Évaluation · Preuve", composant: Membre4 },
  { titre: "Ressource · Agent IA", composant: Membre5 },
  { titre: "Parcours · Indicateur", composant: Membre6 },
  { titre: "Assistant IA", composant: Assistant },
];

export default function App() {
  const [page, setPage] = useState(0);
  const Page = PAGES[page].composant;
  return (
    <div className="layout">
      <nav>
        <div className="logo">EduOnto</div>
        {PAGES.map((p, i) => (
          <button key={p.titre} className={i === page ? "active" : ""} onClick={() => setPage(i)}>{p.titre}</button>
        ))}
      </nav>
      <main><Page /></main>
    </div>
  );
}
