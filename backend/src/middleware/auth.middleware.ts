import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/errors';
import { verifyToken } from '../utils/tokens';
import { UserModel } from '../models/User.model';

export interface AuthenticatedRequest extends Request {
  userId: string;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

  if (!token) {
    next(new ApiError(401, 'Authentication required'));
    return;
  }

  const payload = verifyToken(token, 'access');
  if (!payload) {
    next(new ApiError(401, 'Invalid or expired token'));
    return;
  }

  const user = await UserModel.findById(payload.userId).select('_id tokenVersion deletedAt');
  if (!user || user.deletedAt || user.tokenVersion !== payload.tokenVersion) {
    next(new ApiError(401, 'Invalid session'));
    return;
  }

  (req as AuthenticatedRequest).userId = payload.userId;
  next();
}
