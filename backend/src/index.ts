import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
<<<<<<< HEAD
import dotenv from 'dotenv';
import chatRouter from './routes/chat.route';
import authRouter from './routes/auth.route';
import connectDB from './database/connection.database';
import { detectCrisis } from './services/crisis.detector';

dotenv.config();
=======

import { getConfig } from './config/env';
import { connectDatabase } from './config/db';
import { rateLimit } from './middleware/rateLimit.middleware';
import authRoutes from './routes/auth.routes';
import memoryRoutes from './routes/memory.routes';
import sessionRoutes from './routes/session.routes';
import userRoutes from './routes/user.routes';
import { errorHandler } from './utils/errors';
>>>>>>> b406221 (feat: add user export route and memory management services)

const app = express();
const config = getConfig();

app.use(helmet());
<<<<<<< HEAD
app.use(cors());
app.use(express.json());
app.use(authRouter);
app.use(chatRouter);
=======
app.use(cors({
  origin: config.frontendOrigin,
  credentials: true
}));
app.use(express.json({ limit: '64kb' }));
app.use(rateLimit);

>>>>>>> b406221 (feat: add user export route and memory management services)

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'aria-backend', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/memory', memoryRoutes);
app.use('/api/user', userRoutes);
app.use(errorHandler);

<<<<<<< HEAD


app.post('/test-crisis', async (req, res): Promise<void> => {
  try {
    const { message } = req.body;
    
    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }
    const result = await detectCrisis(message);
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    res.status(500).json({ error: errorMessage });
  }
});


(async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[server]: Server is running at http://localhost:${PORT}`);
  });
})();
=======
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
>>>>>>> b406221 (feat: add user export route and memory management services)
