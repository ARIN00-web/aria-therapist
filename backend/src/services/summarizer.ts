import { GoogleGenerativeAI } from '@google/generative-ai';
import { SessionModel } from '../models/Session.model';
import { withTimeout } from '../utils/withTimeout';

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
const TIER_ONE_MESSAGE_COUNT = 12;
const SUMMARY_BATCH_SIZE = 6;
const SUMMARY_REFRESH_WINDOW = 60;

async function generateRollingSummary(
  existingSummary: string,
  recentSummarizedTranscript: string,
  newestChunkTranscript: string
): Promise<string> {
  const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const prompt = [
    'You maintain a rolling therapy session summary for internal memory use.',
    'Rewrite the rolling summary from scratch using the existing summary, the recent summarized message window, and the newest 6-message chunk.',
    'Keep the result under 200 words.',
    'Focus on emotional themes, what the user shared, current struggles, breakthroughs, and useful suggestions already discussed.',
    'Correct drift, remove repetition, and preserve the most clinically useful context.',
    '',
    'Existing rolling summary:',
    existingSummary || 'No existing summary yet.',
    '',
    'Recent summarized messages window:',
    recentSummarizedTranscript || 'No previously summarized message window available.',
    '',
    'Newest 6-message chunk to add:',
    newestChunkTranscript,
  ].join('\n');

  const result = await withTimeout(
    model.generateContent(prompt),
    12000,
    'Session summarizer'
  );

  return result.response.text().trim();
}

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

    if (session.messages.length <= TIER_ONE_MESSAGE_COUNT) {
      console.log(`[Summarizer] Session ${sessionId} is still within Tier 1 working memory`);
      return;
    }

    while ((session.messages.length - TIER_ONE_MESSAGE_COUNT - session.summaryMessageCount) >= SUMMARY_BATCH_SIZE) {
      const startIndex = session.summaryMessageCount;
      const endIndex = startIndex + SUMMARY_BATCH_SIZE;
      const nextChunk = session.messages.slice(startIndex, endIndex);
      const recentWindowStartIndex = Math.max(0, startIndex - SUMMARY_REFRESH_WINDOW);
      const recentSummarizedWindow = session.messages.slice(recentWindowStartIndex, startIndex);

      const recentSummarizedTranscript = recentSummarizedWindow
        .map(({ role, content, ts }) => `[${new Date(ts).toISOString()}] ${role}: ${content}`)
        .join('\n');

      const newestChunkTranscript = nextChunk
        .map(({ role, content, ts }) => `[${new Date(ts).toISOString()}] ${role}: ${content}`)
        .join('\n');

      console.log(
        `[Summarizer] Refreshing summary with recent window ${recentWindowStartIndex + 1}-${startIndex} and new chunk ${startIndex + 1}-${endIndex} for session ${sessionId}`
      );

      const summary = await generateRollingSummary(
        session.rollingSummary ?? '',
        recentSummarizedTranscript,
        newestChunkTranscript
      );
      if (!summary) {
        console.warn(`[Summarizer] Gemini returned an empty summary for session ${sessionId}`);
        return;
      }

      session.rollingSummary = summary;
      session.summaryMessageCount += SUMMARY_BATCH_SIZE;
    }

    if (session.isModified('rollingSummary') || session.isModified('summaryMessageCount')) {
      await session.save();
      console.log(`[Summarizer] Updated rolling summary for session ${sessionId}`);
      return;
    }

    console.log(`[Summarizer] No new 6-message batch ready for session ${sessionId}`);
  } catch (error) {
    console.error('[Summarizer] Failed to update rolling summary:', error);
  }
}
