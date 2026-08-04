import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pdf = require('pdf-parse');
import { getConfig } from '../config/env';
import { getGeminiEmbedding } from './gemini.embedding';

interface DocumentChunk {
  id: string;
  text: string;
  source: string;
  modality: string;
}


function ensureDirExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function chunkText(text: string, sourceName: string, modality: string, chunkSize = 800, overlap = 150): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();

    if (chunk.length > 50) { // Skip trivial fragments
      const id = crypto.createHash('md5').update(`${sourceName}::${start}::${chunk.slice(0, 30)}`).digest('hex');
      chunks.push({
        id,
        text: chunk,
        source: sourceName,
        modality
      });
    }

    start += (chunkSize - overlap);
  }
  return chunks;
}


const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getGeminiEmbeddingWithRetry(text: string, retries = 6, baseDelay = 2000): Promise<number[]> {
  let delay = baseDelay;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await getGeminiEmbedding(text);
    } catch (error: any) {
      const errorStr = String(error?.message || error || '');
      const isRateLimit = 
        error?.status === 429 || 
        errorStr.includes('429') || 
        errorStr.includes('Quota exceeded') ||
        errorStr.includes('Too Many Requests');
        
      if (isRateLimit && attempt < retries) {
        console.log(`    [Rate Limit] 429 Quota Exceeded. Waiting ${(delay / 1000).toFixed(1)}s to retry (Attempt ${attempt}/${retries})...`);
        await sleep(delay);
        delay *= 2.5; // Exponential backoff
      } else {
        throw error;
      }
    }
  }
  throw new Error('Failed to generate embedding after max retries due to rate limits.');
}

