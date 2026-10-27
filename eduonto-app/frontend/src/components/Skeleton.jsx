// Bloc de chargement animé. <Skeleton lignes={3} /> ou <Skeleton hauteur={120} />
export default function Skeleton({ lignes = 1, hauteur = 14, largeur }) {
  return (
    <div aria-busy="true" aria-label="Chargement">
      {Array.from({ length: lignes }, (_, i) => (
        <div key={i} className="skeleton"
             style={{ height: hauteur, width: largeur ?? (lignes > 1 && i === lignes - 1 ? "60%" : "100%") }} />
      ))}
    </div>
  );
}
