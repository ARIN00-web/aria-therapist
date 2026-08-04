# Aria Therapist

Aria is a safety-first AI emotional support platform based on the product vision in `aria-doc.txt`.

## Local Development

Backend:

```bash
cd backend
cp .env.example .env
npm run dev
```

## Deployment

For a free Vercel + MongoDB Atlas deployment, follow [DEPLOYMENT.md](DEPLOYMENT.md).

Frontend:

```bash
cd frontend
cp .env.example .env.local
npm run dev
```

## Required Configuration

Backend (`backend/.env`):

- `MONGODB_URI`: MongoDB connection string.
- `ENCRYPTION_KEY`: secret used for AES-256-GCM field encryption (32+ chars).
- `AUTH_SECRET`: secret used for access and refresh token signing (32+ chars).
- `FRONTEND_ORIGIN`: allowed browser origin for CORS.
- At least one LLM provider key: `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, or `OPENROUTER_API_KEY`.

Frontend (`frontend/.env.local`):

- `NEXT_PUBLIC_API_URL`: frontend-visible backend URL (e.g. `http://localhost:5001`).

## Optional AI/RAG Configuration

- LLM providers are tried in a fallback chain (OpenRouter → DeepSeek → Gemini); provide
  any subset. `OPENROUTER_MODEL` selects the OpenRouter model.
- `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION`: enable therapy knowledge retrieval.
  Retrieval uses Gemini embeddings, so `GEMINI_API_KEY` is also required when Qdrant is enabled.
  When unset, RAG retrieval is disabled and chat proceeds without knowledge context.
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`: enable distributed rate limiting.
  When unset, an in-memory rate limiter is used.
- Google OAuth (via better-auth): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`.

When optional AI/RAG keys are absent, the app keeps safety keyword detection active and
returns conservative fallback responses.

## Safety And Privacy

- Crisis responses are hardcoded and include Indian helpline numbers.
- Session content, summaries, and long-term memory fields are encrypted at rest.
- Access tokens expire after 15 minutes and refresh tokens rotate.
- Message content is not written to server logs.
- Account deletion removes user, session, and memory records.
