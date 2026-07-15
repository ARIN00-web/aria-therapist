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

const app = express();
const config = getConfig();

app.use(helmet());
app.use(cors({
  origin: config.frontendOrigin,
  credentials: true
}));
app.use(express.json({ limit: '64kb' }));
app.use(rateLimit);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'aria-backend', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/memory', memoryRoutes);
app.use('/api/user', userRoutes);
app.use('/api/wellness', wellnessRoutes);
app.use(errorHandler);

connectDatabase()
  .then(() => {
    app.listen(config.port, () => {
      console.log(`[server:start] port=${config.port}`);
    });
  })
  .catch((error) => {
    console.error('[server:db_connect_failed]', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'unknown'
    });
    process.exit(1);
  });
