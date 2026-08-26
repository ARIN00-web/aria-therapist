import type { IncomingHttpHeaders } from 'node:http';
import { Readable } from 'node:stream';
import type { Request, Response } from 'express';

/**
 * Converts Node request headers for Better Auth's Fetch-based APIs without
 * importing `better-auth/node`. That integration is ESM-only and Vercel
 * compiles this function as CommonJS.
 */
export function headersFromNode(headers: IncomingHttpHeaders): Headers {
  const result = new Headers();

  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    // Multiple Cookie headers are separated with semicolons; other headers use
    // the normal comma-separated HTTP representation.
    result.set(name, Array.isArray(value) ? value.join(name === 'cookie' ? '; ' : ', ') : value);
  }

  return result;
}

export async function serveBetterAuth(
  req: Request,
  res: Response,
  handler: (request: globalThis.Request) => Promise<globalThis.Response>
): Promise<void> {
  const protocol = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const url = `${protocol}://${host}${req.originalUrl || req.url}`;
  const method = req.method.toUpperCase();
  const init: RequestInit = {
    method,
    headers: headersFromNode(req.headers)
  };

  if (method !== 'GET' && method !== 'HEAD') {
    // Node's Fetch implementation requires `duplex: 'half'` when its body is
    // a stream. `duplex` is implemented by Node but is not in RequestInit's
    // TypeScript definition yet.
    Object.assign(init, {
      body: Readable.toWeb(req) as unknown as BodyInit,
      duplex: 'half'
    });
  }

  const response = await handler(new Request(url, init));
  res.status(response.status);
  response.headers.forEach((value, name) => res.setHeader(name, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}
