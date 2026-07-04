import type { NextFunction, Request, Response } from 'express';
import { Redis } from '@upstash/redis';

const RATE_LIMIT = 20;
const WINDOW_SECONDS = 60;

let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redisClient) {
    return redisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn('[RateLimit] Upstash Redis credentials are not configured. Skipping rate limiting.');
    return null;
  }

  redisClient = new Redis({ url, token });
  return redisClient;
}

export async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'Authenticated user not found for rate limiting' });
    return;
  }

  const redis = getRedisClient();
  if (!redis) {
    next();
    return;
  }

  const key = `rate-limit:${userId}`;

  try {
    const requests = await redis.incr(key);

    if (requests === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    }

    if (requests > RATE_LIMIT) {
      res.status(429).json({ error: 'Rate limit exceeded. Please try again in a minute.' });
      return;
    }

    next();
  } catch (error) {
    console.error('[RateLimit] Failed to enforce rate limit:', error);
    next();
  }
}
