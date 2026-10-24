# securebert-api

FastAPI service that loads [`cisco-ai/SecureBERT2.0-base`](https://huggingface.co/cisco-ai/SecureBERT2.0-base)
(a domain-tuned security encoder, not generative) and exposes embedding, retrieval,
and needle-in-haystack clustering endpoints for the
[securebert-web](../securebert-web) frontend, which can't run PyTorch directly on Vercel.

See [docs/prototypes/securebert-aia-correlation.md](../../workstack-mcp-agents/docs/prototypes/securebert-aia-correlation.md)
for the full background.

## Corpus

`data/cases/*.json` holds 7 case packs (3 adapted from the AI Investigation Agent's
real case packs, 4 newly authored AI-attack scenarios mapped to MITRE ATLAS).
`data/noise/noise_pool.json` holds ~166 synthetic noise alert fragments across three
difficulty tiers (generic chatter, benign look-alikes / hard negatives, decoy attacks)
in roughly the same classic/AI-attack proportion as the case roster. Regenerate it with:

```bash
python scripts/generate_noise.py
```

Both are embedded offline (not at request time) into `data/embeddings/*.json`:

```bash
pip install -r requirements.txt
python scripts/build_embeddings.py
```

Re-run `build_embeddings.py` whenever `data/cases/` or `data/noise/noise_pool.json` change.
The committed `data/embeddings/*.json` files are what the API actually serves from.

## Endpoints

- `GET /` -- health check
- `GET /cases` -- the 7-case roster
- `POST /embed {text}` -- raw SecureBERT embedding of arbitrary text
- `POST /retrieve {text, k}` -- nearest case(s) by cosine similarity (precedent lookup)
- `POST /cluster {case_id, noise_count, seed}` -- needle-in-haystack: samples that
  case's real alerts plus random noise, clusters the unlabeled pile, and returns a
  ground-truth reveal (correctly grouped / excluded counts) for the demo UI

Only `/embed` and `/retrieve` run the model at request time. `/cluster` operates
entirely on precomputed vectors, so it stays fast even on a cold instance.

## Local run

```bash
pip install -r requirements.txt
python scripts/build_embeddings.py   # only needed once, or after corpus changes
uvicorn app.main:app --reload --port 8000
```

## Render deployment

- **Root Directory**: `securebert-api` (this is a subfolder of the `securebert` monorepo)
- **Language**: Python 3
- **Build command**: `pip install -r requirements.txt`
- **Start command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

`$PORT` is injected by Render -- don't hardcode a port. Binding to `0.0.0.0` (not
`localhost`) is required so Render's load balancer can reach the service.

No environment variables are required (the model and corpus are both public/synthetic).
