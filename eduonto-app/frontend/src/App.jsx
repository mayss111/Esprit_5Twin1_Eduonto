import { useState } from "react";
import Accueil from "./pages/Accueil.jsx";
import Assistant from "./pages/Assistant.jsx";
import EspaceEtudiant from "./pages/EspaceEtudiant.jsx";
import Membre1 from "./pages/Membre1.jsx";
import Membre2 from "./pages/Membre2.jsx";
import Membre3 from "./pages/Membre3.jsx";
import Membre4 from "./pages/Membre4.jsx";
import Membre5 from "./pages/Membre5.jsx";
import Membre6 from "./pages/Membre6.jsx";

// Front-office : ce que voit l'étudiant. Back-office : gestion de l'ontologie, page par membre.
const GROUPES = [
  { titre: "Front-office", pages: [
    { titre: "Espace étudiant", composant: EspaceEtudiant },
    { titre: "Assistant IA", composant: Assistant },
  ] },
  { titre: "Back-office", pages: [
    { titre: "Accueil", composant: Accueil },
    { titre: "Personne · Formation", composant: Membre1 },
    { titre: "Cours · Domaine", composant: Membre2 },
    { titre: "Compétence · Métier", composant: Membre3 },
    { titre: "Évaluation · Preuve", composant: Membre4 },
    { titre: "Ressource · Agent IA", composant: Membre5 },
    { titre: "Parcours · Indicateur", composant: Membre6 },
  ] },
];
const PAGES = GROUPES.flatMap((g) => g.pages);

export default function App() {
  const [page, setPage] = useState("Accueil");
  const Page = PAGES.find((p) => p.titre === page).composant;
  return (
    <div className="layout">
      <nav>
        <div className="logo">EduOnto</div>
        {GROUPES.map((g) => (
          <div key={g.titre} className="nav-groupe">
            <div className="nav-titre">{g.titre}</div>
            {g.pages.map((p) => (
              <button key={p.titre} className={p.titre === page ? "active" : ""} onClick={() => setPage(p.titre)}>
                {p.titre}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <main><Page /></main>
    </div>
  );
}
