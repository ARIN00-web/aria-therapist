import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/errors';
import { auth } from '../config/auth';
import { fromNodeHeaders } from 'better-auth/node';

export interface AuthenticatedRequest extends Request {
  userId: string;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers)
    });

    if (!session || !session.user) {
      next(new ApiError(401, 'Authentication required'));
      return;
    }

    (req as AuthenticatedRequest).userId = session.user.id;
    next();
  } catch (error) {
    next(new ApiError(401, 'Invalid session'));
  }
}
