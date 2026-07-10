export interface OnboardingPayload {
  name: string;
  email: string;
  preferredModality: string;
  timezone: string;
  onboardingAnswers: Record<string, string>;
  consentAccepted: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export async function completeOnboarding(payload: OnboardingPayload): Promise<string> {
  const response = await fetch(`${API_URL}/api/auth/onboarding`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error(await readError(response));
  const data = await response.json() as { accessToken: string };
  return data.accessToken;
}

export async function createSession(accessToken: string, moodBefore: number): Promise<string> {
  const response = await fetch(`${API_URL}/api/sessions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ moodBefore })
  });

  if (!response.ok) throw new Error(await readError(response));
  const data = await response.json() as { session: { _id: string; id?: string } };
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
  const response = await fetch(`${API_URL}/api/sessions/${sessionId}/end`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ moodAfter })
  });

  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

async function readError(response: Response): Promise<string> {
  try {
    const data = await response.json() as { error?: string };
    return data.error || 'Request failed';
  } catch {
    return 'Request failed';
  }
}
