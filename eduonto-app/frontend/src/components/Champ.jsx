export default function Champ({ label, erreur, aide, children, className = "" }) {
  return (
    <label className={`${className}${erreur ? " invalide" : ""}`.trim()}>
      <span>{label}</span>
      {children}
      {erreur
        ? <span className="champ-erreur" role="alert">{erreur}</span>
        : aide ? <span className="champ-aide">{aide}</span> : null}
    </label>
  );
}
