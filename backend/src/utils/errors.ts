import type { NextFunction, Request, Response } from 'express';

export class ApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}

export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  next: NextFunction
) {
  const statusCode = error instanceof ApiError ? error.statusCode : 500;
  const message = statusCode === 500 ? 'Something went wrong' : error.message;

  console.error('[api:error]', {
    statusCode,
    name: error.name,
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });

  // If a response has already begun (e.g. an SSE stream that failed mid-flight),
  // we can no longer set a status code or send a JSON body. Delegate to Express's
  // default handler, which will close the connection, and avoid throwing
  // ERR_HTTP_HEADERS_SENT here.
  if (res.headersSent) {
    next(error);
    return;
  }

  res.status(statusCode).json({ error: message });
}
