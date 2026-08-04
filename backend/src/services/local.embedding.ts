let extractorPromise: any = null;

// @xenova/transformers is ESM-only. TypeScript compiles normal dynamic imports
// to require() in this CommonJS project, which fails in Vercel's Node runtime.
// Constructing the native import keeps it intact at runtime.
const importEsm = new Function('modulePath', 'return import(modulePath)') as (
  modulePath: string
) => Promise<any>;

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
