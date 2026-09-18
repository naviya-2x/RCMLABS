import { Router } from 'express';
import { query } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler, parseLimit, parsePage } from '../utils/http.js';
const router=Router();router.use(requireAuth,requireRole('admin'));
router.get('/',asyncHandler(async(req,res)=>{const page=parsePage(req.query.page);const limit=parseLimit(req.query.limit);const result=await query(`SELECT a.*,u.name user_name,u.email user_email FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT $1 OFFSET $2`,[limit,(page-1)*limit]);const count=await query<{count:string}>('SELECT count(*) FROM audit_logs');res.json({data:result.rows,meta:{page,limit,total:Number(count.rows[0].count)}});}));
export default router;
