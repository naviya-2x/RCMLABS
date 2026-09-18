import { Router } from 'express';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/http.js';

const router = Router(); router.use(requireAuth);
router.get('/', asyncHandler(async (_req, res) => {
  const [stats, recent, overdue] = await Promise.all([
    query<{total_books:string; available_books:string; borrowed_books:string; total_members:string; overdue_books:string; outstanding_fines:string}>(`SELECT (SELECT count(*) FROM books WHERE status='active') total_books, (SELECT coalesce(sum(available_copies),0) FROM books WHERE status='active') available_books, (SELECT count(*) FROM loans WHERE status='active') borrowed_books, (SELECT count(*) FROM members WHERE status='active') total_members, (SELECT count(*) FROM loans WHERE status='active' AND due_date < CURRENT_DATE) overdue_books, (SELECT coalesce(sum(amount-paid_amount),0) FROM fines WHERE status <> 'paid') outstanding_fines`),
    query(`SELECT l.id,l.issue_date,l.due_date,m.full_name member_name,b.title,c.barcode FROM loans l JOIN members m ON m.id=l.member_id JOIN book_copies c ON c.id=l.copy_id JOIN books b ON b.id=c.book_id ORDER BY l.created_at DESC LIMIT 6`),
    query(`SELECT l.id,l.due_date,m.full_name member_name,b.title,c.barcode, GREATEST(CURRENT_DATE-l.due_date,0) days_overdue FROM loans l JOIN members m ON m.id=l.member_id JOIN book_copies c ON c.id=l.copy_id JOIN books b ON b.id=c.book_id WHERE l.status='active' AND l.due_date < CURRENT_DATE ORDER BY l.due_date ASC LIMIT 6`),
  ]);
  res.json({ data: { stats: stats.rows[0], recent: recent.rows, overdue: overdue.rows } });
}));
export default router;
