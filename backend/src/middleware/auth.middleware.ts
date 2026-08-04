import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/errors';
import { auth } from '../config/auth';
import { importEsm } from '../utils/esm';
import { verifyToken } from '../utils/tokens';
import { UserModel } from '../models/User.model';

let fromNodeHeadersPromise: Promise<any> | null = null;
async function getFromNodeHeaders() {
  if (!fromNodeHeadersPromise) {
    const pkg = ['better-auth', 'node'].join('/');
    fromNodeHeadersPromise = importEsm(pkg).then(({ fromNodeHeaders }) => fromNodeHeaders);
  }
  return fromNodeHeadersPromise;
}

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
    const fromNodeHeadersFn = await getFromNodeHeaders();
    const session = await auth.api.getSession({
      headers: fromNodeHeadersFn(req.headers)
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
