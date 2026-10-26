from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app import corpus, model

app = FastAPI(title="securebert-api", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/")
def health():
    return {
        "status": "ok",
        "model_loaded": model.is_loaded(),
        "corpus_ready": corpus.ready(),
    }


class EmbedRequest(BaseModel):
    text: str


@app.post("/embed")
def embed(req: EmbedRequest):
    if not req.text.strip():
        raise HTTPException(400, "text must not be empty")
    return {"vector": model.embed(req.text)}


class RetrieveRequest(BaseModel):
    text: str
    k: int = 3


@app.post("/retrieve")
def retrieve(req: RetrieveRequest):
    if not req.text.strip():
        raise HTTPException(400, "text must not be empty")
    if not corpus.ready():
        raise HTTPException(503, "corpus embeddings not built yet -- run scripts/build_embeddings.py")
    query_vector = model.embed(req.text)
    results = corpus.retrieve(query_vector, k=req.k)
    return {"results": results}


class ClusterRequest(BaseModel):
    case_id: str
    noise_count: int = 80
    seed: Optional[int] = None


@app.post("/cluster")
def cluster(req: ClusterRequest):
    if not corpus.ready():
        raise HTTPException(503, "corpus embeddings not built yet -- run scripts/build_embeddings.py")
    try:
        return corpus.cluster(req.case_id, noise_count=req.noise_count, seed=req.seed)
    except ValueError as e:
        raise HTTPException(404, str(e))


@app.get("/cases")
def cases():
    if not corpus.ready():
        raise HTTPException(503, "corpus embeddings not built yet -- run scripts/build_embeddings.py")
    return {"cases": corpus.list_cases()}


class ProjectRequest(BaseModel):
    text: str


# Corpus Map's only live call: embeds the submitted snippet, then projects it into
# the same fixed 2D space as the 7 precomputed case positions (see corpus.project).
# No Groq call -- this is the one use case that's pure SecureBERT.
@app.post("/project")
def project(req: ProjectRequest):
    if not req.text.strip():
        raise HTTPException(400, "text must not be empty")
    if not corpus.ready():
        raise HTTPException(503, "corpus embeddings not built yet -- run scripts/build_embeddings.py")
    vector = model.embed(req.text)
    return {"coords": corpus.project(vector)}
