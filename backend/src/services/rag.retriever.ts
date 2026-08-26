import { getConfig } from '../config/env';

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
    // Qdrant Cloud uses the Query API. The older `/points/search` endpoint is
    // no longer accepted by current clusters and returns HTTP 400.
    const queryPoints = (activeFilter?: typeof filter) => fetch(
      `${config.qdrantUrl!.replace(/\/$/, '')}/collections/${config.qdrantCollection}/points/query`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(config.qdrantApiKey ? { 'api-key': config.qdrantApiKey } : {})
        },
        body: JSON.stringify({
          query: embedding,
          limit: 3,
          filter: activeFilter,
          with_payload: true
        })
      }
    );

    let response = await queryPoints(filter);
    // Collections created before the modality index existed reject filtered
    // queries. Return useful context while the index is being created instead
    // of silently disabling RAG for the whole chat.
    if (response.status === 400 && filter) {
      console.warn('[rag:qdrant_filter_unavailable] Retrying without modality filter');
      response = await queryPoints(undefined);
    }

    if (!response.ok) {
      if (response.status >= 500) qdrantUnavailableUntil = Date.now() + QDRANT_RETRY_DELAY_MS;
      console.warn('[rag:qdrant_unavailable]', { status: response.status });
      return [];
    }

    const data = await response.json() as {
      result?: {
        points?: Array<{ score: number; payload?: Record<string, unknown> }>;
      };
    };

    return (data.result?.points || []).map((item) => ({
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
    const { getLocalEmbedding } = await import('./local.embedding');
    return await getLocalEmbedding(message);
  } catch (error) {
    console.error('[RAG Retriever] Local embedding generation failed:', error);
    return [];
  }
}
