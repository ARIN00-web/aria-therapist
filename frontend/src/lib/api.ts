export interface OnboardingPayload {
  name: string;
  email: string;
  preferredModality: string;
  timezone: string;
  onboardingAnswers: Record<string, string>;
  consentAccepted: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

type RequestOptions = {
  method?: string;
  accessToken?: string;
  body?: unknown;
  credentials?: RequestCredentials;
};

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.accessToken) headers.authorization = `Bearer ${options.accessToken}`;

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    credentials: options.credentials,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  if (!response.ok) throw new Error(await readError(response));
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function completeOnboarding(payload: OnboardingPayload): Promise<string> {
  const data = await requestJson<{ accessToken: string }>('/api/auth/onboarding', {
    method: 'POST',
    credentials: 'include',
    body: payload
  });
  return data.accessToken;
}

export async function loginUser(email: string): Promise<string> {
  const data = await requestJson<{ accessToken: string }>('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    body: { email }
  });
  return data.accessToken;
}

export async function logoutUser(): Promise<void> {
  await requestJson<void>('/api/auth/logout', {
    method: 'POST',
    credentials: 'include'
  });
}

export async function createSession(accessToken: string, moodBefore: number): Promise<string> {
  const data = await requestJson<{ session: { _id: string; id?: string } }>('/api/sessions', {
    method: 'POST',
    accessToken,
    body: { moodBefore }
  });
  return data.session._id || data.session.id || '';
}

export async function streamMessage({
  accessToken,
  sessionId,
  message,
  onToken,
  onCrisis
}: {
  accessToken: string;
  sessionId: string;
  message: string;
  onToken: (token: string) => void;
  onCrisis: (content: string) => void;
}) {
  const response = await fetch(`${API_URL}/api/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ message })
  });

  if (!response.ok || !response.body) throw new Error(await readError(response));

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const event of events) {
      const eventName = event.match(/^event: (.+)$/m)?.[1];
      const data = event.match(/^data: (.+)$/m)?.[1];
      if (!data) continue;
      const parsed = JSON.parse(data) as { content?: string };
      if (eventName === 'token' && parsed.content) onToken(parsed.content);
      if (eventName === 'crisis' && parsed.content) onCrisis(parsed.content);
    }
  }
}

export async function endSession(accessToken: string, sessionId: string, moodAfter: number) {
  return requestJson(`/api/sessions/${sessionId}/end`, {
    method: 'POST',
    accessToken,
    body: { moodAfter }
  });
}

export async function refreshAccessToken(): Promise<string> {
  const data = await requestJson<{ accessToken: string }>('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include'
  });
  return data.accessToken;
}

export interface SessionHistoryItem {
  _id: string;
  startedAt: string;
  endedAt: string;
  moodBefore: number;
  moodAfter: number;
  status: string;
  summaryCard?: {
    summary: string;
    themes: string[];
    triggers: string[];
    copingStrategies: string[];
    insights: string[];
  };
}

export async function getSessions(accessToken: string): Promise<SessionHistoryItem[]> {
  const data = await requestJson<{ sessions: SessionHistoryItem[] }>('/api/sessions', { accessToken });
  return data.sessions;
}

export interface SessionDetails {
  _id: string;
  userId: string;
  startedAt: string;
  endedAt: string;
  moodBefore: number;
  moodAfter: number;
  status: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string; ts: string }>;
  rollingSummary?: string;
  summaryCard?: {
    summary: string;
    themes: string[];
    triggers: string[];
    copingStrategies: string[];
    insights: string[];
  };
}

export async function getSessionDetails(accessToken: string, sessionId: string): Promise<SessionDetails> {
  const data = await requestJson<{ session: SessionDetails }>(`/api/sessions/${sessionId}`, { accessToken });
  return data.session;
}

export interface WellnessActivity {
  _id: string;
  type: 'mood' | 'journal' | 'goal' | 'tool' | 'message' | 'setting';
  title?: string;
  content?: string;
  mood?: number;
  moodLabel?: string;
  tool?: string;
  completed?: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WellnessResource {
  title: string;
  category: string;
  description: string;
}

export interface WellnessSummary {
  moods: WellnessActivity[];
  journals: WellnessActivity[];
  goals: WellnessActivity[];
  messages: WellnessActivity[];
  tools: WellnessActivity[];
  resources: WellnessResource[];
}

export async function getWellnessSummary(accessToken: string): Promise<WellnessSummary> {
  return requestJson<WellnessSummary>('/api/wellness/summary', { accessToken });
}

export async function saveMood(accessToken: string, mood: number, moodLabel: string): Promise<WellnessActivity> {
  const data = await requestJson<{ mood: WellnessActivity }>('/api/wellness/mood', {
    method: 'POST',
    accessToken,
    body: { mood, moodLabel }
  });
  return data.mood;
}

export async function saveJournalEntry(accessToken: string, content: string, title = 'Journal entry'): Promise<WellnessActivity> {
  const data = await requestJson<{ entry: WellnessActivity }>('/api/wellness/journal', {
    method: 'POST',
    accessToken,
    body: { title, content }
  });
  return data.entry;
}

export async function saveGoal(accessToken: string, title: string, content = ''): Promise<WellnessActivity> {
  const data = await requestJson<{ goal: WellnessActivity }>('/api/wellness/goals', {
    method: 'POST',
    accessToken,
    body: { title, content }
  });
  return data.goal;
}

export async function updateGoal(accessToken: string, goalId: string, completed: boolean): Promise<WellnessActivity> {
  const data = await requestJson<{ goal: WellnessActivity }>(`/api/wellness/goals/${goalId}`, {
    method: 'PATCH',
    accessToken,
    body: { completed }
  });
  return data.goal;
}

export async function trackToolUse(accessToken: string, tool: string): Promise<WellnessActivity> {
  const data = await requestJson<{ activity: WellnessActivity }>('/api/wellness/tools', {
    method: 'POST',
    accessToken,
    body: { tool }
  });
  return data.activity;
}

export async function saveMessageNote(accessToken: string, content: string): Promise<WellnessActivity> {
  const data = await requestJson<{ message: WellnessActivity }>('/api/wellness/messages', {
    method: 'POST',
    accessToken,
    body: { content }
  });
  return data.message;
}

export async function updateSettings(accessToken: string, preferredModality: string): Promise<void> {
  await requestJson('/api/wellness/settings', {
    method: 'PATCH',
    accessToken,
    body: { preferredModality, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }
  });
}

async function readError(response: Response): Promise<string> {
  try {
    const data = await response.json() as { error?: string };
    return data.error || 'Request failed';
  } catch {
    return 'Request failed';
  }
}
