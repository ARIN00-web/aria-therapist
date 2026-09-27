'use client';

import { createAuthClient } from 'better-auth/react';

function getAuthBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    console.warn('[auth-client] NEXT_PUBLIC_API_URL is not configured. Falling back to current origin.');
    return window.location.origin;
  }
  return 'http://localhost:5001';
}

export const authClient = createAuthClient({
  baseURL: getAuthBaseUrl(),
  fetchOptions: {
    credentials: 'include',
  },
});

export const { signIn, signUp, signOut, getSession, useSession } = authClient;
