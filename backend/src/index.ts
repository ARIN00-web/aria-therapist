import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { detectCrisis } from './services/crisis.detector';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(helmet());
app.use(cors());
app.use(express.json());


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
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'An error occurred' });
  }
});
app.listen(PORT, () => {
  console.log(`[server]: Server is running at http://localhost:${PORT}`);
});