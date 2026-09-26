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

  const isProduction = (process.env.NODE_ENV === 'production') || Boolean(process.env.VERCEL);
  if (isProduction && parsedOrigins.length === 0) {
    throw new Error('FRONTEND_ORIGIN environment variable is required in production');
  }

  const defaults = isProduction ? [] : ['http://localhost:3000', 'http://127.0.0.1:3000'];
  const allOrigins = Array.from(new Set([...parsedOrigins, ...defaults].map(normalizeOrigin)));

  if (allOrigins.length === 0) {
    throw new Error('No valid frontend origins configured');
  }

  return allOrigins;
}

/**
 * Browsers send an Origin without a trailing slash or path. Normalizing the
 * configured value prevents a very common production CORS failure caused by
 * pasting `https://app.example.com/` into FRONTEND_ORIGIN.
 */
function normalizeOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid frontend origin: ${value}`);
  }

  if (!['http:', 'https:'].includes(url.protocol) || (url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) {
    throw new Error(`FRONTEND_ORIGIN must be an http(s) origin without a path: ${value}`);
  }

  return url.origin;
}

export function getConfig(): AppConfig {
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
  const deepseekApiKey = process.env.DEEPSEEK_API_KEY?.trim();
  const openrouterApiKey = process.env.OPENROUTER_API_KEY?.trim();

  if (!geminiApiKey && !deepseekApiKey && !openrouterApiKey) {
    throw new Error('Either GEMINI_API_KEY, DEEPSEEK_API_KEY, or OPENROUTER_API_KEY environment variable is required');
  }

  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production' || Boolean(process.env.VERCEL);
  const frontendOrigins = getFrontendOrigins();

  const mongoUri = normalizeMongoUri(requireEnv('MONGODB_URI'));
  const encryptionKey = requireEnv('ENCRYPTION_KEY');
  const authSecret = requireEnv('AUTH_SECRET');

  if (isProduction) {
    if (encryptionKey.length < 32) {
      throw new Error('ENCRYPTION_KEY must be at least 32 characters in production');
    }
    if (authSecret.length < 32) {
      throw new Error('AUTH_SECRET must be at least 32 characters in production');
    }
  }

  return {
    port: Number(process.env.PORT || 5001),
    mongoUri,
    frontendOrigin: frontendOrigins[0],
    frontendOrigins,
    encryptionKey,
    authSecret,
    geminiApiKey,
    deepseekApiKey,
    openrouterApiKey,
    openrouterModel: process.env.OPENROUTER_MODEL || 'openrouter/free',
    qdrantUrl: process.env.QDRANT_URL?.trim(),
    qdrantApiKey: process.env.QDRANT_API_KEY?.trim(),
    qdrantCollection: process.env.QDRANT_COLLECTION?.trim() || 'therapy_knowledge',
    nodeEnv
  };
}

let startupValidated = false;

export function validateAndLogStartupConfig(): void {
  if (startupValidated) return;
  startupValidated = true;

  const config = getConfig();
  const isProduction = config.nodeEnv === 'production' || Boolean(process.env.VERCEL);
  const betterAuthUrl = process.env.BETTER_AUTH_URL?.trim();

  console.log('[startup:validation] -----------------------------------------');
  console.log(`[startup:validation] NODE_ENV: ${config.nodeEnv}`);
  console.log(`[startup:validation] MONGODB_URI: configured`);
  console.log(`[startup:validation] ENCRYPTION_KEY: configured`);
  console.log(`[startup:validation] AUTH_SECRET: configured`);
  console.log(`[startup:validation] BETTER_AUTH_SECRET: ${process.env.BETTER_AUTH_SECRET ? 'configured' : 'using AUTH_SECRET'}`);
  console.log(`[startup:validation] BETTER_AUTH_URL: ${betterAuthUrl ? 'configured' : (isProduction ? 'MISSING (required in production)' : 'fallback: http://localhost:5001')}`);
  console.log(`[startup:validation] FRONTEND_ORIGIN: configured (${config.frontendOrigin})`);
  console.log(`[startup:validation] FRONTEND_ORIGINS count: ${config.frontendOrigins.length}`);
  console.log(`[startup:validation] OPENROUTER_API_KEY: ${config.openrouterApiKey ? 'configured' : 'not_configured'}`);
  console.log(`[startup:validation] OPENROUTER_MODEL: ${config.openrouterModel}`);
  console.log(`[startup:validation] QDRANT_URL: ${config.qdrantUrl ? 'configured' : 'not_configured'}`);
  console.log(`[startup:validation] QDRANT_API_KEY: ${config.qdrantApiKey ? 'configured' : 'not_configured'}`);
  console.log(`[startup:validation] QDRANT_COLLECTION: ${config.qdrantCollection}`);
  console.log('[startup:validation] -----------------------------------------');

  if (isProduction && !betterAuthUrl) {
    throw new Error('BETTER_AUTH_URL is required in production');
  }
}
