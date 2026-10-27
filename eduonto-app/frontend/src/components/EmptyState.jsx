import { Inbox } from "lucide-react";

// État vide illustré : icône + titre + texte d'aide.
export default function EmptyState({ icone: Icone = Inbox, titre = "Aucun résultat", texte, compact = false }) {
  return (
    <div className={`vide ${compact ? "compact" : ""}`}>
      <span className="vide-icone" aria-hidden="true"><Icone size={20} /></span>
      <strong>{titre}</strong>
      {texte && <p>{texte}</p>}
    </div>
  );
}
