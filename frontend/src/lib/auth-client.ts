'use client';

import { createAuthClient } from 'better-auth/react';
import { getApiBase } from './api';

export const authClient = createAuthClient({
  baseURL: getApiBase(),
  fetchOptions: {
    credentials: 'include',
  },
});

export const { signIn, signUp, signOut, getSession, useSession } = authClient;
