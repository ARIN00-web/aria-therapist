import { GoogleGenerativeAI } from '@google/generative-ai';
import { SessionModel } from '../models/Session.model';

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');

export async function summarizeSessionIfNeeded(sessionId: string): Promise<void> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[Summarizer] GEMINI_API_KEY is not configured. Skipping summarization.');
    return;
  }

  try {
    console.log(`[Summarizer] Checking session ${sessionId} for summary refresh`);
    const session = await SessionModel.findById(sessionId);

    if (!session) {
      console.warn(`[Summarizer] Session ${sessionId} not found`);
      return;
    }

    if (session.messages.length === 0 || session.messages.length % 10 !== 0) {
      console.log(`[Summarizer] No summary needed for session ${sessionId}`);
      return;
    }

    const messagesToSummarize = session.messages.slice(0, -12);
    if (messagesToSummarize.length === 0) {
      console.log(`[Summarizer] Not enough older messages to summarize for session ${sessionId}`);
      return;
    }

    const transcript = messagesToSummarize
      .map(({ role, content, ts }) => `[${new Date(ts).toISOString()}] ${role}: ${content}`)
      .join('\n');

    const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent([
      {
        text: [
          'Summarize this therapy session so far in 150 words.',
          'Focus on emotional themes, what the user shared, and any progress or insights.',
          'Write in plain, clinically respectful language for internal memory use only.',
          '',
          transcript,
        ].join('\n'),
      },
    ]);

    const summary = result.response.text().trim();
    if (!summary) {
      console.warn(`[Summarizer] Gemini returned an empty summary for session ${sessionId}`);
      return;
    }

    session.rollingSummary = summary;
    await session.save();
    console.log(`[Summarizer] Updated rolling summary for session ${sessionId}`);
  } catch (error) {
    console.error('[Summarizer] Failed to update rolling summary:', error);
  }
}
