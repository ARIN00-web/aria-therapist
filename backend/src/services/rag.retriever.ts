import { getConfig } from '../config/env';

export interface RetrievedChunk {
  text: string;
  source?: string;
  modality?: string;
  score?: number;
}

export async function retrieveClinicalContext(message: string): Promise<RetrievedChunk[]> {
  const config = getConfig();
  if (!config.openAiApiKey || !config.qdrantUrl) return [];

  const embedding = await embedText(message);
  if (!embedding.length) return [];

  const response = await fetch(`${config.qdrantUrl.replace(/\/$/, '')}/collections/${config.qdrantCollection}/points/search`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(config.qdrantApiKey ? { 'api-key': config.qdrantApiKey } : {})
    },
    body: JSON.stringify({
      vector: embedding,
      limit: 3,
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
}

async function embedText(message: string): Promise<number[]> {
  const config = getConfig();
  if (!config.openAiApiKey) return [];

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.openAiApiKey}`
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: message
    })
  });

  if (!response.ok) return [];

  const data = await response.json() as { data?: Array<{ embedding: number[] }> };
  return data.data?.[0]?.embedding || [];
}
