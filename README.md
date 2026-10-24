# securebert

Public demo pairing Cisco's [SecureBERT2.0](https://huggingface.co/cisco-ai/SecureBERT2.0-base)
(a domain-tuned security encoder) with a free LLM (Groq / Llama 3.3) as a correlation and
retrieval layer, for two personas -- Analyst and Hunter. Background and design rationale:
[docs/prototypes/securebert-aia-correlation.md](../workstack-mcp-agents/docs/prototypes/securebert-aia-correlation.md)
in the workstack-mcp-agents workspace, plus the build plan this was implemented from.

Monorepo, two deployable subfolders:

- **[securebert-web/](securebert-web)** -- Next.js site, deployed to Vercel at
  `securebert.darrylstrucko.com`. Vercel project **Root Directory** = `securebert-web`.
- **[securebert-api/](securebert-api)** -- FastAPI service hosting SecureBERT2.0 and the
  case/noise corpus, deployed to Render. Render service **Root Directory** = `securebert-api`.

Companion to [aia.darrylstrucko.com](https://aia.darrylstrucko.com) (the AI Investigation
Agent) -- 3 of the 7 demo cases are adapted from AIA's real case packs; the other 4 are newly
authored AI-native attack scenarios (prompt injection, model theft, ML supply-chain
compromise, agent jailbreaks) mapped to MITRE ATLAS alongside ATT&CK.

## Local development

Two servers, run separately:

```bash
# Terminal 1 -- the model/corpus API
cd securebert-api
pip install -r requirements.txt
python scripts/build_embeddings.py   # once, or after corpus changes
uvicorn app.main:app --reload --port 8000

# Terminal 2 -- the site
cd securebert-web
# .env.local needs: GROQ_API_KEY=... and SECUREBERT_API_URL=http://localhost:8000
npm install
npm run dev
```

## Deployment

See each subfolder's own README for its platform-specific build/start commands and
environment variables.
