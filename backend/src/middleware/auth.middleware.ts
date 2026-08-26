import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/errors';
import { getAuth } from '../config/auth';
import { verifyToken } from '../utils/tokens';
import { UserModel } from '../models/User.model';
import { headersFromNode } from '../utils/better-auth-node';

export interface AuthenticatedRequest extends Request {
  userId: string;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    // 1. Try custom JWT Bearer token first
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const payload = verifyToken(token, 'access');
      if (payload) {
        const user = await UserModel.findById(payload.userId).select('tokenVersion deletedAt');
        if (user && !user.deletedAt && user.tokenVersion === payload.tokenVersion) {
          (req as AuthenticatedRequest).userId = payload.userId;
          next();
          return;
        }
      }
      next(new ApiError(401, 'Invalid or expired token'));
      return;
    }

    // 2. Fall back to better-auth session (OAuth / cookie-based)
    const auth = await getAuth();
    const session = await auth.api.getSession({
      headers: headersFromNode(req.headers)
    });

    if (!session?.user) {
      next(new ApiError(401, 'Authentication required'));
      return;
    }

    (req as AuthenticatedRequest).userId = session.user.id;
    next();
  } catch {
    next(new ApiError(401, 'Invalid session'));
  }
}
