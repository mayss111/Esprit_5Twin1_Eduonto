import { useState } from "react";
import { Check, ChevronRight, Code, Copy } from "lucide-react";

// Requête SPARQL colorée (mots-clés, préfixes edu:, variables ?x, chaînes, nombres), repliable, avec « Copier ».
const MOTS_CLES = "SELECT|DISTINCT|WHERE|FILTER|OPTIONAL|UNION|GROUP|BY|ORDER|DESC|ASC|LIMIT|OFFSET|AS|BIND|VALUES|NOT|EXISTS|" +
  "COUNT|SUM|AVG|MIN|MAX|ROUND|IF|COALESCE|STR|STRAFTER|CONTAINS|LCASE|CONCAT|GROUP_CONCAT|BOUND|isIRI|INSERT|DELETE|DATA|PREFIX|a";
const MOTIF = new RegExp(
  `(#[^\\n]*)|("(?:[^"\\\\]|\\\\.)*")|([?$][A-Za-z_]\\w*)|(\\b(?:edu|rdf|rdfs|owl|xsd):[A-Za-z_]?\\w*)|` +
  `(\\b(?:${MOTS_CLES})\\b)|(\\b\\d+(?:\\.\\d+)?\\b)`, "g");
const CLASSES = ["tk-com", "tk-str", "tk-var", "tk-pre", "tk-kw", "tk-num"];

export function colorier(texte) {
  const morceaux = [];
  let fin = 0;
  for (const m of texte.matchAll(MOTIF)) {
    if (m.index > fin) morceaux.push(texte.slice(fin, m.index));
    const groupe = m.slice(1).findIndex((g) => g !== undefined);
    morceaux.push(<span key={m.index} className={CLASSES[groupe]}>{m[0]}</span>);
    fin = m.index + m[0].length;
  }
  morceaux.push(texte.slice(fin));
  return morceaux;
}

export default function SparqlBlock({ sparql, titre = "Voir la requête SPARQL", ouvert = false }) {
  const [copie, setCopie] = useState(false);
  if (!sparql) return null;
  async function copier(e) {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(sparql);
      setCopie(true);
      setTimeout(() => setCopie(false), 1500);
    } catch {
      setCopie(false);
    }
  }
  return (
    <details className="sparql-panel" open={ouvert}>
      <summary><ChevronRight size={14} className="chevron" /><Code size={14} />{titre}</summary>
      <div className="sparql-corps">
        <button type="button" className="small copier" onClick={copier} aria-label="Copier la requête SPARQL">
          {copie ? <><Check size={13} /> Copié</> : <><Copy size={13} /> Copier</>}
        </button>
        <pre>{colorier(sparql)}</pre>
      </div>
    </details>
  );
}
