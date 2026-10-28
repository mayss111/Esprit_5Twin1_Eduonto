import { useEffect, useRef, useState } from "react";
import {
  Bot, BookOpen, Briefcase, ChevronRight, ClipboardCheck, Library, MessageSquarePlus, Route, Send, Sparkles, UserRound, Users,
} from "lucide-react";
import { api } from "../api.js";
import EmptyState from "../components/EmptyState.jsx";
import ResultTable from "../components/ResultTable.jsx";
import { colorier } from "../components/SparqlBlock.jsx";

// Module IA : question en français -> spaCy (+ rapidfuzz, sentence-transformers, Hugging Face en option)
// -> SPARQL -> résultats. Chaque membre ajoute ici 1 ou 2 exemples de questions pour ses classes.
// Un exemple « suite » pose deux questions d'affilée : la 2e réutilise le contexte de la 1re.
const SUGGESTIONS = [
  { theme: "Étudiants", icone: Users, questions: [
    "Quelle est la formation d'Ahmed ?",                                   // M1
    "Quels étudiants sont boursiers ?",                                    // M1
    "Combien d'étudiants sont inscrits en TWIN ?",                         // M1 (agrégat)
    "Qui suit le tronc commun ?",                                          // M1 (alias de formation)
    "Quels étudiants sont à risque de décrochage ?",                       // M6
  ] },
  { theme: "Cours", icone: BookOpen, questions: [
    "Qui enseigne JavaScript ?",                                           // M1
    "Quels sont les prérequis d'Angular ?",                                // M2
    "Ahmed peut-il suivre Angular ?",                                      // M2
    "Que puis-je suivre après JavaScript ?",                               // M2
    "Qui enseigne Angulr ?",                                               // faute de frappe (rapidfuzz)
    "Liste les cours",                                                     // commun
  ] },
  { theme: "Compétences & métiers", icone: Briefcase, questions: [
    "Quelles compétences requiert le métier de développeur full-stack ?",  // M3
    "Quelles compétences manquent à Ahmed ?",                              // M3
    "Quels métiers sont accessibles avec un master ?",                     // M3
    "Combien de compétences demande chaque métier ?",                      // M3
    "Quels sont les métiers en tension ?",                                 // M3
  ] },
  { theme: "Ressources & agents", icone: Library, questions: [
    "Quels agents IA sont fiables ?",                                      // M5
    "Que recommande-t-on à Omar ?",                                        // M5
    "Quelles ressources sont en libre accès ?",                            // M5
    "Quelles ressources en français sont en libre accès ?",                // M5
    "Quelles ressources utilise le cours Angular ?",                       // M5
    "Ressources de moins de 30 minutes",                                   // M5
    "Quelles ressources du parcours d'Ahmed ?",                            // M5
  ] },
  { theme: "Évaluations", icone: ClipboardCheck, questions: [
    "Quelles évaluations ont une note inférieure à 10 ?",                  // M4 (opérateur de comparaison)
    "Quelle est la moyenne d'Ahmed ?",                                     // M4
    "Quels badges a obtenu Sarra ?",                                       // M4
    "Quelle est la moyenne des notes par cours ?",                         // M4
    "Comment se sont passés les examens ?",                                // M4 (repli sémantique / zero-shot)
    { libelle: "Suite : moyenne d'Ahmed → « Et ses badges ? »",            // mémoire de conversation
      questions: ["Quelle est la moyenne d'Ahmed ?", "Et ses badges ?"] },
  ] },
  { theme: "Parcours & suivi", icone: Route, questions: [
    "Quels sont les indicateurs d'Omar ?",                                 // M6
    "Quelles sont les alertes ?",                                          // M6 (sens donné par la classe)
    "Quel parcours conseiller à Omar ?",                                   // M6 (recommandation)
    "Qui suit le parcours Full-Stack ?",                                   // M6
    "Comment va Yasine ?",                                                 // M6 (faute de frappe)
    { libelle: "Suite : comment va Ahmed → « Et son parcours ? »",         // M6, mémoire de conversation
      questions: ["Comment va Ahmed ?", "Et son parcours ?"] },
  ] },
];

let compteur = 0;
const nouvelId = () => ++compteur;

