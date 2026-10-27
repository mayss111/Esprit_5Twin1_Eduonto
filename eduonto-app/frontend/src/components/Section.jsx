// Section de page avec un titre précédé d'une icône (et des actions optionnelles à droite).
export default function Section({ icone: Icone, titre, sousTitre, actions, children }) {
  return (
    <section className="section">
      <div className="section-titre">
        {Icone && <span className="section-icone" aria-hidden="true"><Icone size={18} /></span>}
        <h3>{titre}</h3>
        {actions && <div className="section-actions">{actions}</div>}
        {sousTitre && <p>{sousTitre}</p>}
      </div>
      {children}
    </section>
  );
}
