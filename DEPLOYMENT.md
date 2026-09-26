# Deploying Aria with Vercel, MongoDB Atlas, and Qdrant Cloud

This runbook deploys a working three-service application: the browser app,
the API, and Qdrant. `Failed to fetch` in the browser almost always means the
browser cannot reach the API at all (wrong URL, a failed API deployment, or
CORS); it is not a Qdrant error. Follow the verification steps below in order
so each connection is proven independently.

This application is deployed as two Vercel projects from the same Git repository:

- `backend/` — Express API deployed as a Vercel Function.
- `frontend/` — Next.js web application.

The MongoDB database is hosted on MongoDB Atlas M0 (free tier). Qdrant must be
hosted separately (Qdrant Cloud is the simplest choice): a Vercel Function is
not a persistent server and cannot host Qdrant's database files. Do **not** set
`QDRANT_URL` to `localhost`, a Docker service name, or a Qdrant dashboard URL:
Vercel cannot reach any of those.

## 1. Create the database

1. Create a MongoDB Atlas project and an M0 free cluster.
2. Create a database user with a strong password.
3. In Atlas Network Access, allow `0.0.0.0/0` because Vercel does not provide a fixed outbound IP on the free tier. The database user credentials still restrict access.
4. Copy the MongoDB Node.js connection string and set its database name to `aria`.

## 2. Deploy the backend

1. In Vercel, import this GitHub repository as a new project.
2. Set **Root Directory** to `backend`.
3. Leave the build command from `backend/vercel.json` in place.
4. Add these production environment variables:

   | Variable | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | Atlas connection string (including the `aria` database name) |
   | `ENCRYPTION_KEY` | A new random secret, at least 32 characters |
   | `AUTH_SECRET` | A new random secret, at least 32 characters |
   | `BETTER_AUTH_SECRET` | A new random secret, at least 32 characters |
   | `BETTER_AUTH_URL` | The backend Vercel URL, for example `https://aria-api.vercel.app` |
   | `FRONTEND_ORIGIN` | Set this after the frontend is deployed; use the exact origin, e.g. `https://aria-web.vercel.app` |
   | `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, or `OPENROUTER_API_KEY` | At least one provider key is required |
   | `OPENROUTER_MODEL` | Optional; defaults to the project’s configured model |

   Generate a secret locally with `openssl rand -base64 48`. Never commit any of these values.

5. Deploy. Open `https://YOUR-BACKEND.vercel.app/health`; it should return JSON with `"status":"ok"` and `"database":"connected"`.

If this endpoint returns `503`, open the Vercel project **Logs** tab for that
request. The response is now a configuration/database error rather than a
function crash. The usual causes are a missing variable above, an Atlas IP
access rule that does not permit Vercel, or an invalid Atlas URI.

## 3. Set up Qdrant Cloud and ingest the knowledge base

1. Create a Qdrant Cloud cluster. Copy its HTTPS **cluster URL** and create an
   API key with read/write access. Do not use `localhost`, a private IP, or the
   Qdrant dashboard URL.
2. Add these variables to the **backend Vercel project** (Production, and also
   Preview/Development if you deploy to those environments), then redeploy it:

   | Variable | Value |
   | --- | --- |
   | `QDRANT_URL` | The Qdrant Cloud cluster HTTPS URL |
   | `QDRANT_API_KEY` | The Qdrant Cloud API key |
   | `QDRANT_COLLECTION` | `therapy_knowledge` |

3. On your computer, create `backend/.env` from `backend/.env.example` and
   supply the same Qdrant values plus the required MongoDB/secrets/LLM values.
   Then run this once from `backend/`:

   ```bash
   npm ci
   npm run ingest
   ```

   This creates the collection with the correct embedding dimension and uploads
   the text files in `backend/data`. It must run outside Vercel; ingestion can
   take longer than a serverless request and the source documents are not part
   of the deployed API. Re-running it is safe: existing chunks are skipped.

4. Verify that the deployed API can reach Qdrant (this is more reliable than
   only checking the Qdrant dashboard):

   ```bash
   curl -i https://YOUR-BACKEND.vercel.app/health/qdrant
   ```

   It must return `200` and JSON with `"status":"ok"`; `pointsCount` should
   be greater than zero after ingestion. A `401`/`403` means the Qdrant API key
   is wrong or missing; `404` usually means the collection was not ingested;
   a `503` means the backend cannot reach the configured Qdrant URL. After
   this succeeds, chat retrieves the best matching chunks from that collection.

## 4. Deploy the frontend

1. Import the same GitHub repository as a second Vercel project.
2. Set **Root Directory** to `frontend`.
3. Add this production environment variable before deploying:

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_API_URL` | `https://YOUR-BACKEND.vercel.app` |

