let extractorPromise: any = null;

import { importEsm } from '../utils/esm';

async function getExtractor() {
  if (!extractorPromise) {
    // pipeline returns a Promise that resolves to the feature-extraction function
    const pkgName = ['@xenova', 'transformers'].join('/');
    extractorPromise = importEsm(pkgName)
      .then(async ({ pipeline, env }) => {
        // Configure cache directory for write access in serverless environments
        env.cacheDir = '/tmp/transformers-cache';
        return pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      });
  }
  return extractorPromise;
}

export async function getLocalEmbedding(text: string): Promise<number[]> {
  try {
    const extractor = await getExtractor();
    const output = await extractor(text, {
      pooling: 'mean',
      normalize: true,
    });
    
    // Convert the Float32Array to a standard JavaScript number array
    return Array.from(output.data) as number[];
  } catch (error) {
    console.error('[Local Embedding] Error generating embedding:', error);
    throw error;
  }
}
