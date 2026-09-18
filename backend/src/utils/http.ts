import { RequestHandler } from 'express';

export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, message: string, code = 'APP_ERROR', details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const asyncHandler = (handler: RequestHandler): RequestHandler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
export const parsePage = (value: unknown, fallback = 1) => Math.max(1, Number(value) || fallback);
export const parseLimit = (value: unknown, fallback = 20) => Math.min(100, Math.max(1, Number(value) || fallback));
