const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

// Registered by AuthContext. Called when a protected request is definitively
// unauthenticated (401 that we could not recover from). Lets the app clear the
// current user and redirect to /login — important for OAuth cookie users, who
// have no Bearer token to refresh.
let onUnauthenticated: (() => void) | null = null;
export function setUnauthenticatedHandler(fn: (() => void) | null) {
  onUnauthenticated = fn;
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/api/custom-auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = await res.json();
    accessToken = data.accessToken;
    return accessToken;
  } catch {
    return null;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const doFetch = async (token: string | null) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    return fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });
  };

  let res = await doFetch(accessToken);

  if (res.status === 401 && accessToken) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await doFetch(newToken);
    }
  }

  if (!res.ok) {
    // A surviving 401 means the session is gone (expired OAuth cookie, or a
    // refresh that could not be renewed). Notify the app so it can redirect.
    if (res.status === 401) {
      accessToken = null;
      onUnauthenticated?.();
    }
    const body = await res.json().catch(() => ({}));
    const message =
      (body as { error?: string; message?: string }).error ||
      (body as { message?: string }).message ||
      'Request failed';
    throw new ApiError(res.status, message);
  }

  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// Auth
export const authApi = {
  onboard: (body: {
    name: string;
    email: string;
    preferredModality: string;
    timezone: string;
    onboardingAnswers: Record<string, unknown>;
    consentAccepted: boolean;
  }) => apiFetch<{ accessToken: string }>('/api/custom-auth/onboarding', {
    method: 'POST',
    body: JSON.stringify(body),
  }),

  // Completes onboarding for a user created via Google OAuth. Name/email come
  // from Google, so we only collect modality, questions, and consent here.
  // Authenticated via the better-auth cookie (or Bearer) — apiFetch handles both.
  completeOnboardingOauth: (body: {
    preferredModality: string;
    timezone: string;
    onboardingAnswers: Record<string, unknown>;
    consentAccepted: boolean;
  }) => apiFetch<{ user: User }>('/api/custom-auth/complete-onboarding-oauth', {
    method: 'POST',
    body: JSON.stringify(body),
  }),

  logout: () =>
    apiFetch('/api/custom-auth/logout', { method: 'POST' }),

  me: () => apiFetch<{ user: User }>('/api/custom-auth/me'),

  updateSettings: (body: { preferredModality?: string; timezone?: string }) =>
    apiFetch<{ user: User }>('/api/wellness/settings', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};

// Sessions
export const sessionsApi = {
  list: () => apiFetch<{ sessions: Session[] }>('/api/sessions'),

  active: () => apiFetch<{ session: Session | null }>('/api/sessions/active'),

  create: (moodBefore: number) =>
    apiFetch<{ session: Session }>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ moodBefore }),
    }),

  get: (id: string) => apiFetch<{ session: Session }>(`/api/sessions/${id}`),

  end: (id: string, moodAfter: number) =>
    apiFetch<{ session: Session }>(`/api/sessions/${id}/end`, {
      method: 'POST',
      body: JSON.stringify({ moodAfter }),
    }),
};

// Wellness
export const wellnessApi = {
  summary: () => apiFetch<WellnessSummary>('/api/wellness/summary'),

  logMood: (mood: number, moodLabel?: string) =>
    apiFetch('/api/wellness/mood', {
      method: 'POST',
      body: JSON.stringify({ mood, moodLabel }),
    }),

  getJournal: () => apiFetch<{ entries: WellnessActivity[] }>('/api/wellness/journal'),

  addJournal: (title: string, content: string) =>
    apiFetch('/api/wellness/journal', {
      method: 'POST',
      body: JSON.stringify({ title, content }),
    }),

  getGoals: () => apiFetch<{ goals: WellnessActivity[] }>('/api/wellness/goals'),

  addGoal: (title: string, content?: string) =>
    apiFetch('/api/wellness/goals', {
      method: 'POST',
      body: JSON.stringify({ title, content }),
    }),

  toggleGoal: (goalId: string, completed: boolean) =>
    apiFetch(`/api/wellness/goals/${goalId}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    }),

  logTool: (tool: string) =>
    apiFetch('/api/wellness/tools', {
      method: 'POST',
      body: JSON.stringify({ tool }),
    }),

  getResources: () => apiFetch<{ resources: Resource[] }>('/api/wellness/resources'),
};

// Memory
export const memoryApi = {
  get: () => apiFetch<{ memory: { profile: MemoryProfile } }>('/api/memory').then((r) => ({ profile: r.memory.profile })),
};

// Types
export interface User {
  _id: string;
  name: string;
  email: string;
  preferredModality: string;
  timezone: string;
  createdAt: string;
  // Returned by GET /api/custom-auth/me. `consentAcceptedAt` is the signal for
  // whether a (Google) user still needs to complete onboarding.
  consentAcceptedAt?: string | null;
  onboardingAnswers?: Record<string, unknown>;
}

export interface Session {
  _id: string;
  startedAt: string;
  endedAt?: string;
  moodBefore?: number;
  moodAfter?: number;
  status: 'active' | 'paused_for_crisis' | 'ended';
  messages?: Message[];
  summaryCard?: {
    themes: string[];
    reflection: string;
    nextTopic: string;
  };
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  ts: string;
}

export interface WellnessActivity {
  _id: string;
  type: string;
  title?: string;
  content?: string;
  mood?: number;
  moodLabel?: string;
  tool?: string;
  completed?: boolean;
  createdAt: string;
}

export interface WellnessSummary {
  moods: WellnessActivity[];
  journals: WellnessActivity[];
  goals: WellnessActivity[];
  messages: WellnessActivity[];
  tools: WellnessActivity[];
  resources: Resource[];
}

export interface Resource {
  title: string;
  category: string;
  description: string;
}

export interface MemoryProfile {
  recurringThemes: string[];
  keyPeople: Array<{ name: string; relationship: string; dynamic: string }>;
  triggers: string[];
  copingStrategies: Array<{ strategy: string; effectiveness: string }>;
  progressNotes: string[];
  moodTrend?: string;
  followUpTopics: string[];
}
