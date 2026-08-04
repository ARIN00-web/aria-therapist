import { getConfig } from '../config/env';
import { getGeminiEmbedding } from './gemini.embedding';

const QDRANT_RETRY_DELAY_MS = 30_000;
let qdrantUnavailableUntil = 0;

export interface RetrievedChunk {
  text: string;
  source?: string;
  modality?: string;
  score?: number;
}

export async function retrieveClinicalContext(message: string, modality?: string): Promise<RetrievedChunk[]> {
  const config = getConfig();
  if (!config.qdrantUrl) return [];
  if (Date.now() < qdrantUnavailableUntil) return [];

  const embedding = await embedText(message);
  if (!embedding.length) return [];

  const filter = modality ? {
    must: [
      {
        key: 'modality',
        match: { value: modality }
      }
    ]
  } : undefined;

  try {
    const response = await fetch(`${config.qdrantUrl.replace(/\/$/, '')}/collections/${config.qdrantCollection}/points/search`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(config.qdrantApiKey ? { 'api-key': config.qdrantApiKey } : {})
      },
      body: JSON.stringify({
        vector: embedding,
        limit: 3,
        filter,
        with_payload: true
      })
    });

    if (!response.ok) {
      if (response.status >= 500) qdrantUnavailableUntil = Date.now() + QDRANT_RETRY_DELAY_MS;
      console.warn('[rag:qdrant_unavailable]', { status: response.status });
      return [];
    }

    const data = await response.json() as {
      result?: Array<{ score: number; payload?: Record<string, unknown> }>;
    };

    return (data.result || []).map((item) => ({
      text: String(item.payload?.text || item.payload?.content || ''),
      source: item.payload?.source ? String(item.payload.source) : undefined,
      modality: item.payload?.modality ? String(item.payload.modality) : undefined,
      score: item.score
    })).filter((item) => item.text);
  } catch (error) {
    qdrantUnavailableUntil = Date.now() + QDRANT_RETRY_DELAY_MS;
    console.warn('[rag:qdrant_unavailable]', { code: networkErrorCode(error) });
    return [];
  }
}

function networkErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'cause' in error) {
    const cause = (error as { cause?: unknown }).cause;
    if (cause && typeof cause === 'object' && 'code' in cause) {
      return String((cause as { code?: unknown }).code || 'unknown');
    }
  }
  return 'unknown';
}

async function embedText(message: string): Promise<number[]> {
  try {
    return await getGeminiEmbedding(message);
  } catch (error) {
    console.error('[RAG Retriever] Embedding generation failed:', error);
    return [];
  }
}
