import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import chatRouter from './routes/chat.route';
import authRouter from './routes/auth.route';
import connectDB from './database/connection.database';
import { detectCrisis } from './services/crisis.detector';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(authRouter);
app.use(chatRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Aria Therapist Backend is running' });
});




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
