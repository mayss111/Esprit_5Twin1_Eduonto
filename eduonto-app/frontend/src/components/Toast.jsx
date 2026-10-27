import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CircleCheck, CircleX, X } from "lucide-react";

// Notifications en bas à droite. Utilisation : const toast = useToast(); toast.succes("…"); toast.erreur("…");
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const fermer = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const ajouter = useCallback((type, texte) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((t) => [...t.slice(-3), { id, type, texte: String(texte) }]);
    setTimeout(() => fermer(id), type === "erreur" ? 7000 : 4000);
  }, [fermer]);
  const valeur = useMemo(() => ({
    succes: (texte) => ajouter("succes", texte),
    erreur: (texte) => ajouter("erreur", texte),
  }), [ajouter]);

  return (
    <ToastContext.Provider value={valeur}>
      {children}
      <div className="toast-zone" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === "erreur" ? <CircleX size={18} className="toast-icone" /> : <CircleCheck size={18} className="toast-icone" />}
            <span className="toast-texte">{t.texte}</span>
            <button type="button" aria-label="Fermer la notification" onClick={() => fermer(t.id)}><X size={14} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext) ?? { succes: () => {}, erreur: () => {} };
}
