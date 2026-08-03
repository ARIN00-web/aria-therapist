# Deploying Aria on Vercel (free tier)

This application is deployed as two Vercel projects from the same Git repository:

- `backend/` — Express API deployed as a Vercel Function.
- `frontend/` — Next.js web application.

The MongoDB database is hosted on MongoDB Atlas M0 (free tier).

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
   | `FRONTEND_ORIGIN` | Set this after the frontend is deployed |
   | `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, or `OPENROUTER_API_KEY` | At least one provider key is required |
   | `OPENROUTER_MODEL` | Optional; defaults to the project’s configured model |

   Generate a secret locally with `openssl rand -base64 48`. Never commit any of these values.

5. Deploy. Open `https://YOUR-BACKEND.vercel.app/health`; it should return JSON with `"status":"ok"`.

The optional Qdrant and Upstash variables can be left unset. Retrieval is disabled and in-memory rate limiting is used, matching the current local fallback behavior. The source PDFs are excluded from the Vercel deployment because they are used only by the offline ingestion command, not by the running API.

## 3. Deploy the frontend

1. Import the same GitHub repository as a second Vercel project.
2. Set **Root Directory** to `frontend`.
3. Add this production environment variable before deploying:

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_API_URL` | `https://YOUR-BACKEND.vercel.app` |

4. Deploy and copy the frontend URL.
5. Return to the backend project, set `FRONTEND_ORIGIN` to that exact URL (without a trailing slash), then redeploy the backend.

`NEXT_PUBLIC_API_URL` is included in the browser bundle, so changing it requires a frontend redeploy.

## 4. Optional Google sign-in

If Google OAuth is enabled, add this authorized redirect URI in Google Cloud:

```
https://YOUR-BACKEND.vercel.app/api/auth/callback/google
```

Also set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the backend Vercel project.

## 5. Verify the production app

1. Complete onboarding and refresh the page; the user should remain signed in.
2. Start a session, send a message, and end it.
3. Open Memory and confirm profile text is readable.
4. Confirm the backend’s Vercel logs show no error responses.

## Serverless session expiry

Vercel functions do not keep a process alive between requests, so the app does not rely on an in-memory timer. The client closes an open session at five hours, and the API enforces the same deadline whenever a session is loaded, resumed, created, or receives a message. This guarantees that an expired session cannot be resumed or receive new messages, including after a serverless cold start.
