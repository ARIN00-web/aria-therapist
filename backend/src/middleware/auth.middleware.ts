import type { NextFunction, Request, Response } from 'express';
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
}
