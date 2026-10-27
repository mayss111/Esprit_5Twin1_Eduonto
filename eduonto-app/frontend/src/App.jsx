import { useEffect, useState } from "react";
import {
  BookOpen, Briefcase, ChevronRight, ClipboardCheck, GraduationCap, House, Library, Menu, MessageSquare,
  Moon, PanelLeftClose, PanelLeftOpen, Route, Sparkles, Sun, Users, X,
} from "lucide-react";
import { api } from "./api.js";
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
    { titre: "Espace étudiant", icone: GraduationCap, composant: EspaceEtudiant, sousTitre: "Mon tableau de bord : formation, cours, compétences, notes et badges" },
    { titre: "Assistant IA", icone: MessageSquare, composant: Assistant, sousTitre: "Questions en français → SPARQL (spaCy, rapidfuzz, sentence-transformers, Hugging Face)" },
  ] },
  { titre: "Back-office", pages: [
    { titre: "Accueil", icone: House, composant: Accueil, sousTitre: "Ontologie Éducation et Formation · vue d'ensemble" },
    { titre: "Personne · Formation", icone: Users, composant: Membre1, sousTitre: "Membre 1 · classes Personne et Formation" },
    { titre: "Cours · Domaine", icone: BookOpen, composant: Membre2, sousTitre: "Membre 2 · classes Cours et Domaine" },
    { titre: "Compétence · Métier", icone: Briefcase, composant: Membre3, sousTitre: "Membre 3 · classes Competence et Metier" },
    { titre: "Évaluation · Preuve", icone: ClipboardCheck, composant: Membre4, sousTitre: "Membre 4 · classes Evaluation et PreuveDeCompetence" },
    { titre: "Ressource · Agent IA", icone: Library, composant: Membre5, sousTitre: "Membre 5 · classes RessourcePedagogique et AgentPedagogiqueIA" },
    { titre: "Parcours · Indicateur", icone: Route, composant: Membre6, sousTitre: "Membre 6 · classes ParcoursApprentissage et IndicateurApprentissage" },
  ] },
];
const PAGES = GROUPES.flatMap((g) => g.pages.map((p) => ({ ...p, groupe: g.titre })));

function lire(cle) {
  try { return localStorage.getItem(cle); } catch { return null; }
}
function ecrire(cle, valeur) {
  try { localStorage.setItem(cle, valeur); } catch { /* stockage indisponible */ }
}

export default function App() {
  const [page, setPage] = useState("Accueil");
  const [etatPage, setEtatPage] = useState(null);       // données passées à la page (ex. contexte pour l'assistant)
  const [replie, setReplie] = useState(lire("eduonto-sidebar") === "replie");
  const [menuOuvert, setMenuOuvert] = useState(false);   // menu hamburger (mobile)
  const courante = PAGES.find((p) => p.titre === page);
  const Page = courante.composant;

  function naviguer(titre, etat = null) {
    setPage(titre);
    setEtatPage(etat);
    setMenuOuvert(false);
    window.scrollTo({ top: 0 });
  }

  function basculerReplie() {
    setReplie((r) => { ecrire("eduonto-sidebar", r ? "deplie" : "replie"); return !r; });
  }

  return (
    <div className={`app ${replie ? "sb-replie" : ""}`}>
      <aside className={`sidebar ${replie ? "replie" : ""} ${menuOuvert ? "ouvert" : ""}`} aria-label="Navigation principale">
        <div className="sb-haut">
          <div className="sb-logo">
            <span className="sb-logo-icone"><Sparkles size={20} /></span>
            <span className="sb-texte">EduOnto</span>
          </div>
          <button type="button" className="icone-btn sb-replier" onClick={basculerReplie}
                  aria-label={replie ? "Déplier le menu" : "Replier le menu"} title={replie ? "Déplier le menu" : "Replier le menu"}>
            {replie ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <button type="button" className="icone-btn topbar-menu" onClick={() => setMenuOuvert(false)} aria-label="Fermer le menu">
            <X size={18} />
          </button>
        </div>
        <nav>
          {GROUPES.map((g) => (
            <div key={g.titre} className="sb-section">
              <div className="sb-titre"><span>{g.titre}</span></div>
              {g.pages.map((p) => (
                <button key={p.titre} type="button" className={`sb-lien ${p.titre === page ? "actif" : ""}`}
                        aria-current={p.titre === page ? "page" : undefined}
                        title={replie ? p.titre : undefined} onClick={() => naviguer(p.titre)}>
                  <p.icone size={18} aria-hidden="true" />
                  <span className="sb-texte">{p.titre}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sb-pied">Projet Web Sémantique · ESPRIT</div>
      </aside>
      {menuOuvert && <div className="sb-voile" onClick={() => setMenuOuvert(false)} aria-hidden="true" />}

      <div className="principal">
        <header className="topbar">
          <button type="button" className="icone-btn topbar-menu" onClick={() => setMenuOuvert(true)} aria-label="Ouvrir le menu">
            <Menu size={20} />
          </button>
          <div className="topbar-titre">
            <p className="fil" aria-label="Fil d'Ariane">
              EduOnto <ChevronRight size={12} /> {courante.groupe} <ChevronRight size={12} /> {courante.titre}
            </p>
            <h1>{courante.titre}</h1>
            <p>{courante.sousTitre}</p>
          </div>
          <div className="topbar-droite">
            <EtatServeur />
            <BoutonTheme />
          </div>
        </header>
        <main className="page">
          <Page naviguer={naviguer} etat={etatPage} />
        </main>
      </div>
    </div>
  );
}

// Point vert / rouge selon GET /api/health, modèle spaCy et modules NLP actifs (vérifié toutes les 30 s).
function EtatServeur() {
  const [sante, setSante] = useState(undefined);
  useEffect(() => {
    let actif = true;
    const verifier = () => api.get("/api/health").then((s) => actif && setSante(s)).catch(() => actif && setSante(null));
    verifier();
    const minuterie = setInterval(verifier, 30000);
    return () => { actif = false; clearInterval(minuterie); };
  }, []);
  return (
    <>
      <span className="etat-serveur" title={sante ? `${sante.triplets} triplets · ${sante.ontologie}` : "Back-end injoignable"}>
        <span className={`point ${sante ? "ok" : sante === null ? "ko" : ""}`} aria-hidden="true" />
        {sante ? "Serveur en ligne" : sante === null ? "Serveur hors ligne" : "Connexion…"}
        {sante && <span className="detail">· {sante.modele_spacy}</span>}
      </span>
      {sante?.embeddings && <span className="badge ok">sémantique</span>}
      {sante?.zero_shot && <span className="badge ok">zero-shot</span>}
    </>
  );
}

// Bascule clair / sombre : attribut data-theme sur <html>, choix mémorisé dans localStorage.
function BoutonTheme() {
  const systeme = () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || systeme());
  function basculer() {
    const nouveau = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nouveau;
    ecrire("eduonto-theme", nouveau);
    setTheme(nouveau);
  }
  const libelle = theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre";
  return (
    <button type="button" className="icone-btn" onClick={basculer} aria-label={libelle} title={libelle}>
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
