import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { getConfig } from './config/env';
import { connectDatabase } from './config/db';
import { rateLimit } from './middleware/rateLimit.middleware';
import authRoutes from './routes/auth.routes';
import memoryRoutes from './routes/memory.routes';
import sessionRoutes from './routes/session.routes';
import userRoutes from './routes/user.routes';
import wellnessRoutes from './routes/wellness.routes';
import { errorHandler } from './utils/errors';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './config/auth';

const app = express();
const config = getConfig();
const authHandler = toNodeHandler(auth);

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
app.use((req, res, next) => {
  console.log(`[request] method=${req.method} url=${req.url}`);
  next();
});
app.get('/api/auth/get-session', (req, res) => {
  if (!app.locals.dbReady) {
    res.status(200).json({ data: null });
    return;
  }

  authHandler(req, res);
});

app.all('/api/auth/*path', (req, res) => {
  if (!app.locals.dbReady) {
    res.status(200).json({ data: null });
    return;
  }

  authHandler(req, res);
});
app.use(express.json({ limit: '64kb' }));
app.use(rateLimit);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'aria-backend', timestamp: new Date().toISOString() });
});

app.use('/api/custom-auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/memory', memoryRoutes);
app.use('/api/user', userRoutes);
app.use('/api/wellness', wellnessRoutes);
app.use(errorHandler);

connectDatabase()
  .then(() => {
    app.locals.dbReady = true;
    app.listen(config.port, () => {
      console.log(`[server:start] port=${config.port}`);
    });
  })
  .catch((error) => {
    console.error('[server:db_connect_failed]', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'unknown'
    });
    app.listen(config.port, () => {
      console.log(`[server:start] port=${config.port} (degraded: database unavailable)`);
    });
  });
