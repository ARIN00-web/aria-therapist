import type { Request, Response } from 'express';
import app from '../src/app';
import { connectDatabase } from '../src/config/db';

/** Vercel Function entry point. The Express app is reused without opening a port. */
export default async function handler(req: Request, res: Response): Promise<void> {
  try {
    await connectDatabase();
    app.locals.dbReady = true;
    app(req, res);
  } catch (error) {
    console.error('[server:db_connect_failed]', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'unknown'
    });
    res.status(503).json({ error: 'Database unavailable. Please try again shortly.' });
  }
}
