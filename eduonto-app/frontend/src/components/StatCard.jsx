import Skeleton from "./Skeleton.jsx";

// Chiffre clé : icône + valeur + libellé (+ détail). ton : "" (indigo), "ok", "deduit", "danger".
export default function StatCard({ icone: Icone, valeur, libelle, detail, ton = "", chargement = false }) {
  return (
    <div className={`stat-card ${ton}`}>
      {Icone && <span className="stat-icone" aria-hidden="true"><Icone size={22} /></span>}
      <div className="stat-corps">
        {chargement ? <Skeleton hauteur={28} largeur={64} /> : <div className="stat-valeur">{valeur ?? "—"}</div>}
        <div className="stat-libelle">{libelle}</div>
        {detail && <div className="stat-detail">{detail}</div>}
      </div>
    </div>
  );
}
