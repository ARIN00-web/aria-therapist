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
  _next: NextFunction
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

  res.status(statusCode).json({ error: message });
}
