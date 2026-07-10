import { Router } from 'express';
import { Types } from 'mongoose';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.middleware';
import { SessionModel } from '../models/Session.model';
import { UserModel } from '../models/User.model';
import { buildTherapyContext } from '../services/context.builder';
import { CRISIS_RESPONSE, detectCrisis } from '../services/crisis.detector';
import { createSessionSummaryCard, updateLongTermMemory } from '../services/memory.service';
import { retrieveClinicalContext } from '../services/rag.retriever';
import { streamTherapyResponse } from '../services/llm.client';
import { updateRollingSummaryIfNeeded } from '../services/summarizer';
import { ApiError, asyncHandler } from '../utils/errors';

const router = Router();

router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const sessions = await SessionModel.find({ userId: new Types.ObjectId(userId), endedAt: { $exists: true } })
    .select('startedAt endedAt moodBefore moodAfter status summaryCard')
    .sort({ startedAt: -1 })
    .limit(30);

  res.json({ sessions });
}));

router.post('/', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const moodBefore = Number(req.body.moodBefore);
  if (!Number.isInteger(moodBefore) || moodBefore < 1 || moodBefore > 10) {
    throw new ApiError(400, 'Mood check-in must be a number from 1 to 10');
  }

  const session = await SessionModel.create({
    userId: new Types.ObjectId(userId),
    moodBefore,
    messages: [],
    status: 'active'
  });

  await UserModel.findByIdAndUpdate(userId, { lastActiveAt: new Date() });
  res.status(201).json({ session });
}));

router.get('/:sessionId', asyncHandler(async (req, res) => {
  const session = await findOwnedSession((req as AuthenticatedRequest).userId, String(req.params.sessionId));
  res.json({ session });
}));

router.post('/:sessionId/messages', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
  if (!message || message.length > 4_000) {
    throw new ApiError(400, 'Message is required and must be under 4,000 characters');
  }

  const session = await findOwnedSession(userId, String(req.params.sessionId));
  if (session.status !== 'active') throw new ApiError(409, 'This session is not active');

  const crisis = await detectCrisis(message);
  session.messages.push({ role: 'user', content: message, ts: new Date() });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');

  if (crisis.isCrisis) {
    session.status = 'paused_for_crisis';
    const crisisText = `${CRISIS_RESPONSE.message}\n${CRISIS_RESPONSE.resources?.map((resource) => `${resource.name}: ${resource.number}`).join('\n')}`;
    session.messages.push({ role: 'assistant', content: crisisText, ts: new Date() });
    await session.save();
    writeEvent(res, 'crisis', { ...crisis, content: crisisText });
    res.end();
    return;
  }

  await session.save();

  const chunks = await retrieveClinicalContext(message);
  const context = await buildTherapyContext(userId, String(session._id), chunks.map((chunk) => chunk.text));
  let assistantText = '';

  await streamTherapyResponse({
    system: context.systemPrompt,
    messages: [...context.messages, { role: 'user', content: message }],
    onText: (chunk) => {
      assistantText += chunk;
      writeEvent(res, 'token', { content: chunk });
    }
  });

  session.messages.push({ role: 'assistant', content: assistantText, ts: new Date() });
  await session.save();
  await updateRollingSummaryIfNeeded(session);
  await UserModel.findByIdAndUpdate(userId, { lastActiveAt: new Date() });
  writeEvent(res, 'done', { sessionId: String(session._id) });
  res.end();
}));

router.post('/:sessionId/end', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const moodAfter = Number(req.body.moodAfter);
  if (!Number.isInteger(moodAfter) || moodAfter < 1 || moodAfter > 10) {
    throw new ApiError(400, 'Mood check-out must be a number from 1 to 10');
  }

  const session = await findOwnedSession(userId, String(req.params.sessionId));
  session.moodAfter = moodAfter;
  session.endedAt = new Date();
  session.status = 'ended';
  session.summaryCard = await createSessionSummaryCard(session);
  await session.save();
  await updateLongTermMemory(userId, session);

  res.json({ session });
}));

async function findOwnedSession(userId: string, sessionId: string) {
  if (!Types.ObjectId.isValid(sessionId)) throw new ApiError(404, 'Session not found');
  const session = await SessionModel.findOne({ _id: sessionId, userId: new Types.ObjectId(userId) });
  if (!session) throw new ApiError(404, 'Session not found');
  return session;
}

function writeEvent(res: { write: (chunk: string) => void }, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export default router;
