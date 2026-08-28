import { MongoClient } from 'mongodb';
import { getConfig, normalizeMongoUri } from './env';
import { importEsm } from '../utils/esm';

// `better-auth` is ESM-only. This file is also loaded by Vercel's CommonJS
// function runtime, so imports must stay dynamic; a static import is rewritten
// to require() and crashes before the API can start.
let authPromise: Promise<any> | null = null;

export function getAuth(): Promise<any> {
  if (authPromise) return authPromise;

  authPromise = Promise.all([
    importEsm(['better-auth'].join('')),
    importEsm(['better-auth', 'adapters/mongodb'].join('/'))
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

    return betterAuth({
      database: mongodbAdapter(db, {
        client,
        transaction: false,
      }),

      secret:
        process.env.BETTER_AUTH_SECRET ||
        process.env.AUTH_SECRET,

      baseURL:
        process.env.BETTER_AUTH_URL ||
        'http://127.0.0.1:5001',

      trustedOrigins: config.frontendOrigins,

      advanced: {
        defaultCookieAttributes:
          config.nodeEnv === 'production'
            ? {
                sameSite: 'none',
                secure: true,
              }
            : undefined,
      },

      socialProviders: {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID || '',
          clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
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
  });

  return authPromise;
}