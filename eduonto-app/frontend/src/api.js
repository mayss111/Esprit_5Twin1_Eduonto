// Toutes les communications front -> back passent par ce fichier.
// En développement, Vite redirige /api vers http://localhost:8000 (voir vite.config.js).

async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail ? JSON.stringify(data.detail) : `Erreur ${res.status}`);
  return data;
}

// L'en-tête X-Sparql contient, en base64 UTF-8, les requêtes SPARQL exécutées par le back-end.
// atob donne des octets : TextDecoder les remet en texte UTF-8 (sinon les accents sont cassés).
function decoderSparql(entete) {
  if (!entete) return "";
  const octets = Uint8Array.from(atob(entete), (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(octets);
}

async function getAvecSparql(url) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail ? JSON.stringify(data.detail) : `Erreur ${res.status}`);
  return { data, sparql: decoderSparql(res.headers.get("X-Sparql")) };
}

export const api = {
  get: (url) => request("GET", url),
  getAvecSparql,
  post: (url, body) => request("POST", url, body),
  put: (url, body) => request("PUT", url, body),
  del: (url) => request("DELETE", url),

  // --- CRUD générique (back-end : app/routers/generic.py) ---
  sousClasses: (c) => request("GET", `/api/classes/${c}/sous-classes`),
  proprietes: (c) => request("GET", `/api/classes/${c}/proprietes`),
  individus: (c, recherche = "") =>
    request("GET", `/api/classes/${c}/individus${recherche ? `?recherche=${encodeURIComponent(recherche)}` : ""}`),
  detail: (id) => request("GET", `/api/individus/${id}`),
  creer: (id, classe, proprietes) => request("POST", "/api/individus", { id, classe, proprietes }),
  modifier: (id, proprietes) => request("PUT", `/api/individus/${id}`, { proprietes }),
  supprimer: (id) => request("DELETE", `/api/individus/${id}`),

  // --- Module NLP (back-end : app/routers/nlp.py) ---
  ask: (question) => request("POST", "/api/ask", { question }),
};
