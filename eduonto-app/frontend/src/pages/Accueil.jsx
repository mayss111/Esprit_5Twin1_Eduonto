import { useEffect, useState } from "react";
import {
  ArrowRight, BookOpen, Boxes, Brain, Briefcase, ClipboardCheck, Database, GraduationCap, Layers, Library,
  MessageSquare, Monitor, Network, RotateCcw, Route, Server, TriangleAlert, Users,
} from "lucide-react";
import { api } from "../api.js";
import Modal from "../components/Modal.jsx";
import Section from "../components/Section.jsx";
import StatCard from "../components/StatCard.jsx";
import { useToast } from "../components/Toast.jsx";

const RACCOURCIS = [
  { page: "Espace étudiant", icone: GraduationCap, texte: "Tableau de bord d'un étudiant (front-office)" },
  { page: "Assistant IA", icone: MessageSquare, texte: "Questions en français → SPARQL" },
  { page: "Personne · Formation", icone: Users, texte: "Membre 1 · inscriptions, encadrement, profil déduit" },
  { page: "Cours · Domaine", icone: BookOpen, texte: "Membre 2 · prérequis, crédits, catalogue" },
  { page: "Compétence · Métier", icone: Briefcase, texte: "Membre 3 · métiers en tension, compétences manquantes" },
  { page: "Évaluation · Preuve", icone: ClipboardCheck, texte: "Membre 4 · notes, moyennes, badges" },
  { page: "Ressource · Agent IA", icone: Library, texte: "Membre 5 · ressources et agents pédagogiques" },
  { page: "Parcours · Indicateur", icone: Route, texte: "Membre 6 · parcours et indicateurs d'apprentissage" },
];

const compter = (sparql) => api.post("/api/sparql", { sparql }).then((r) => r[0]?.n ?? 0);

export default function Accueil({ naviguer }) {
  const [etat, setEtat] = useState(null);
  const [stats, setStats] = useState({});
  const [confirmer, setConfirmer] = useState(false);
  const toast = useToast();

  function charger() {
    api.get("/api/health").then(setEtat).catch(() => toast.erreur("Back-end injoignable : lancez uvicorn sur le port 8000."));
    Promise.all([
      compter("SELECT (COUNT(DISTINCT ?i) AS ?n) WHERE { ?i a owl:NamedIndividual }"),
      compter("SELECT (COUNT(DISTINCT ?c) AS ?n) WHERE { ?c a owl:Class . FILTER(isIRI(?c) && STRSTARTS(STR(?c), STR(edu:))) }"),
      api.get("/api/ask/intentions").then((r) => r.length),
    ]).then(([individus, classes, intentions]) => setStats({ individus, classes, intentions })).catch(() => {});
  }
  useEffect(charger, []);

  async function reset() {
    setConfirmer(false);
    try {
      setEtat(await api.post("/api/reset"));
      toast.succes("Données réinitialisées : retour à l'ontologie d'origine");
      charger();
    } catch (e) {
      toast.erreur(e.message);
    }
  }

  const charge = !etat || stats.individus === undefined;
  return (
    <div>
      <div className="bandeau">
        <h2>Bienvenue sur EduOnto</h2>
        <p>Une ontologie OWL de l'éducation et de la formation, interrogée en SPARQL, enrichie par le raisonneur
          HermiT et accessible en langage naturel.</p>
        <div className="bandeau-actions">
          <button type="button" className="primary" onClick={() => naviguer?.("Espace étudiant")}>
            <GraduationCap size={16} /> Espace étudiant
          </button>
          <button type="button" onClick={() => naviguer?.("Assistant IA")}><MessageSquare size={16} /> Poser une question</button>
          <button type="button" onClick={() => setConfirmer(true)}><RotateCcw size={16} /> Réinitialiser les données</button>
        </div>
      </div>

      <div className="grille-stats">
        <StatCard icone={Database} valeur={etat?.triplets?.toLocaleString("fr-FR")} libelle="triplets RDF" detail={etat?.ontologie} chargement={!etat} />
        <StatCard icone={Boxes} valeur={stats.individus} libelle="individus" ton="ok" chargement={charge} />
        <StatCard icone={Layers} valeur={stats.classes} libelle="classes OWL" ton="deduit" chargement={charge} />
        <StatCard icone={Brain} valeur={stats.intentions} libelle="types de questions comprises par l'IA" chargement={charge} />
      </div>

      <Section icone={Network} titre="Architecture" sousTitre="Le trajet d'une requête, de l'interface jusqu'à l'ontologie inférée.">
        <div className="card">
          <div className="archi">
            <div className="archi-bloc"><strong><Monitor size={16} /> React + Vite</strong><span>pages, formulaires, api.js</span></div>
            <div className="archi-fleche"><ArrowRight size={20} /></div>
            <div className="archi-bloc"><strong><Server size={16} /> FastAPI</strong><span>routes par membre, en-tête X-Sparql</span></div>
            <div className="archi-fleche"><ArrowRight size={20} /></div>
            <div className="archi-bloc"><strong><Database size={16} /> SPARQL 1.1 · rdflib</strong><span>SELECT, INSERT, DELETE</span></div>
            <div className="archi-fleche"><ArrowRight size={20} /></div>
            <div className="archi-bloc onto"><strong><Layers size={16} /> Ontologie inférée</strong><span>EduOnto.owl + déductions HermiT (owlready2)</span></div>
          </div>
          <div className="archi-branche">
            <span>Branche IA :</span>
            <div className="archi-bloc nlp" style={{ flex: "1 1 320px" }}>
              <strong><Brain size={16} /> NLP local (sans LLM)</strong>
              <span>spaCy (lemmes, PhraseMatcher) · rapidfuzz · sentence-transformers · zero-shot Hugging Face → gabarits SPARQL</span>
            </div>
          </div>
        </div>
      </Section>

      <Section icone={ArrowRight} titre="Accès rapide">
        <div className="grille-3">
          {RACCOURCIS.map((r) => (
            <button key={r.page} type="button" className="raccourci" onClick={() => naviguer?.(r.page)}>
              <span className="section-icone" aria-hidden="true"><r.icone size={18} /></span>
              <span><strong>{r.page}</strong><span>{r.texte}</span></span>
            </button>
          ))}
        </div>
      </Section>

      <p className="muted">Documentation interactive du back-end :{" "}
        <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer">localhost:8000/docs</a></p>

      <Modal ouvert={confirmer} titre="Réinitialiser les données ?" icone={TriangleAlert} onFermer={() => setConfirmer(false)}
             actions={<>
               <button type="button" onClick={() => setConfirmer(false)}>Annuler</button>
               <button type="button" className="danger plein" onClick={reset}><RotateCcw size={15} /> Réinitialiser</button>
             </>}>
        <p>Toutes les modifications faites depuis l'application seront effacées et l'ontologie d'origine rechargée.</p>
      </Modal>
    </div>
  );
}
