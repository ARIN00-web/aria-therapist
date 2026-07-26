export function normalizeMongoUri(uri: string): string {
  if (!uri) {
    return uri;
  }

  // If the caller has already specified retryWrites, respect their choice.
  if (/[?&]retryWrites=/.test(uri)) {
    return uri;
  }

  // Default to retryWrites=false for maximum compatibility: standalone mongod
  // instances (common in local/dev and simple self-hosted setups) reject
  // retryable writes and error out otherwise. Replica sets / Atlas can opt back
  // in by putting retryWrites=true directly in MONGODB_URI.
  const separator = uri.includes('?') ? '&' : '?';
  return `${uri}${separator}retryWrites=false`;
}

export interface AppConfig {
  port: number;
  mongoUri: string;
  frontendOrigin: string;
  frontendOrigins: string[];
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

function getFrontendOrigins(): string[] {
  const configuredOrigins = [process.env.FRONTEND_ORIGIN, process.env.FRONTEND_ORIGINS]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(',');

  const parsedOrigins = configuredOrigins
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const defaults = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  return Array.from(new Set([...parsedOrigins, ...defaults]));
}

export function getConfig(): AppConfig {
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
  const deepseekApiKey = process.env.DEEPSEEK_API_KEY?.trim();
  const openrouterApiKey = process.env.OPENROUTER_API_KEY?.trim();

  if (!geminiApiKey && !deepseekApiKey && !openrouterApiKey) {
    throw new Error('Either GEMINI_API_KEY, DEEPSEEK_API_KEY, or OPENROUTER_API_KEY environment variable is required');
  }

  const frontendOrigins = getFrontendOrigins();

  return {
    port: Number(process.env.PORT || 5001),
    mongoUri: normalizeMongoUri(requireEnv('MONGODB_URI')),
    frontendOrigin: frontendOrigins[0],
    frontendOrigins,
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
