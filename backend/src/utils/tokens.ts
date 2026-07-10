import crypto from 'crypto';
import { getConfig } from '../config/env';

export interface TokenPayload {
  userId: string;
  tokenVersion: number;
  exp: number;
  type: 'access' | 'refresh';
}

function base64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromBase64Url(input: string): string {
  const padded = input.padEnd(input.length + ((4 - (input.length % 4)) % 4), '=');
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

export function signToken(payload: TokenPayload): string {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64Url(JSON.stringify(payload));
  const signature = base64Url(
    crypto.createHmac('sha256', getConfig().authSecret).update(`${header}.${body}`).digest()
  );

  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string, type: TokenPayload['type']): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  const expected = base64Url(
    crypto.createHmac('sha256', getConfig().authSecret).update(`${header}.${body}`).digest()
  );

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  const payload = JSON.parse(fromBase64Url(body)) as TokenPayload;
  if (payload.type !== type || payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload;
}

export function createAccessToken(userId: string, tokenVersion: number): string {
  return signToken({
    userId,
    tokenVersion,
    type: 'access',
    exp: Math.floor(Date.now() / 1000) + 15 * 60
  });
}

export function createRefreshToken(userId: string, tokenVersion: number): string {
  return signToken({
    userId,
    tokenVersion,
    type: 'refresh',
    exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
  });
}
