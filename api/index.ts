import { app } from '../backend/src/app.js';

// Vercel may pass the path with or without the /api prefix depending on the
// rewrite. Keep the Express router stable in both local and serverless modes.
export default function handler(req: any, res: any) {
  if (typeof req.url === 'string' && !req.url.startsWith('/api')) {
    req.url = `/api${req.url === '/' ? '' : req.url}`;
  }
  return app(req, res);
}