export default function Assistant({ etat }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [contexte, setContexte] = useState([]);   // entités renvoyées par la réponse précédente
  const [chargement, setChargement] = useState(false);
  const fin = useRef(null);
  const saisie = useRef(null);

  // Ouverture depuis l'espace étudiant : contexte de l'étudiant + question déjà posée
  useEffect(() => {
    if (etat?.question) poser([etat.question], etat.contexte ?? []);
    else if (etat?.contexte) setContexte(etat.contexte);
  }, [etat]);

  useEffect(() => {
    if (messages.length) fin.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, chargement]);

  // Pose une ou plusieurs questions à la suite ; chacune reçoit le contexte laissé par la précédente.
  async function poser(questions = [question], ctxDepart = contexte) {
    const liste = questions.filter((q) => q.trim());
    if (!liste.length || chargement) return;
    setQuestion("");
    setChargement(true);
    let ctx = ctxDepart;
    for (const q of liste) {
      setMessages((m) => [...m, { id: nouvelId(), role: "moi", texte: q }]);
      try {
        const rep = await api.ask(q, ctx);
        ctx = rep.contexte ?? [];
        setMessages((m) => [...m, { id: nouvelId(), role: "ia", rep }]);
      } catch (e) {
        setMessages((m) => [...m, { id: nouvelId(), role: "ia", erreur: e.message }]);
        break;
      }
    }
    setContexte(ctx);
    setChargement(false);
    saisie.current?.focus();
  }

  function nouvelleConversation() {
    setContexte([]);
    setMessages([]);
    setQuestion("");
    saisie.current?.focus();
  }

  return (
    <div className="chat">
      <div className="chat-fil" aria-live="polite">
        {messages.length === 0 && (
          <EmptyState icone={Sparkles} titre="Posez une question sur l'ontologie"
                      texte="Ex. « Quelles compétences manquent à Ahmed ? ». Les fautes de frappe sont corrigées et « et ses notes ? » réutilise la question précédente." />
        )}
        {messages.map((m) => m.role === "moi"
          ? (
            <div key={m.id} className="msg moi">
              <span className="msg-avatar" aria-hidden="true"><UserRound size={18} /></span>
              <div className="bulle">{m.texte}</div>
            </div>
          )
          : <Reponse key={m.id} message={m} onPoser={(q) => poser([q])} />)}
        {chargement && (
          <div className="msg ia">
            <span className="msg-avatar" aria-hidden="true"><Bot size={18} /></span>
            <div className="bulle" style={{ flex: "0 0 auto" }}>
              <span className="ecrit" aria-label="L'assistant écrit"><span /><span /><span /></span>
            </div>
          </div>
        )}
        <div ref={fin} />
      </div>

      <form className="chat-saisie" onSubmit={(e) => { e.preventDefault(); poser(); }}>
        <div className="row">
          <input ref={saisie} value={question} onChange={(e) => setQuestion(e.target.value)} aria-label="Votre question"
                 placeholder="Posez une question en français… (Entrée pour envoyer)" />
          <button type="submit" className="primary" disabled={chargement || !question.trim()}>
            <Send size={16} /> Envoyer
          </button>
          <button type="button" onClick={nouvelleConversation} disabled={chargement}>
            <MessageSquarePlus size={16} /> Nouvelle conversation
          </button>
        </div>
        {contexte.length > 0 && (
          <div className="ctx-ligne">
            Contexte de la conversation :
            {contexte.map((e) => <span key={e.id} className="ent">{e.id}</span>)}
            <span>(« et ses notes ? » réutilise ces entités)</span>
          </div>
        )}
      </form>

      <div className="groupes-suggestions">
        {SUGGESTIONS.map((g) => (
          <div key={g.theme} className="groupe-suggestions">
            <h5><g.icone size={14} aria-hidden="true" />{g.theme}</h5>
            <div className="chips">
              {g.questions.map((ex) => typeof ex === "string"
                ? <button key={ex} type="button" className="chip" onClick={() => poser([ex])}>{ex}</button>
                : <button key={ex.libelle} type="button" className="chip suite" onClick={() => poser(ex.questions, [])}>{ex.libelle}</button>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Une réponse de l'assistant : résumé, résultats, puis « Comment j'ai compris » (dépliable).
function Reponse({ message, onPoser }) {
  const { rep, erreur } = message;
  const corrections = rep?.entites?.filter((e) => e.correction) ?? [];
  return (
    <div className="msg ia">
      <span className="msg-avatar" aria-hidden="true"><Bot size={18} /></span>
      <div className="bulle">
        {erreur && <p className="error">{erreur}</p>}
        {rep && !rep.intention && <p>{rep.message}</p>}
        {rep?.intention && (
          <p>
            {rep.erreur ? rep.erreur
              : rep.resultats.length ? `Voici ${rep.resultats.length} résultat${rep.resultats.length > 1 ? "s" : ""}.`
              : "Je n'ai trouvé aucun résultat."}
          </p>
        )}
        {corrections.length > 0 && (
          <p className="muted">J'ai corrigé : {corrections.map((e) => <span key={e.id} className="ent corrigee">{e.correction}</span>)}</p>
        )}
        {rep?.parametres_du_contexte && (
          <p className="muted">Repris de la question précédente : {Object.values(rep.parametres_du_contexte).join(", ")}</p>
        )}
        {rep?.intention && rep.resultats.length > 0 && <ResultTable rows={rep.resultats} />}
        {rep?.suggestions?.length > 0 && (
          <>
            <p className="muted">{rep.intention ? "Vouliez-vous plutôt dire :" : "Essayez par exemple :"}</p>
            <div className="chips">
              {rep.suggestions.map((s) => <button key={s} type="button" className="chip" onClick={() => onPoser(s)}>{s}</button>)}
            </div>
          </>
        )}
        {rep && <Comprendre rep={rep} />}
      </div>
    </div>
  );
}

function Comprendre({ rep }) {
  const conf = rep.confiance ?? 0;
  const niveau = conf >= 0.6 ? "haut" : conf >= 0.35 ? "moyen" : "bas";
  return (
    <details className="comprendre">
      <summary><ChevronRight size={14} className="chevron" />Comment j'ai compris</summary>
      <div className="comprendre-corps">
        <div className="ligne"><b>Intention</b>
          {rep.intention ? <><code className="mono">{rep.intention}</code>{rep.membre ? <span className="badge">membre {rep.membre}</span> : null}</> : "non reconnue"}
        </div>
        {rep.methode && <div className="ligne"><b>Méthode</b><span className="badge neutre">{rep.methode}</span><span className="muted">{rep.modele_spacy}</span></div>}
        <div className="ligne"><b>Confiance</b>
          <div className="jauge" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(conf * 100)} aria-label="Confiance">
            <div className={niveau} style={{ width: `${Math.round(conf * 100)}%` }} />
          </div>
          <span>{Math.round(conf * 100)} %</span>
          {rep.ambigue && <span className="badge deduit">deux intentions à égalité</span>}
        </div>
        {rep.entites?.length > 0 && (
          <div className="ligne"><b>Entités</b>
            {rep.entites.map((e) => e.correction
              ? <span key={e.id} className="ent corrigee" title="faute de frappe corrigée (rapidfuzz)">
                  <s>{e.correction.split(" → ")[0]}</s> → {e.id}
                </span>
              : <span key={`${e.id}-${e.texte}`} className={`ent ${e.genre === "classe" ? "classe" : ""}`} title={e.genre}>{e.id}</span>)}
          </div>
        )}
        {rep.parametres && Object.keys(rep.parametres).length > 0 && (
          <div className="ligne"><b>Paramètres</b>
            {Object.entries(rep.parametres).map(([k, v]) => <span key={k} className="badge">{k} = {String(v)}</span>)}
          </div>
        )}
        {rep.alternatives?.length > 0 && (
          <div className="ligne"><b>Autres pistes</b>
            {rep.alternatives.map((a) => <span key={a.intention} className="badge">{a.intention} · {a.score}</span>)}
          </div>
        )}
        {rep.scores_zero_shot?.length > 0 && (
          <div className="ligne"><b>Zero-shot</b>
            {rep.scores_zero_shot.map((a) => <span key={a.intention} className="badge">{a.intention} · {a.score}</span>)}
          </div>
        )}
        {rep.sparql && <pre>{colorier(rep.sparql)}</pre>}
      </div>
    </details>
  );
}
