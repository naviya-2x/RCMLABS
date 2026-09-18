import { Router } from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError, asyncHandler } from '../utils/http.js';
import { audit } from '../utils/audit.js';

const router = Router(); router.use(requireAuth);
const catalogSchema = z.object({ name: z.string().trim().min(1).max(120), description: z.string().max(500).optional() });
const safeTable = (type: string) => ({ authors: 'authors', categories: 'categories', publishers: 'publishers' } as Record<string,string>)[type] || (() => { throw new AppError(400, 'Unknown catalog type.', 'INVALID_CATALOG_TYPE'); })();
router.get('/:type', asyncHandler(async (req, res) => { const table = safeTable(String(req.params.type)); const result = await query(`SELECT * FROM ${table} ORDER BY name`); res.json({ data: result.rows }); }));
router.post('/:type', requireRole('admin','librarian'), asyncHandler(async (req, res) => { const table = safeTable(String(req.params.type)); const data = catalogSchema.parse(req.body); const result = await query(`INSERT INTO ${table}(name, description) VALUES ($1,$2) RETURNING *`, [data.name, data.description || null]); await audit({ userId: req.user!.id, action: 'created', entity: String(req.params.type).slice(0,-1), entityId: result.rows[0].id, details: data, ip: req.ip }); res.status(201).json({ data: result.rows[0] }); }));
router.delete('/:type/:id', requireRole('admin'), asyncHandler(async (req, res) => { const table = safeTable(String(req.params.type)); const result = await query(`DELETE FROM ${table} WHERE id=$1 RETURNING id`, [String(req.params.id)]); if (!result.rowCount) throw new AppError(404, 'Catalog item not found.', 'NOT_FOUND'); res.json({ data: { success: true } }); }));
export default router;
