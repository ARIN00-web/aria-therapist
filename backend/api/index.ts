import type { Request, Response } from 'express';
import { connectDatabase } from '../src/config/db';

// Do not load the app at module initialization. `src/app` validates production
// configuration while loading, and an eager import turns a missing Vercel
// environment variable into an opaque "Function crashed" response. Loading it
// inside the handler lets us return a useful 503 response and log the actual
// configuration problem instead.
let appPromise: Promise<typeof import('../src/app')> | null = null;

function getApp() {
  if (!appPromise) appPromise = import('../src/app');
  return appPromise;
}

/** Vercel Function entry point. The Express app is reused without opening a port. */
export default async function handler(req: Request, res: Response): Promise<void> {
  try {
    const { default: app } = await getApp();
    await connectDatabase();
    app.locals.dbReady = true;
    app(req, res);
  } catch (error) {
    console.error('[server:db_connect_failed]', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'unknown'
    });
    res.status(503).json({
      error: 'Service configuration or database is unavailable. Check the Vercel function logs.'
    });
  }
}
