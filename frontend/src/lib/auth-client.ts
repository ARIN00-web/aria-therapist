'use client';

import { createAuthClient } from 'better-auth/react';

/**
 * better-auth React client. The backend mounts better-auth at `/api/auth/*`
 * (see backend/src/index.ts), which is the default basePath, so we only need
 * to point baseURL at the backend origin.
 *
 * IMPORTANT: NEXT_PUBLIC_API_URL must use the SAME host as the backend's
 * BETTER_AUTH_URL (both `localhost` in dev). If they differ (localhost vs
 * 127.0.0.1) the session cookie is issued for one host and never sent back
 * from the other, so OAuth "logs in" but the session is never detected.
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001',
});

export const { signIn, signOut, getSession, useSession } = authClient;
