import { Router } from 'express';
import mongoose from 'mongoose';
import { SessionModel } from '../models/Session.model';
import { MemoryModel } from '../models/Memory.model';
import { UserModel } from '../models/User.model';
import { buildContext } from '../services/context.builder';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authMiddleware } from '../middleware/auth.middleware';
import { rateLimitMiddleware } from '../middleware/rateLimit.middleware';
import { summarizeSessionIfNeeded } from '../services/summarizer';
import { detectCrisis } from '../services/crisis.detector';
import { withTimeout } from '../utils/withTimeout';

const router = Router();
const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

router.post('/api/chat', authMiddleware, rateLimitMiddleware, async (req, res) => {
    const { userId, sessionId, message } = req.body;

    if (!userId || !sessionId || !message) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    if (req.user?.id !== userId) {
        return res.status(403).json({ error: 'Authenticated user does not match request userId' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(sessionId)) {
        return res.status(400).json({ error: 'Invalid userId or sessionId' });
    }

    try {
        console.log('[Chat] Request validated, casting ids');
        const userObjectId = new mongoose.Types.ObjectId(userId);
        const sessionObjectId = new mongoose.Types.ObjectId(sessionId);
        console.log('[Chat] Fetching session, memory, and user');
        const [session, memory, user] = await Promise.all([
            SessionModel.findById(sessionObjectId),
            MemoryModel.findOne({ userId: userObjectId } as never),
            UserModel.findById(userObjectId),
        ]);
        console.log('[Chat] DB fetch complete');

        if (!session) return res.status(404).json({ error: 'Session not found' });
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (session.userId.toString() !== userObjectId.toHexString()) {
            return res.status(404).json({ error: 'Session not found' });
        }

        console.log(`[Chat] Running crisis detection for session ${sessionId}`);
        const crisisResult = await detectCrisis(message);
        if (crisisResult.isCrisis) {
            console.warn(`[Chat] Crisis message detected for session ${sessionId}`);
            session.messages.push({ role: 'user', content: message, ts: new Date() });
            if (crisisResult.message) {
                session.messages.push({ role: 'assistant', content: crisisResult.message, ts: new Date() });
            }
            await session.save();
            return res.status(200).json(crisisResult);
        }

        console.log('[Chat] Building history from last 12 messages');
        const history = session.messages.slice(-12).map((m) => ({
            role: m.role,
            parts: [{ text: m.content }],
        }));

        console.log('[Chat] Saving user message');
        session.messages.push({ role: 'user', content: message, ts: new Date() });
        await session.save();

        console.log('[Chat] Building context');
        const systemPrompt = await buildContext(session, memory, user);
        console.log('[Chat] Context built');

        if (!process.env.GEMINI_API_KEY) {
            console.error('[Chat] GEMINI_API_KEY is not configured');
            return res.status(500).json({ error: 'LLM service is not configured' });
        }

        console.log('[Chat] Initializing Gemini model');
        const model = genai.getGenerativeModel({
            model: 'gemini-2.0-flash',
            systemInstruction: systemPrompt,
        });

        console.log('[Chat] Sending message to Gemini');
        const chat = model.startChat({ history });
        const result = await withTimeout(
            chat.sendMessage(message),
            15000,
            'Therapy chat response'
        );
        const reply = result.response.text();
        console.log('[Chat] Gemini response received');

        console.log('[Chat] Saving assistant reply');
        session.messages.push({ role: 'assistant', content: reply, ts: new Date() });
        await session.save();
        console.log('[Chat] Assistant reply saved');

        void summarizeSessionIfNeeded(session._id.toString());
        console.log('[Chat] Summarizer triggered asynchronously');

        return res.json({ message: reply });

    } catch (error) {
        console.error('[Chat] Route failed:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
