import type { JwtPayload } from 'jsonwebtoken';

declare global {
  namespace Express {
    interface User extends JwtPayload {
      id: string;
      email?: string;
    }

    interface Request {
      user?: User;
    }
  }
}

export {};
