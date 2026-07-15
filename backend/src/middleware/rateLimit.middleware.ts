import type { NextFunction, Request, Response } from 'express';
import { Redis } from '@upstash/redis';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

const buckets = new Map<string, number[]>();

let redisClient: Redis | null = null;
let checkedRedis = false;

function getRedisClient(): Redis | null {
  if (checkedRedis) return redisClient;
  checkedRedis = true;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn('[RateLimit] Upstash Redis credentials not configured. Using in-memory fallback.');
    return null;
  }

  try {
    redisClient = new Redis({ url, token });
    return redisClient;
  } catch (error) {
    console.error('[RateLimit] Failed to initialize Redis client:', error);
    return null;
  }
}

export async function rateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const redis = getRedisClient();
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userId = (req as any).userId || (req as any).user?.id;
  const key = userId ? `rate-limit:user:${userId}` : `rate-limit:ip:${ip}`;

  if (redis) {
    try {
      const requests = await redis.incr(key);

      if (requests === 1) {
        await redis.expire(key, WINDOW_MS / 1000);
      }

      if (requests > MAX_REQUESTS) {
        res.status(429).json({ error: 'Too many requests. Please slow down and try again.' });
        return;
      }

      next();
      return;
    } catch (error) {
      console.error('[RateLimit] Redis rate limit failed, falling back to in-memory:', error);
    }
  }

  const now = Date.now();
  const recent = (buckets.get(key) || []).filter((timestamp) => now - timestamp < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS) {
    res.status(429).json({ error: 'Too many requests. Please slow down and try again.' });
    return;
  }

  recent.push(now);
  buckets.set(key, recent);
  next();
}
