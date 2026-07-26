import { getConfig } from '../config/env';
import { getLocalEmbedding } from './local.embedding';

export interface RetrievedChunk {
  text: string;
  source?: string;
  modality?: string;
  score?: number;
}

export async function retrieveClinicalContext(message: string, modality?: string): Promise<RetrievedChunk[]> {
  const config = getConfig();
  if (!config.qdrantUrl) return [];

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

    if (!response.ok) return [];

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
    console.error('[RAG Retriever] Qdrant search failed:', error);
    return [];
  }
}

async function embedText(message: string): Promise<number[]> {
  try {
    return await getLocalEmbedding(message);
  } catch (error) {
    console.error('[RAG Retriever] Local embedding generation failed:', error);
    return [];
  }
}
