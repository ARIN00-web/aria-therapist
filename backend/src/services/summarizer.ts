import { type ISession } from '../models/Session.model';
import { callGeminiText } from './llm.client';

const TIER_ONE_MESSAGE_COUNT = 12;
const SUMMARY_BATCH_SIZE = 6;
const SUMMARY_REFRESH_WINDOW = 60;

async function generateRollingSummary(
  existingSummary: string,
  recentSummarizedTranscript: string,
  newestChunkTranscript: string
): Promise<string> {
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

  const result = await callGeminiText({
    system: 'You are a session summarizer helper for an AI therapist platform.',
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 500,
    timeoutMs: 12000,
    utility: true
  });

  return result?.trim() || '';
}

export async function updateRollingSummaryIfNeeded(session: ISession): Promise<void> {
  if (session.messages.length <= TIER_ONE_MESSAGE_COUNT) {
    return;
  }

  try {
    let modified = false;

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
        `[Summarizer] Refreshing summary with recent window ${recentWindowStartIndex + 1}-${startIndex} and new chunk ${startIndex + 1}-${endIndex} for session ${session._id}`
      );

      const summary = await generateRollingSummary(
        session.rollingSummary ?? '',
        recentSummarizedTranscript,
        newestChunkTranscript
      );

      if (!summary) {
        console.warn(`[Summarizer] Gemini returned an empty summary for session ${session._id}`);
        break;
      }

      session.rollingSummary = summary;
      session.summaryMessageCount += SUMMARY_BATCH_SIZE;
      modified = true;
    }

    if (modified) {
      await session.save();
      console.log(`[Summarizer] Updated rolling summary for session ${session._id}`);
    }
  } catch (error) {
    console.error('[Summarizer] Failed to update rolling summary:', error);
  }
}
