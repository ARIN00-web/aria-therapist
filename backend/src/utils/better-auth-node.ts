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
  const headers = headersFromNode(req.headers);
  if ((method === 'POST' || method === 'PUT' || method === 'PATCH') && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const init: RequestInit = {
    method,
    headers
  };

  if (method !== 'GET' && method !== 'HEAD') {
    let bodyContent: BodyInit | undefined;

    // 1. If Vercel or upstream middleware already parsed the body into req.body
    if (req.body !== undefined && req.body !== null) {
      if (typeof req.body === 'string') {
        bodyContent = req.body;
      } else if (Buffer.isBuffer(req.body)) {
        bodyContent = req.body.toString('utf-8');
      } else {
        bodyContent = JSON.stringify(req.body);
      }
    } else {
      const contentLength = req.headers['content-length'];
      if (contentLength === '0' || (!contentLength && !req.headers['transfer-encoding'])) {
        bodyContent = '{}';
      } else {
        // Safely buffer the stream into a string to avoid Vercel duplex/premature-close issues
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          const buf = Buffer.concat(chunks);
          bodyContent = buf.length > 0 ? buf.toString('utf-8') : '{}';
        } catch (streamErr) {
          console.warn('[better-auth-node] Stream buffering error, falling back to empty object:', streamErr);
          bodyContent = '{}';
        }
      }
    }

    Object.assign(init, {
      body: bodyContent
    });
  }

  const response = await handler(new Request(url, init));
  res.status(response.status);

  // Set standard headers except set-cookie
  response.headers.forEach((value, name) => {
    if (name.toLowerCase() !== 'set-cookie') {
      res.setHeader(name, value);
    }
  });

  // Fetch Headers can hold multiple set-cookie values. Use getSetCookie() to avoid
  // overwriting or illegally joining them with commas.
  if (typeof response.headers.getSetCookie === 'function') {
    const cookies = response.headers.getSetCookie();
    if (cookies.length > 0) {
      res.setHeader('set-cookie', cookies);
    }
  } else {
    const cookie = response.headers.get('set-cookie');
    if (cookie) res.setHeader('set-cookie', cookie);
  }

  res.end(Buffer.from(await response.arrayBuffer()));
}

