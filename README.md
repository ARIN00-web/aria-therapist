# Aria Therapist

Aria is a safety-first AI emotional support platform based on the product vision in `aria-doc.txt`.

## Local Development

Backend:

```bash
cd backend
cp .env.example .env
npm run dev
```

Frontend:

```bash
cd frontend
cp .env.example .env.local
npm run dev
```

## Required Configuration

- `MONGODB_URI`: MongoDB connection string.
- `ENCRYPTION_KEY`: secret used for AES-256-GCM field encryption.
- `AUTH_SECRET`: secret used for access and refresh token signing.
- `FRONTEND_ORIGIN`: allowed browser origin for CORS.
- `NEXT_PUBLIC_API_URL`: frontend-visible backend URL.

## Optional AI/RAG Configuration

- `ANTHROPIC_API_KEY`: enables Claude crisis classification, summarization, memory extraction, and streaming chat.
- `OPENAI_API_KEY`: enables embeddings for RAG retrieval.
- `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION`: enable therapy knowledge retrieval.

When optional AI/RAG keys are absent, the app keeps safety keyword detection active and returns conservative fallback responses.

## Safety And Privacy

- Crisis responses are hardcoded and include Indian helpline numbers.
- Session content, summaries, and long-term memory fields are encrypted at rest.
- Access tokens expire after 15 minutes and refresh tokens rotate.
- Message content is not written to server logs.
- Account deletion removes user, session, and memory records.
