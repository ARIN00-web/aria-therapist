import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.middleware';
import { ensureMemory } from '../services/memory.service';
import { asyncHandler } from '../utils/errors';

const router = Router();

router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const memory = await ensureMemory((req as AuthenticatedRequest).userId);
  res.json({ memory });
}));

export default router;
