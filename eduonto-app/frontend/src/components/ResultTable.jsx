import { useState } from "react";
import { Search } from "lucide-react";
import EmptyState from "./EmptyState.jsx";

// Affiche une liste de résultats SPARQL [{colonne: valeur}, ...] sous forme de tableau.
// En-tête collant, nombres alignés à droite, booléens en pastilles, identifiants en police mono,
// compteur de lignes et filtre local au-delà de 8 lignes.
const NOMBRE = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const IDENTIFIANT = /^[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+$|^[A-Z]?[a-z0-9]+(?:[A-Z][a-z0-9]+)+$/;

export default function ResultTable({ rows, onRowClick, actions }) {
  const [filtre, setFiltre] = useState("");
  if (!rows) return null;
  if (rows.length === 0) return <EmptyState compact titre="Aucun résultat" texte="La requête n'a renvoyé aucune ligne." />;
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const numeriques = new Set(cols.filter((c) => rows.some((r) => typeof r[c] === "number")
                                              && rows.every((r) => r[c] == null || typeof r[c] === "number")));
  const f = filtre.trim().toLowerCase();
  const visibles = f ? rows.filter((r) => cols.some((c) => String(r[c] ?? "").toLowerCase().includes(f))) : rows;

  return (
    <div className="rt">
      <div className="rt-outils">
        <span className="rt-compteur">
          {f ? `${visibles.length} / ${rows.length}` : rows.length} ligne{rows.length > 1 ? "s" : ""}
        </span>
        {rows.length > 8 && (
          <label className="champ-recherche" style={{ flex: "0 1 240px" }}>
            <Search size={15} />
            <input value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="Filtrer…" aria-label="Filtrer le tableau" />
          </label>
        )}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {cols.map((c) => <th key={c} className={numeriques.has(c) ? "num" : ""}>{c}</th>)}
              {actions && <th><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {visibles.map((r, i) => (
              <tr key={i} className={onRowClick ? "clickable" : ""}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  onKeyDown={onRowClick ? (e) => e.key === "Enter" && onRowClick(r) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}>
                {cols.map((c) => <td key={c} className={numeriques.has(c) ? "num" : ""}>{format(r[c])}</td>)}
                {actions && <td className="actions" onClick={(e) => e.stopPropagation()}>{actions(r)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function format(v) {
  if (v === undefined || v === null) return "";
  if (typeof v === "boolean") return <span className={`pastille ${v ? "oui" : "non"}`}>{v ? "oui" : "non"}</span>;
  if (typeof v === "number") return NOMBRE.format(v);
  const s = String(v);
  return IDENTIFIANT.test(s) ? <code className="mono">{s}</code> : s;
}