export async function runIngestion() {
  const config = getConfig();
  const dataDir = path.join(__dirname, '../../data'); 
  ensureDirExists(dataDir);

  if (!config.qdrantUrl) {
    console.error('[RAG Ingestion] Error: QDRANT_URL is not set in the environment.');
    process.exit(1);
  }

  // Auto-create the Qdrant collection with the dimension returned by Gemini.
  const probeVector = await getGeminiEmbeddingWithRetry('Embedding dimension probe');
  const vectorSize = probeVector.length;
  if (!vectorSize) throw new Error('Gemini did not return an embedding vector');

  try {
    const checkUrl = `${config.qdrantUrl.replace(/\/$/, '')}/collections/${config.qdrantCollection}`;
    let checkRes = await fetch(checkUrl, {
      headers: config.qdrantApiKey ? { 'api-key': config.qdrantApiKey } : {}
    });

    if (checkRes.ok) {
      const collectionInfo = await checkRes.json() as any;
      const vectorsConfig = collectionInfo.result?.config?.params?.vectors;
      
      let currentSize = 0;
      if (vectorsConfig) {
        if (typeof vectorsConfig.size === 'number') {
          currentSize = vectorsConfig.size;
        } else if (typeof vectorsConfig === 'object') {
          const firstKey = Object.keys(vectorsConfig)[0];
          if (firstKey && vectorsConfig[firstKey] && typeof vectorsConfig[firstKey].size === 'number') {
            currentSize = vectorsConfig[firstKey].size;
          }
        }
      }

      if (currentSize !== vectorSize) {
        console.log(`[RAG Ingestion] Existing collection '${config.qdrantCollection}' has vector size ${currentSize} (expected ${vectorSize} for Gemini embeddings). Recreating...`);
        const deleteRes = await fetch(checkUrl, {
          method: 'DELETE',
          headers: config.qdrantApiKey ? { 'api-key': config.qdrantApiKey } : {}
        });
        if (!deleteRes.ok) {
          throw new Error(`Failed to delete old collection: ${deleteRes.statusText} (${deleteRes.status})`);
        }
        // Force recreation
        checkRes = { ok: false } as any;
      }
    }

    if (!checkRes.ok) {
        console.log(`[RAG Ingestion] Creating collection '${config.qdrantCollection}' with ${vectorSize} dimensions (Gemini)...`);
      const createRes = await fetch(checkUrl, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          ...(config.qdrantApiKey ? { 'api-key': config.qdrantApiKey } : {})
        },
        body: JSON.stringify({
          vectors: {
            size: vectorSize,
            distance: 'Cosine'
          }
        })
      });
      if (!createRes.ok) {
        throw new Error(`Failed to create collection: ${createRes.statusText} (${createRes.status})`);
      }
      console.log(`[RAG Ingestion] Collection '${config.qdrantCollection}' created successfully.`);
    }
  } catch (error) {
    console.error('[RAG Ingestion] Failed checking/creating Qdrant collection:', error);
    process.exit(1);
  }

  const files = fs.readdirSync(dataDir).filter((file) => {
    if (file.endsWith('.pdf')) {
      const txtFile = file.replace(/\.pdf$/, '.txt');
      if (fs.existsSync(path.join(dataDir, txtFile))) {
        return false; // Skip PDF if TXT exists
      }
    }
    return file.endsWith('.txt') || file.endsWith('.md') || file.endsWith('.pdf');
  });

  if (files.length === 0) {
    console.log(`\n================================================================`);
    console.log(`[RAG Ingestion] No data files found to process.`);
    console.log(`--> PLACE YOUR THERAPY FILES (e.g. CBT/DBT reference guides in .txt, .md, or .pdf format) in:`);
    console.log(`    ${path.resolve(dataDir)}`);
    console.log(`================================================================\n`);
    return;
  }

  console.log(`[RAG Ingestion] Found ${files.length} files to ingest.`);

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    let content = '';
    
    if (file.endsWith('.pdf')) {
      console.log(`[RAG Ingestion] Extracting text from PDF: ${file}...`);
      const dataBuffer = fs.readFileSync(filePath);
      const parsed = await (pdf as any)(dataBuffer);
      content = parsed.text;
    } else {
      content = fs.readFileSync(filePath, 'utf-8');
    }

    
    let modality = 'CBT';
    const lowerName = file.toLowerCase();
    if (lowerName.includes('dbt')) modality = 'DBT';
    else if (lowerName.includes('act')) modality = 'ACT';
    else if (lowerName.includes('mindfulness')) modality = 'Mindfulness';
    else if (lowerName.includes('motivational')) modality = 'Motivational Interviewing';

    console.log(`[RAG Ingestion] Processing ${file} as Modality: ${modality}...`);
    const chunks = chunkText(content, file, modality);
    console.log(`[RAG Ingestion] Split into ${chunks.length} chunks.`);

    // Check which chunks already exist in Qdrant
    const existingIds = new Set<string>();
    const checkBatchSize = 100;
    const qdrantBase = config.qdrantUrl.replace(/\/$/, '');
    
    console.log(`[RAG Ingestion] Checking Qdrant for existing chunks...`);
    for (let j = 0; j < chunks.length; j += checkBatchSize) {
      const batchChunks = chunks.slice(j, j + checkBatchSize);
      const batchIds = batchChunks.map(c => c.id);
      
      try {
        const checkEndpoint = `${qdrantBase}/collections/${config.qdrantCollection}/points`;
        const checkRes = await fetch(checkEndpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(config.qdrantApiKey ? { 'api-key': config.qdrantApiKey } : {})
          },
          body: JSON.stringify({
            ids: batchIds,
            with_payload: false,
            with_vector: false
          })
        });

        if (checkRes.ok) {
          const checkData = await checkRes.json() as { result?: Array<{ id: string }> };
          if (checkData.result) {
            for (const item of checkData.result) {
              existingIds.add(String(item.id));
            }
          }
        } else {
          const errorBody = await checkRes.text();
          console.warn(`[RAG Ingestion] Warning checking existing points (status ${checkRes.status}): ${errorBody}`);
        }
      } catch (err) {
        console.warn(`[RAG Ingestion] Error checking existing points:`, err);
      }
    }

    const newChunks = chunks.filter(c => !existingIds.has(c.id));
    console.log(`[RAG Ingestion] ${chunks.length - newChunks.length} chunks already exist in Qdrant.`);
    
    if (newChunks.length === 0) {
      console.log(`[RAG Ingestion] All chunks for ${file} are already ingested. Skipping.`);
      continue;
    }

    console.log(`[RAG Ingestion] Ingesting ${newChunks.length} new chunks...`);

    const batchSize = 50;
    for (let i = 0; i < newChunks.length; i += batchSize) {
      const batch = newChunks.slice(i, i + batchSize);

      try {
        const points = await Promise.all(batch.map(async (chunk, idx) => {
          const vector = await getGeminiEmbeddingWithRetry(chunk.text);
          if (i === 0 && idx === 0) {
            console.log(`[RAG Ingestion] Generated Gemini vector length: ${vector.length}`);
          }
          return {
            id: chunk.id,
            vector,
            payload: {
              text: chunk.text,
              source: chunk.source,
              modality: chunk.modality
            }
          };
        }));

        const qdrantEndpoint = `${qdrantBase}/collections/${config.qdrantCollection}/points`;
        const response = await fetch(qdrantEndpoint, {
          method: 'PUT',
          headers: {
            'content-type': 'application/json',
            ...(config.qdrantApiKey ? { 'api-key': config.qdrantApiKey } : {})
          },
          body: JSON.stringify({ points })
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`Qdrant API error: ${response.statusText} (${response.status}) - ${errorBody}`);
        }

        console.log(`[RAG Ingestion] Ingested chunks ${i + 1} to ${Math.min(i + batch.length, newChunks.length)} of ${newChunks.length}`);
      } catch (error) {
        console.error(`[RAG Ingestion] Error processing batch starting at chunk ${i}:`, error);
        await sleep(2000);
      }
    }
  }

  console.log('[RAG Ingestion] Data ingestion complete!');
}

if (require.main === module) {
  runIngestion()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[RAG Ingestion] Script failed:', err);
      process.exit(1);
    });
}
