import { Router } from 'express';
import type { Response } from 'express';
import { Types } from 'mongoose';
import { getConfig } from '../config/env';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.middleware';
import { MemoryModel } from '../models/Memory.model';
import { SessionModel } from '../models/Session.model';
import { UserModel } from '../models/User.model';
import { WellnessActivityModel } from '../models/WellnessActivity.model';
import { ApiError, asyncHandler } from '../utils/errors';
import { createAccessToken, createRefreshToken, verifyToken } from '../utils/tokens';

const router = Router();

router.post('/onboarding', asyncHandler(async (req, res) => {
  const { name, email, preferredModality, timezone, onboardingAnswers, consentAccepted } = req.body;

  if (!consentAccepted) throw new ApiError(400, 'Consent is required before starting a session');
  if (!isNonEmptyString(name) || !isNonEmptyString(email)) throw new ApiError(400, 'Name and email are required');

  const user = await UserModel.findOneAndUpdate(
    { email: email.toLowerCase().trim() },
    {
      $set: {
        name: name.trim(),
        preferredModality: preferredModality || 'CBT',
        timezone: timezone || 'UTC',
        onboardingAnswers: onboardingAnswers || {},
        consentAcceptedAt: new Date(),
        lastActiveAt: new Date(),
        deletedAt: undefined
      }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  await MemoryModel.findOneAndUpdate(
    { userId: user._id },
    {
      $setOnInsert: {
        profile: {
          recurringThemes: [],
          keyPeople: [],
          triggers: [],
          copingStrategies: [],
          progressNotes: [],
          moodTrend: '',
          followUpTopics: []
        },
        lastUpdated: new Date()
      }
    },
    { upsert: true }
  );

  sendAuthResponse(res, user.id, user.tokenVersion);
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const token = parseCookie(req.headers.cookie || '').refreshToken;
  const payload = token ? verifyToken(token, 'refresh') : null;
  if (!payload) throw new ApiError(401, 'Refresh session expired');

  const user = await UserModel.findById(payload.userId);
  if (!user || user.deletedAt || user.tokenVersion !== payload.tokenVersion) {
    throw new ApiError(401, 'Invalid refresh session');
  }

  user.tokenVersion += 1;
  user.lastActiveAt = new Date();
  await user.save();

  sendAuthResponse(res, user.id, user.tokenVersion);
}));

router.post('/logout', asyncHandler(async (req, res) => {
  res.clearCookie('refreshToken');
  res.status(200).json({ success: true });
}));

router.post('/complete-onboarding-oauth', requireAuth, asyncHandler(async (req, res) => {
  const { preferredModality, onboardingAnswers } = req.body;
  const userId = (req as AuthenticatedRequest).userId;

  const user = await UserModel.findByIdAndUpdate(
    userId,
    {
      $set: {
        preferredModality: preferredModality || 'CBT',
        onboardingAnswers: onboardingAnswers || {},
        consentAcceptedAt: new Date(),
        lastActiveAt: new Date(),
      }
    },
    { new: true }
  );

  if (!user) throw new ApiError(404, 'User not found');

  await MemoryModel.findOneAndUpdate(
    { userId: user._id },
    {
      $setOnInsert: {
        profile: {
          recurringThemes: [],
          keyPeople: [],
          triggers: [],
          copingStrategies: [],
          progressNotes: [],
          moodTrend: '',
          followUpTopics: []
        },
        lastUpdated: new Date()
      }
    },
    { upsert: true }
  );

  res.json({ success: true, user });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await UserModel.findById((req as AuthenticatedRequest).userId).select('-tokenVersion');
  if (!user) throw new ApiError(404, 'User not found');
  res.json({ user });
}));

router.delete('/me', requireAuth, asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  await Promise.all([
    UserModel.findByIdAndUpdate(userId, { deletedAt: new Date(), tokenVersion: Date.now() }),
    SessionModel.deleteMany({ userId: new Types.ObjectId(userId) }),
    MemoryModel.deleteMany({ userId: new Types.ObjectId(userId) }),
    WellnessActivityModel.deleteMany({ userId: new Types.ObjectId(userId) })
  ]);

  res.clearCookie('refreshToken');
  res.status(204).send();
}));

function sendAuthResponse(res: Response, userId: string, tokenVersion: number) {
  const config = getConfig();
  const accessToken = createAccessToken(userId, tokenVersion);
  const refreshToken = createRefreshToken(userId, tokenVersion);

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    // The frontend and API are separate Vercel deployments in production.
    // Cross-site requests must therefore opt in to sending the refresh cookie.
    sameSite: config.nodeEnv === 'production' ? 'none' : 'strict',
    secure: config.nodeEnv === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000
  });

  res.json({ accessToken });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseCookie(cookieHeader: string): Record<string, string> {
  return cookieHeader.split(';').reduce<Record<string, string>>((cookies, part) => {
    const [key, ...value] = part.trim().split('=');
    if (key) cookies[key] = decodeURIComponent(value.join('='));
    return cookies;
  }, {});
}

export default router;
