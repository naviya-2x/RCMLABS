import { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/http.js';

type Claims = { sub: string; email: string; name: string; role: 'admin' | 'librarian' };
export const signToken = (claims: Claims) => jwt.sign(claims, env.jwtSecret, { expiresIn: '8h' });

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = req.cookies?.library_session || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined);
  if (!token) return next(new AppError(401, 'Please sign in to continue.', 'UNAUTHENTICATED'));
  try {
    const claims = jwt.verify(token, env.jwtSecret) as Claims;
    req.user = { id: claims.sub, email: claims.email, name: claims.name, role: claims.role };
    return next();
  } catch { return next(new AppError(401, 'Your session has expired. Please sign in again.', 'UNAUTHENTICATED')); }
};

export const requireRole = (...roles: Array<'admin' | 'librarian'>): RequestHandler => (_req: Request, _res: Response, next: NextFunction) => {
  if (!_req.user || !roles.includes(_req.user.role)) return next(new AppError(403, 'You do not have permission to perform this action.', 'FORBIDDEN'));
  next();
};
