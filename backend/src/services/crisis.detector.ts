import { callGeminiText } from './llm.client';

const CRISIS_PHRASES = [
  'want to die',
  'end my life',
  'kill myself',
  'not worth living',
  'self harm',
  'self-harm',
  'hurt myself',
  'no point anymore',
  'better off dead',
  'suicide',
  'wanna die',
  'take my life',
  'i cannot go on'
];

export interface CrisisResource {
  name: string;
  number: string;
}

export interface CrisisResponse {
  isCrisis: boolean;
  message?: string;
  resources?: CrisisResource[];
  pauseSession?: boolean;
}

export const CRISIS_RESPONSE: Omit<CrisisResponse, 'isCrisis'> = {
  message: "I'm really glad you shared that with me. Please reach out right now to get professional support:",
  resources: [
    { name: 'iCall (India)', number: '9152987821' },
    { name: 'Vandrevala Foundation', number: '1860-2662-345' },
    { name: 'NIMHANS', number: '080-46110007' }
  ],
  pauseSession: true
};

export function detectCrisisKeywords(message: string): CrisisResponse {
  const normalizedMessage = message.toLowerCase().trim();
  const containsCrisisPhrase = CRISIS_PHRASES.some((phrase) => normalizedMessage.includes(phrase));

  if (containsCrisisPhrase) {
    return { isCrisis: true, ...CRISIS_RESPONSE };
  }

  return { isCrisis: false };
}

export async function detectCrisis(message: string): Promise<CrisisResponse> {
  const keywordResult = detectCrisisKeywords(message);
  if (keywordResult.isCrisis) return keywordResult;

  const verdict = await callGeminiText({
    system: `You are a strict safety classifier for a mental health support platform.
Return exactly YES if the message indicates immediate danger of suicide, self-harm, or acute crisis.
Return exactly NO otherwise. Do not explain.`,
    messages: [{ role: 'user', content: message }],
    maxTokens: 5,
    timeoutMs: 4_000,
    utility: true
  });

  if (verdict?.trim().toUpperCase() === 'YES') {
    return { isCrisis: true, ...CRISIS_RESPONSE };
  }

  return { isCrisis: false };
}
