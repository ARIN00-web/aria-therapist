import { Router } from 'express';
import { Types } from 'mongoose';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.middleware';
import { rateLimitByUser } from '../middleware/rateLimit.middleware';
import { SessionModel } from '../models/Session.model';
import { UserModel } from '../models/User.model';
import { ensureMemory } from '../services/memory.service';
import { asyncHandler } from '../utils/errors';

const router = Router();

router.use(requireAuth);
router.use(rateLimitByUser);

router.get('/export', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const [user, sessions, memory] = await Promise.all([
    UserModel.findById(userId).select('-tokenVersion'),
    SessionModel.find({ userId: new Types.ObjectId(userId) }).sort({ startedAt: -1 }),
    ensureMemory(userId)
  ]);

  res.json({ user, sessions, memory });
}));

export default router;
