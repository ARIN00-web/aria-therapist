import { GoogleGenAI } from '@google/genai';


const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});


const CRISIS_PHRASES = [
  'want to die', 
  'end my life', 
  'kill myself',
  'not worth living', 
  'self harm', 
  'hurt myself',
  'no point anymore', 
  'better off dead',
  'suicide',
  'wanna die'
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
  message: `I'm really glad you shared that with me. Please reach out right now to get professional support:`,
  resources: [
    { name: 'iCall (India)', number: '9152987821' },
    { name: 'Vandrevala Foundation', number: '1860-2662-345' },
    { name: 'NIMHANS', number: '080-46110007' }
  ],
  pauseSession: true
};


export async function detectCrisis(message: string): Promise<CrisisResponse> {
  const normalizedMessage = message.toLowerCase().trim();

  
  const containsCrisisPhrase = CRISIS_PHRASES.some(phrase => 
    normalizedMessage.includes(phrase)
  );

  if (containsCrisisPhrase) {
    return { isCrisis: true, ...CRISIS_RESPONSE };
  }

  
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[Crisis Detector]: No GEMINI_API_KEY found. Skipping LLM crisis check.');
    return { isCrisis: false };
  }

  
  try {
    const response = await ai.models.generateContent({
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
    });

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
}
