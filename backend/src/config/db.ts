import mongoose from 'mongoose';
import { getConfig } from './env';

let connectionPromise: Promise<typeof mongoose> | null = null;

export function connectDatabase(): Promise<typeof mongoose> {
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(getConfig().mongoUri, {
      autoIndex: getConfig().nodeEnv !== 'production'
    });
  }

  return connectionPromise;
}
