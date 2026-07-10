import type { NextFunction, Request, Response } from 'express';
<<<<<<< HEAD
import jwt, { type JwtPayload } from 'jsonwebtoken';

interface AuthTokenPayload extends JwtPayload {
  id?: string;
  email?: string;
  userId?: string;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication token missing or invalid' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    console.error('[Auth] JWT_SECRET is not configured');
    res.status(500).json({ error: 'Authentication is not configured' });
    return;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as AuthTokenPayload;
    const id = decoded.id ?? decoded.userId;

    if (!id) {
      res.status(401).json({ error: 'Authentication token missing user id' });
      return;
    }

    req.user = {
      ...decoded,
      id,
      email: decoded.email,
    };

    next();
  } catch (error) {
    console.error('[Auth] Token verification failed:', error);
    res.status(401).json({ error: 'Authentication token missing or invalid' });
  }
=======
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
>>>>>>> b406221 (feat: add user export route and memory management services)
}
