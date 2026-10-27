import { useEffect, useRef } from "react";

// Fenêtre modale : Échap ou clic sur le fond pour fermer, focus placé sur la première action.
export default function Modal({ ouvert, titre, icone: Icone, children, actions, onFermer }) {
  const boite = useRef(null);
  useEffect(() => {
    if (!ouvert) return;
    const precedent = document.activeElement;
    boite.current?.querySelector(".modal-actions button")?.focus();
    const touche = (e) => e.key === "Escape" && onFermer();
    document.addEventListener("keydown", touche);
    return () => { document.removeEventListener("keydown", touche); precedent?.focus?.(); };
  }, [ouvert, onFermer]);
  if (!ouvert) return null;
  return (
    <div className="modal-fond" onMouseDown={(e) => e.target === e.currentTarget && onFermer()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-titre" ref={boite}>
        <h4 id="modal-titre">{Icone && <Icone size={20} />}{titre}</h4>
        <div>{children}</div>
        <div className="modal-actions">{actions}</div>
      </div>
    </div>
  );
}
