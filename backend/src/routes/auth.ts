import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../config/db.js';
import { env } from '../config/env.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { AppError, asyncHandler } from '../utils/http.js';
import { audit } from '../utils/audit.js';

const router = Router();
const credentials = z.object({ email: z.string().email(), password: z.string().min(8) });
const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure: env.cookieSecure, maxAge: 8 * 60 * 60 * 1000, path: '/' };

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = credentials.parse(req.body);
  const result = await query<{id:string; email:string; name:string; password_hash:string; role:'admin'|'librarian'; is_active:boolean}>('SELECT u.id,u.email,u.name,u.password_hash,u.is_active,r.name as role FROM users u JOIN roles r ON r.id=u.role_id WHERE lower(u.email)=lower($1)', [email]);
  const user = result.rows[0];
  if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) throw new AppError(401, 'Email or password is incorrect.', 'INVALID_CREDENTIALS');
  await query('UPDATE users SET last_login_at=now() WHERE id=$1', [user.id]);
  await audit({ userId: user.id, action: 'login', entity: 'user', entityId: user.id, ip: req.ip });
  res.cookie('library_session', signToken({ sub: user.id, email: user.email, name: user.name, role: user.role }), cookieOptions);
  res.json({ data: { id: user.id, email: user.email, name: user.name, role: user.role } });
}));
router.post('/logout', asyncHandler(async (_req, res) => { res.clearCookie('library_session', { httpOnly: true, sameSite: 'lax', secure: env.cookieSecure, path: '/' }); res.json({ data: { success: true } }); }));
router.get('/me', requireAuth, asyncHandler(async (req, res) => res.json({ data: req.user })));

export default router;
