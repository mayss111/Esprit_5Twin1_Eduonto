"""Point d'entrée du back-end EduOnto.

Lancement (depuis le dossier backend) :
    uvicorn app.main:app --reload --port 8000
Documentation interactive : http://localhost:8000/docs
"""
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from . import store
from .routers import generic, membre1, membre2, membre3, membre4, membre5, membre6, nlp

app = FastAPI(title="EduOnto API", version="1.0",
              description="Back-end du projet Web Sémantique : ontologie EduOnto, SPARQL et questions en langage naturel.")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["*"], allow_headers=["*"])

source = store.load()


@app.exception_handler(ValueError)
def valeur_invalide(request: Request, exc: ValueError):
    """Identifiant ou propriété invalide -> erreur 400 lisible au lieu d'un 500."""
    return JSONResponse(status_code=400, content={"detail": str(exc)})

for r in (generic, membre1, membre2, membre3, membre4, membre5, membre6, nlp):
    app.include_router(r.router)


@app.get("/api/health")
def health():
    return {"ontologie": source, "triplets": len(store.graph)}


@app.post("/api/reload")
def reload():
    """Recharge l'ontologie (après avoir remplacé le fichier .owl)."""
    global source
    source = store.load()
    return health()


@app.post("/api/reset")
def reset():
    """Efface les modifications faites via l'application et revient à l'ontologie d'origine."""
    global source
    store.RUNTIME.unlink(missing_ok=True)
    source = store.load()
    return health()
