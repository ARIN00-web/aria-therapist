import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { getConfig, validateAndLogStartupConfig } from './config/env';
import { rateLimit } from './middleware/rateLimit.middleware';
import authRoutes from './routes/auth.routes';
import memoryRoutes from './routes/memory.routes';
import sessionRoutes from './routes/session.routes';
import userRoutes from './routes/user.routes';
import wellnessRoutes from './routes/wellness.routes';
import { errorHandler } from './utils/errors';
import { getAuth } from './config/auth';
import { serveBetterAuth } from './utils/better-auth-node';
import { withTimeout } from './utils/withTimeout';

validateAndLogStartupConfig();

const app = express();
const config = getConfig();

app.locals.dbReady = false;

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;

  const normalized = origin.replace(/\/$/, '');
  if (config.frontendOrigins.includes(normalized)) return true;

  // In local development only, allow localhost and LAN IPs
  if (config.nodeEnv !== 'production' && !process.env.VERCEL) {
    return /^https?:\/\/(localhost|127(?:\.\d{1,3}){3}|0(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(:\d+)?$/i.test(origin);
  }

  return false;
}

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    // Fail CORS preflight gracefully without crashing Express with a 500 error
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS']
}));
app.use((req, _res, next) => {
  console.log(`[request] method=${req.method} url=${req.url}`);
  next();
});
app.get('/api/auth/get-session', async (req, res, next) => {
  if (!app.locals.dbReady) {
    res.status(200).json({ data: null });
    return;
  }

  try {
    const auth = await getAuth();
    await serveBetterAuth(req, res, auth.handler);
  } catch (error) {
    next(error);
  }
});

app.all('/api/auth/*path', async (req, res, next) => {
  if (!app.locals.dbReady) {
    res.status(503).json({
      error: 'Database unavailable. Start MongoDB before signing in.'
    });
    return;
  }

  try {
    const auth = await getAuth();
    await serveBetterAuth(req, res, auth.handler);
  } catch (error) {
    next(error);
  }
});
app.use(express.json({ limit: '64kb' }));
app.use(rateLimit);

app.get('/health', (_req, res) => {
  const databaseReady = Boolean(app.locals.dbReady);
  res.status(databaseReady ? 200 : 503).json({
    status: databaseReady ? 'ok' : 'degraded',
    service: 'aria-backend',
    database: databaseReady ? 'connected' : 'unavailable',
    rag: config.qdrantUrl ? 'configured' : 'not_configured',
    timestamp: new Date().toISOString()
  });
});

// A safe, dependency-specific check for the deployment runbook. It confirms
// the configured backend can reach the collection without exposing the Qdrant
// URL, API key, or any stored content.
app.get('/health/qdrant', async (_req, res) => {
  if (!config.qdrantUrl) {
    res.status(503).json({ status: 'unavailable', error: 'QDRANT_URL is not configured' });
    return;
  }

  try {
    const response = await withTimeout(
      fetch(`${config.qdrantUrl.replace(/\/$/, '')}/collections/${encodeURIComponent(config.qdrantCollection)}`, {
        headers: config.qdrantApiKey ? { 'api-key': config.qdrantApiKey } : {}
      }),
      8_000,
      'Qdrant health check'
    );

    if (!response.ok) {
      console.warn('[health:qdrant_unavailable]', { status: response.status });
      res.status(503).json({ status: 'unavailable', error: `Qdrant returned HTTP ${response.status}` });
      return;
    }

    const body = await response.json() as { result?: { points_count?: number } };
    res.json({
      status: 'ok',
      collection: config.qdrantCollection,
      pointsCount: body.result?.points_count ?? null
    });
  } catch (error) {
    console.warn('[health:qdrant_unavailable]', {
      error: error instanceof Error ? error.message : 'unknown'
    });
    res.status(503).json({ status: 'unavailable', error: 'Backend could not reach Qdrant' });
  }
});

app.use('/api/custom-auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/memory', memoryRoutes);
app.use('/api/user', userRoutes);
app.use('/api/wellness', wellnessRoutes);
app.use(errorHandler);

export default app;
