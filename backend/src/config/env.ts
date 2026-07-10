export interface AppConfig {
  port: number;
  mongoUri: string;
  frontendOrigin: string;
  encryptionKey: string;
  authSecret: string;
  anthropicApiKey?: string;
  anthropicChatModel: string;
  anthropicUtilityModel: string;
  openAiApiKey?: string;
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
  return {
    port: Number(process.env.PORT || 5001),
    mongoUri: requireEnv('MONGODB_URI'),
    frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
    encryptionKey: requireEnv('ENCRYPTION_KEY'),
    authSecret: requireEnv('AUTH_SECRET'),
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    anthropicChatModel: process.env.ANTHROPIC_CHAT_MODEL || 'claude-3-5-sonnet-latest',
    anthropicUtilityModel: process.env.ANTHROPIC_UTILITY_MODEL || 'claude-3-5-haiku-latest',
    openAiApiKey: process.env.OPENAI_API_KEY,
    qdrantUrl: process.env.QDRANT_URL,
    qdrantApiKey: process.env.QDRANT_API_KEY,
    qdrantCollection: process.env.QDRANT_COLLECTION || 'therapy_knowledge',
    nodeEnv: process.env.NODE_ENV || 'development'
  };
}
