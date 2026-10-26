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

export const api = {
  get: (url) => request("GET", url),
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
