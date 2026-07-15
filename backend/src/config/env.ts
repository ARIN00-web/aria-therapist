export interface AppConfig {
  port: number;
  mongoUri: string;
  frontendOrigin: string;
  encryptionKey: string;
  authSecret: string;
  geminiApiKey?: string;
  deepseekApiKey?: string;
  openrouterApiKey?: string;
  openrouterModel: string;
  qdrantUrl?: string;
  qdrantApiKey?: string;
  qdrantCollection: string;
  nodeEnv: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

export function getConfig(): AppConfig {
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
  const deepseekApiKey = process.env.DEEPSEEK_API_KEY?.trim();
  const openrouterApiKey = process.env.OPENROUTER_API_KEY?.trim();

  if (!geminiApiKey && !deepseekApiKey && !openrouterApiKey) {
    throw new Error('Either GEMINI_API_KEY, DEEPSEEK_API_KEY, or OPENROUTER_API_KEY environment variable is required');
  }

  return {
    port: Number(process.env.PORT || 5001),
    mongoUri: requireEnv('MONGODB_URI'),
    frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
    encryptionKey: requireEnv('ENCRYPTION_KEY'),
    authSecret: requireEnv('AUTH_SECRET'),
    geminiApiKey,
    deepseekApiKey,
    openrouterApiKey,
    openrouterModel: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
    qdrantUrl: process.env.QDRANT_URL,
    qdrantApiKey: process.env.QDRANT_API_KEY,
    qdrantCollection: process.env.QDRANT_COLLECTION || 'therapy_knowledge',
    nodeEnv: process.env.NODE_ENV || 'development'
  };
}