4. Deploy and copy the frontend URL.
5. Return to the backend project, set `FRONTEND_ORIGIN` to that exact URL (without a trailing slash), then redeploy the backend.

`NEXT_PUBLIC_API_URL` is included in the browser bundle, so changing it requires a frontend redeploy.

Do not include a path such as `/api`, a trailing route, quotes, or whitespace
in either deployed URL. The backend accepts a trailing slash in
`FRONTEND_ORIGIN`, but the value should still be the bare origin.

## 5. Optional Google sign-in

If Google OAuth is enabled, add this authorized redirect URI in Google Cloud:

```
https://YOUR-BACKEND.vercel.app/api/auth/callback/google
```

Also set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the backend Vercel project.

## 6. Verify the production app

1. From a terminal, verify API and database readiness:

   ```bash
   curl -i https://YOUR-BACKEND.vercel.app/health
   ```

   Expect HTTP `200`, `status: "ok"`, and `database: "connected"`. Do not
   test the API with `/`: it is intentionally not an application page.
2. Verify deployed Qdrant with `curl -i https://YOUR-BACKEND.vercel.app/health/qdrant`.
   Expect HTTP `200`, `status: "ok"`, and a non-zero `pointsCount`.
3. Open the deployed frontend in an incognito window. Complete onboarding,
   refresh the page, then start a session, send a message, and end it.
4. Open Memory and confirm profile text is readable. Check the backend Vercel
   logs for the same time window; there should be no `startup_failed`, CORS,
   Qdrant, or LLM errors.

## Fixing `Failed to fetch`

Use the browser DevTools **Network** tab and this decision tree. The exact
request URL and status are the useful evidence; the UI’s `Failed to fetch`
message alone is too generic.

| What you see | Cause | Fix |
| --- | --- | --- |
| Request URL starts with `http://localhost:5001` | The frontend was built without the production API URL. | Set `NEXT_PUBLIC_API_URL=https://YOUR-BACKEND.vercel.app` in the **frontend** Vercel project and redeploy the frontend. |
| Request is blocked by CORS or has no `access-control-allow-origin` header | The backend does not allow the deployed frontend origin. | Set `FRONTEND_ORIGIN` to the exact frontend origin in the **backend** project, then redeploy the backend. For preview URLs, set `FRONTEND_ORIGINS` to a comma-separated list of the allowed preview origins. |
| API `/health` returns `503` | The backend function cannot start or cannot connect to MongoDB. | Open the matching Vercel Function log. Check every required backend variable and the Atlas network-access rule. |
| API `/health` works but `/health/qdrant` returns `503` | Qdrant is misconfigured or unreachable. | Use the Qdrant Cloud HTTPS cluster endpoint, set `QDRANT_API_KEY`, run `npm run ingest` locally, and redeploy the backend. |
| API endpoints return `401` after a Google login | Cookie/domain configuration is inconsistent. | Make `BETTER_AUTH_URL` exactly the backend URL and `NEXT_PUBLIC_API_URL` the same backend URL; set the Google callback URL shown below. |
| Chat stream returns `504` or stops after a long delay | The LLM or first local-embedding model download exceeded the Vercel function time limit. | Check function logs and provider quota. Retry once after cold start; for dependable production traffic, move embedding generation to a dedicated worker/service or prepackage the model. |

After changing any backend variable, redeploy the backend. After changing
`NEXT_PUBLIC_API_URL`, redeploy the frontend; Next.js embeds that value at
build time.

## Deployment checklist for a `GET /` function crash

- Deploy **two Vercel projects** from this repository: backend root directory
  `backend`, frontend root directory `frontend`. Do not deploy the repository
  root as a single project.
- Set every required backend environment variable before redeploying. In
  particular, `MONGODB_URI`, `ENCRYPTION_KEY`, `AUTH_SECRET`,
  `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and one LLM provider key are all
  required for the function to start.
- Set `BETTER_AUTH_URL` to the exact backend URL, such as
  `https://aria-api.vercel.app`, with no trailing slash.
- Set `NEXT_PUBLIC_API_URL` to that same backend URL in the frontend project,
  then redeploy the frontend. Set `FRONTEND_ORIGIN` in the backend project to
  the exact frontend URL and redeploy the backend once more.
- A browser request to the backend root (`/`) is not an app page. Use
  `/health` to verify the API. A `404` at `/` after a healthy `/health` is
  expected; a `503` means the Vercel function log contains the specific missing
  configuration or MongoDB connection error.

## Serverless session expiry

Vercel functions do not keep a process alive between requests, so the app does not rely on an in-memory timer. The client closes an open session at five hours, and the API enforces the same deadline whenever a session is loaded, resumed, created, or receives a message. This guarantees that an expired session cannot be resumed or receive new messages, including after a serverless cold start.
