  import { betterAuth } from "better-auth";
  import { mongodbAdapter } from "better-auth/adapters/mongodb";
  import { MongoClient } from "mongodb";
  import mongoose from "mongoose";
  import { getConfig, normalizeMongoUri } from "./env";

  const config = getConfig();
  const mongoUri = normalizeMongoUri(process.env.MONGODB_URI || "");
  if (!mongoUri) {
    throw new Error("MONGODB_URI environment variable is required");
  }

  const client = new MongoClient(mongoUri);
  const db = client.db();

  export const auth = betterAuth({
    database: mongodbAdapter(db, {
      client,
      transaction: false,
    }),
    secret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL || "http://127.0.0.1:5001",
    trustedOrigins: config.frontendOrigins,
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      },
    },
    user: {
      modelName: "users",
      additionalFields: {
        preferredModality: {
          type: "string",
          required: false,
          defaultValue: "Auto",
          input: true,
        },
        timezone: {
          type: "string",
          required: false,
          defaultValue: "UTC",
          input: true,
        },
        onboardingAnswers: {
          type: "json",
          required: false,
          defaultValue: {},
          input: true,
        },
        consentAcceptedAt: {
          type: "date",
          required: false,
        },
        tokenVersion: {
          type: "number",
          required: false,
          defaultValue: 0,
        },
        lastActiveAt: {
          type: "date",
          required: false,
        },
        deletedAt: {
          type: "date",
          required: false,
        },
      },
    },
    session: {
      modelName: "user_sessions",
    },
    account: {
      modelName: "accounts",
    },
    verification: {
      modelName: "verifications",
    },
  });
