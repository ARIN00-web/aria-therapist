<<<<<<< HEAD
import { GoogleGenAI } from '@google/genai';
import { withTimeout } from '../utils/withTimeout';



let ai: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!ai) {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || '',
    });
  }
  return ai;
}

=======
import { callAnthropicText } from './llm.client';
>>>>>>> b406221 (feat: add user export route and memory management services)

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

<<<<<<< HEAD
  
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[Crisis Detector]: No GEMINI_API_KEY found. Skipping LLM crisis check.');
    return { isCrisis: false };
  }

  
  try {
    const response = await withTimeout(
      getGeminiClient().models.generateContent({
        model: 'gemini-2.0-flash',
        contents: message,
        config: {
          systemInstruction: `You are a strict safety classifier for a mental health support platform.
Your task is to analyze the user message and determine if it indicates immediate danger of self-harm, suicide, or severe, acute mental health crisis.
Respond with exactly one word: "YES" or "NO".
Do not write anything else. No explanation, no punctuation.`,
          temperature: 0,
          maxOutputTokens: 10,
        }
      }),
      8000,
      'Crisis detection'
    );

    const verdict = response.text?.trim().toUpperCase();

    if (verdict === 'YES') {
      console.log('[Crisis Detector]: Gemini classified message as CRISIS.');
      return { isCrisis: true, ...CRISIS_RESPONSE };
    }

    return { isCrisis: false };
  } catch (error) {
    console.error('[Crisis Detector]: Error running Gemini crisis check:', error);
    
    return { isCrisis: false };
  }
=======
  return { isCrisis: false };
}

export async function detectCrisis(message: string): Promise<CrisisResponse> {
  const keywordResult = detectCrisisKeywords(message);
  if (keywordResult.isCrisis) return keywordResult;

  const verdict = await callAnthropicText({
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
>>>>>>> b406221 (feat: add user export route and memory management services)
}
