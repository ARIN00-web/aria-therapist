import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import { MongoClient } from 'mongodb';
import { getConfig, normalizeMongoUri } from './env';
import { importEsm } from '../utils/esm';

function getBetterAuthModuleUrls() {
  const candidates = [
    path.resolve(__dirname, '../../node_modules/better-auth'),
    path.resolve(__dirname, '../../../node_modules/better-auth'),
    path.resolve(process.cwd(), 'node_modules/better-auth'),
    path.resolve(process.cwd(), 'backend/node_modules/better-auth'),
  ];

  for (const candidate of candidates) {
    const entry = path.join(candidate, 'dist/index.mjs');
    const adapter = path.join(candidate, 'dist/adapters/mongodb-adapter/index.mjs');
    if (fs.existsSync(entry) && fs.existsSync(adapter)) {
      return {
        betterAuthUrl: pathToFileURL(entry).href,
        mongodbAdapterUrl: pathToFileURL(adapter).href,
      };
    }
  }

  return {
    betterAuthUrl: 'better-auth',
    mongodbAdapterUrl: 'better-auth/adapters/mongodb',
  };
}

let authPromise: Promise<any> | null = null;

export function getAuth(): Promise<any> {
  if (authPromise) return authPromise;

  const { betterAuthUrl, mongodbAdapterUrl } = getBetterAuthModuleUrls();

  authPromise = Promise.all([
    importEsm(betterAuthUrl),
    importEsm(mongodbAdapterUrl)
  ]).then(async ([{ betterAuth }, { mongodbAdapter }]) => {
    const config = getConfig();

    const mongoUri = normalizeMongoUri(
      process.env.MONGODB_URI || ''
    );

    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    // Better Auth uses its own MongoClient, separate from Mongoose.
    // Explicitly connect it so failures happen quickly and visibly on Vercel.
    const client = new MongoClient(mongoUri, {
      serverSelectionTimeoutMS: 10000,
    });

    await client.connect();

    console.log('[auth:mongodb] connected');

    const db = client.db();

    const isProduction = config.nodeEnv === 'production' || Boolean(process.env.VERCEL);
    const configuredBetterAuthUrl = process.env.BETTER_AUTH_URL?.trim();
    const productionFallback = process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'https://aria-therapist.vercel.app';

    const baseURL = (configuredBetterAuthUrl && !configuredBetterAuthUrl.includes('localhost') && !configuredBetterAuthUrl.includes('127.0.0.1'))
      ? configuredBetterAuthUrl
      : (isProduction ? productionFallback : (configuredBetterAuthUrl || 'http://localhost:5001'));

    return betterAuth({
      database: mongodbAdapter(db, {
        client,
        transaction: false,
      }),

      emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
      },

      secret:
        process.env.BETTER_AUTH_SECRET ||
        process.env.AUTH_SECRET,

      trustedOrigins: [
        ...config.frontendOrigins,
        'https://aria-therapist-ws67.vercel.app',
        'https://aria-therapist.vercel.app',
        'https://*.vercel.app'
      ],

      advanced: {
        defaultCookieAttributes:
          isProduction
            ? {
                sameSite: 'none',
                secure: true,
                partitioned: true,
              }
            : undefined,
      },

      socialProviders: {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID || '',
          clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
          enabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        },
      },

      user: {
        modelName: 'users',

        additionalFields: {
          preferredModality: {
            type: 'string',
            required: false,
            defaultValue: 'Auto',
            input: true,
          },

          timezone: {
            type: 'string',
            required: false,
            defaultValue: 'UTC',
            input: true,
          },

          onboardingAnswers: {
            type: 'json',
            required: false,
            defaultValue: {},
            input: true,
          },

          consentAcceptedAt: {
            type: 'date',
            required: false,
          },

          tokenVersion: {
            type: 'number',
            required: false,
            defaultValue: 0,
          },

          lastActiveAt: {
            type: 'date',
            required: false,
          },

          deletedAt: {
            type: 'date',
            required: false,
          },
        },
      },

      session: {
        modelName: 'user_sessions',
      },

      account: {
        modelName: 'accounts',

        accountLinking: {
          enabled: true,
          trustedProviders: ['google'],
          requireLocalEmailVerified: false,
        },
      },

      verification: {
        modelName: 'verifications',
      },
    });
  }).catch((err) => {
    // Reset cache on failure so future invocations can retry cleanly
    authPromise = null;
    throw err;
  });

  return authPromise;
}