import type { NextFunction, Request, Response } from 'express';
import { Redis } from '@upstash/redis';
import type { AuthenticatedRequest } from './auth.middleware';

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

/**
 * Enforces a fixed-window request limit for the given bucket key. Uses Upstash
 * Redis when configured (shared across instances) and falls back to an
 * in-memory sliding window otherwise. Returns true if the request is allowed.
 */
async function consume(key: string): Promise<boolean> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const requests = await redis.incr(key);
      if (requests === 1) {
        await redis.expire(key, WINDOW_MS / 1000);
      }
      return requests <= MAX_REQUESTS;
    } catch (error) {
      console.error('[RateLimit] Redis rate limit failed, falling back to in-memory:', error);
    }
  }

  const now = Date.now();
  const recent = (buckets.get(key) || []).filter((timestamp) => now - timestamp < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) {
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);
  return true;
}

function tooMany(res: Response): void {
  res.status(429).json({ error: 'Too many requests. Please slow down and try again.' });
}

/**
 * IP-based rate limiter mounted globally. This runs before authentication, so
 * it protects the unauthenticated surface (login, onboarding, token refresh)
 * against abuse. Authenticated routes additionally apply {@link rateLimitByUser}
 * so a per-account limit is enforced regardless of source IP.
 */
export async function rateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (await consume(`rate-limit:ip:${ip}`)) {
    next();
    return;
  }
  tooMany(res);
}

/**
 * Per-user rate limiter for authenticated routes. Must be mounted AFTER
 * requireAuth so that req.userId is populated; otherwise it falls back to IP.
 */
export async function rateLimitByUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = (req as AuthenticatedRequest).userId;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const key = userId ? `rate-limit:user:${userId}` : `rate-limit:ip:${ip}`;
  if (await consume(key)) {
    next();
    return;
  }
  tooMany(res);
}
