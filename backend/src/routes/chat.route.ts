import { Router } from 'express';
import { SessionModel } from '../models/Session.model';
import { MemoryModel } from '../models/Memory.model';
import { UserModel } from '../models/User.model';
import { buildContext } from '../services/context.builder';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();
const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

router.post('/api/chat', async (req, res) => {
    const { userId, sessionId, message } = req.body;

    if (!userId || !sessionId || !message) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        const [session, memory, user] = await Promise.all([
            SessionModel.findOne({ _id: sessionId, userId }),
            MemoryModel.findOne({ userId }),
            UserModel.findById(userId),
        ]);

        if (!session) return res.status(404).json({ error: 'Session not found' });
        if (!memory) return res.status(404).json({ error: 'Memory not found' });
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Build context and history BEFORE pushing new message
        const systemPrompt = await buildContext(session, memory, user);

        const history = session.messages.slice(-12).map(m => ({
            role: m.role,
            parts: [{ text: m.content }],
        }));

        // Now push and save user message
        session.messages.push({ role: 'user', content: message, ts: new Date() });
        await session.save();

        // Call Gemini
        const model = genai.getGenerativeModel({
            model: 'gemini-2.0-flash',
            systemInstruction: systemPrompt,
        });

        const chat = model.startChat({ history });
        const result = await chat.sendMessage(message);
        const reply = result.response.text();

        // Save assistant reply
        session.messages.push({ role: 'assistant', content: reply, ts: new Date() });
        await session.save();

        return res.json({ message: reply });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;