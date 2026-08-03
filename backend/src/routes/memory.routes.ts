import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.middleware';
import { rateLimitByUser } from '../middleware/rateLimit.middleware';
import { ensureMemory } from '../services/memory.service';
import { asyncHandler } from '../utils/errors';
import { decryptMemoryProfile } from '../models/Memory.model';

const router = Router();

router.use(requireAuth);
router.use(rateLimitByUser);

router.get('/', asyncHandler(async (req, res) => {
  const memory = await ensureMemory((req as AuthenticatedRequest).userId);
  res.json({
    memory: {
      ...memory.toObject(),
      profile: decryptMemoryProfile(memory.profile)
    }
  });
}));

export default router;
