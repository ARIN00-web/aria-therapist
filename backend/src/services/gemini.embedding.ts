import { GoogleGenerativeAI } from '@google/generative-ai';
import { getConfig } from '../config/env';

/**
 * Generates embeddings without loading a local model inside the serverless
 * function. Local Transformer runtimes are ESM-only and too large for a
 * reliable Vercel cold start.
 */
export async function getGeminiEmbedding(text: string): Promise<number[]> {
  const apiKey = getConfig().geminiApiKey;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required when QDRANT_URL is configured');
  }

  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: 'gemini-embedding-001'
  });
  const result = await model.embedContent(text);
  return result.embedding.values || [];
}
