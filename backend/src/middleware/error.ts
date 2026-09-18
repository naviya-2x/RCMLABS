import { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/http.js';

export const notFound: RequestHandler = (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested resource was not found.' } });
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof ZodError) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Please check the submitted fields.', details: error.flatten() } });
  const appError = error instanceof AppError ? error : null;
  const status = appError?.status || 500;
  if (status >= 500) console.error(JSON.stringify({ level: 'error', msg: error?.message, stack: error?.stack, path: req.path }));
  return res.status(status).json({ error: { code: appError?.code || 'INTERNAL_ERROR', message: status >= 500 ? 'An unexpected server error occurred.' : appError!.message, details: appError?.details } });
};
