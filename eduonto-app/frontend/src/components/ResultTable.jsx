// Affiche une liste de résultats SPARQL [{colonne: valeur}, ...] sous forme de tableau.
export default function ResultTable({ rows, onRowClick, actions }) {
  if (!rows) return null;
  if (rows.length === 0) return <p className="muted">Aucun résultat.</p>;
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {cols.map((c) => <th key={c}>{c}</th>)}
            {actions && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} onClick={onRowClick ? () => onRowClick(r) : undefined} className={onRowClick ? "clickable" : ""}>
              {cols.map((c) => <td key={c}>{format(r[c])}</td>)}
              {actions && <td className="actions" onClick={(e) => e.stopPropagation()}>{actions(r)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function format(v) {
  if (v === undefined || v === null) return "";
  if (typeof v === "boolean") return v ? "oui" : "non";
  return String(v);
}
