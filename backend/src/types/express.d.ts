import 'express';

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      name: string;
      role: 'admin' | 'librarian';
    }
    interface Request {
      user?: User;
    }
  }
}
export {};
