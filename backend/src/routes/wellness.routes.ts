import { Router } from 'express';
import { Types } from 'mongoose';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.middleware';
import { rateLimitByUser } from '../middleware/rateLimit.middleware';
import { UserModel } from '../models/User.model';
import { WellnessActivityModel } from '../models/WellnessActivity.model';
import { ApiError, asyncHandler } from '../utils/errors';

const router = Router();

router.use(requireAuth);
router.use(rateLimitByUser);

router.get('/summary', asyncHandler(async (req, res) => {
  const userId = asObjectId((req as AuthenticatedRequest).userId);
  const [moods, journals, goals, messages, tools] = await Promise.all([
    WellnessActivityModel.find({ userId, type: 'mood' }).sort({ createdAt: -1 }).limit(14),
    WellnessActivityModel.find({ userId, type: 'journal' }).sort({ createdAt: -1 }).limit(5),
    WellnessActivityModel.find({ userId, type: 'goal' }).sort({ createdAt: -1 }).limit(10),
    WellnessActivityModel.find({ userId, type: 'message' }).sort({ createdAt: -1 }).limit(10),
    WellnessActivityModel.find({ userId, type: 'tool' }).sort({ createdAt: -1 }).limit(10)
  ]);

  res.json({
    moods: moods.reverse(),
    journals,
    goals,
    messages,
    tools,
    resources: getResources()
  });
}));

router.post('/mood', asyncHandler(async (req, res) => {
  const userId = asObjectId((req as AuthenticatedRequest).userId);
  const mood = Number(req.body.mood);
  const moodLabel = typeof req.body.moodLabel === 'string' ? req.body.moodLabel.trim() : '';

  if (!Number.isInteger(mood) || mood < 1 || mood > 10) {
    throw new ApiError(400, 'Mood must be a number from 1 to 10');
  }

  const activity = await WellnessActivityModel.create({
    userId,
    type: 'mood',
    mood,
    moodLabel,
    metadata: sanitizeMetadata(req.body.metadata)
  });

  await touchUser(userId);
  res.status(201).json({ mood: activity });
}));

router.get('/journal', asyncHandler(async (req, res) => {
  const userId = asObjectId((req as AuthenticatedRequest).userId);
  const entries = await WellnessActivityModel.find({ userId, type: 'journal' }).sort({ createdAt: -1 }).limit(30);
  res.json({ entries });
}));

router.post('/journal', asyncHandler(async (req, res) => {
  const userId = asObjectId((req as AuthenticatedRequest).userId);
  const title = stringOrDefault(req.body.title, 'Journal entry');
  const content = stringOrDefault(req.body.content);
  if (!content) throw new ApiError(400, 'Journal content is required');

  const entry = await WellnessActivityModel.create({ userId, type: 'journal', title, content });
  await touchUser(userId);
  res.status(201).json({ entry });
}));

router.get('/goals', asyncHandler(async (req, res) => {
  const userId = asObjectId((req as AuthenticatedRequest).userId);
  const goals = await WellnessActivityModel.find({ userId, type: 'goal' }).sort({ createdAt: -1 }).limit(50);
  res.json({ goals });
}));

router.post('/goals', asyncHandler(async (req, res) => {
  const userId = asObjectId((req as AuthenticatedRequest).userId);
  const title = stringOrDefault(req.body.title);
  if (!title) throw new ApiError(400, 'Goal title is required');

  const goal = await WellnessActivityModel.create({
    userId,
    type: 'goal',
    title,
    content: stringOrDefault(req.body.content),
    completed: false
  });
  await touchUser(userId);
  res.status(201).json({ goal });
}));

router.patch('/goals/:goalId', asyncHandler(async (req, res) => {
  const userId = asObjectId((req as AuthenticatedRequest).userId);
  if (!Types.ObjectId.isValid(String(req.params.goalId))) throw new ApiError(404, 'Goal not found');

  const goal = await WellnessActivityModel.findOneAndUpdate(
    { _id: req.params.goalId, userId, type: 'goal' },
    { completed: Boolean(req.body.completed) },
    { new: true }
  );
  if (!goal) throw new ApiError(404, 'Goal not found');
  res.json({ goal });
}));

router.post('/tools', asyncHandler(async (req, res) => {
  const userId = asObjectId((req as AuthenticatedRequest).userId);
  const tool = stringOrDefault(req.body.tool);
  if (!tool) throw new ApiError(400, 'Tool name is required');

  const activity = await WellnessActivityModel.create({
    userId,
    type: 'tool',
    tool,
    title: `${tool} opened`,
    metadata: sanitizeMetadata(req.body.metadata)
  });
  await touchUser(userId);
  res.status(201).json({ activity });
}));

router.get('/resources', asyncHandler(async (_req, res) => {
  res.json({ resources: getResources() });
}));

router.get('/messages', asyncHandler(async (req, res) => {
  const userId = asObjectId((req as AuthenticatedRequest).userId);
  const messages = await WellnessActivityModel.find({ userId, type: 'message' }).sort({ createdAt: -1 }).limit(30);
  res.json({ messages });
}));

router.post('/messages', asyncHandler(async (req, res) => {
  const userId = asObjectId((req as AuthenticatedRequest).userId);
  const content = stringOrDefault(req.body.content);
  if (!content) throw new ApiError(400, 'Message content is required');

  const message = await WellnessActivityModel.create({
    userId,
    type: 'message',
    title: stringOrDefault(req.body.title, 'Note to Aria'),
    content
  });
  await touchUser(userId);
  res.status(201).json({ message });
}));

router.patch('/settings', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const update: Record<string, unknown> = {};

  if (typeof req.body.preferredModality === 'string') update.preferredModality = req.body.preferredModality;
  if (typeof req.body.timezone === 'string') update.timezone = req.body.timezone;
  if (Object.keys(update).length === 0) throw new ApiError(400, 'No supported settings were provided');

  const user = await UserModel.findByIdAndUpdate(userId, { ...update, lastActiveAt: new Date() }, { new: true }).select('-tokenVersion');
  if (!user) throw new ApiError(404, 'User not found');

  await WellnessActivityModel.create({
    userId: asObjectId(userId),
    type: 'setting',
    title: 'Settings updated',
    metadata: update
  });

  res.json({ user });
}));

function asObjectId(userId: string) {
  return new Types.ObjectId(userId);
}

function stringOrDefault(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim().slice(0, 4_000) : fallback;
}

function sanitizeMetadata(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

async function touchUser(userId: Types.ObjectId) {
  await UserModel.findByIdAndUpdate(userId, { lastActiveAt: new Date() });
}

function getResources() {
  return [
    {
      title: '4-7-8 Breathing',
      category: 'Breathing',
      description: 'A short breathing rhythm for settling your body when things feel loud.'
    },
    {
      title: '5-4-3-2-1 Grounding',
      category: 'Grounding',
      description: 'Name five things you see, four you feel, three you hear, two you smell, and one you taste.'
    },
    {
      title: 'Tiny Next Step',
      category: 'Goals',
      description: 'Choose one action that takes less than five minutes and lowers the pressure by one notch.'
    },
    {
      title: 'Self-kindness Prompt',
      category: 'Journal',
      description: 'Write one sentence you would say to a close friend in the same situation.'
    }
  ];
}

export default router;
