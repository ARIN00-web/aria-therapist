import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { getConfig } from './config/env';
import { rateLimit } from './middleware/rateLimit.middleware';
import { importEsm } from './utils/esm';
import authRoutes from './routes/auth.routes';
import memoryRoutes from './routes/memory.routes';
import sessionRoutes from './routes/session.routes';
import userRoutes from './routes/user.routes';
import wellnessRoutes from './routes/wellness.routes';
import { errorHandler } from './utils/errors';
import { auth } from './config/auth';

const app = express();
const config = getConfig();

let authHandlerPromise: Promise<any> | null = null;
async function getAuthHandler() {
  if (!authHandlerPromise) {
    const pkg = ['better-auth', 'node'].join('/');
    authHandlerPromise = importEsm(pkg).then(({ toNodeHandler }) => toNodeHandler(auth));
  }
  return authHandlerPromise;
}

app.locals.dbReady = false;

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;

  if (config.frontendOrigins.includes(origin)) return true;

  return /^https?:\/\/(localhost|127(?:\.\d{1,3}){3}|0(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(:\d+)?$/i.test(origin);
}

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin not allowed: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
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
    const handler = await getAuthHandler();
    handler(req, res);
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
    const handler = await getAuthHandler();
    handler(req, res);
  } catch (error) {
    next(error);
  }
});
app.use(express.json({ limit: '64kb' }));
app.use(rateLimit);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'aria-backend', timestamp: new Date().toISOString() });
});

app.use('/api/custom-auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/memory', memoryRoutes);
app.use('/api/user', userRoutes);
app.use('/api/wellness', wellnessRoutes);
app.use(errorHandler);

export default app;
