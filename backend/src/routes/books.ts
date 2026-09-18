import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError, asyncHandler, parseLimit, parsePage } from '../utils/http.js';
import { audit } from '../utils/audit.js';

const router = Router(); router.use(requireAuth);
const bookInput = z.object({ book_code: z.string().trim().min(2).max(40), isbn: z.string().trim().max(32).optional().nullable(), title: z.string().trim().min(1).max(250), publisher_id: z.string().uuid().optional().nullable(), publication_year: z.coerce.number().int().min(0).max(2200).optional().nullable(), language: z.string().max(60).default('English'), edition: z.string().max(80).optional().nullable(), description: z.string().max(5000).optional().nullable(), shelf_location: z.string().max(80).optional().nullable(), cover_image: z.string().url().optional().nullable(), category_id: z.string().uuid().optional().nullable(), author_ids: z.array(z.string().uuid()).default([]) });
const copyInput = z.object({ barcode: z.string().trim().min(2).max(80), copy_number: z.string().trim().min(1).max(40), notes: z.string().max(500).optional() });
const select = `b.id,b.book_code,b.isbn,b.title,b.publisher_id,b.publication_year,b.language,b.edition,b.description,b.shelf_location,b.cover_image,b.total_copies,b.available_copies,b.status,b.category_id,b.created_at,b.updated_at, p.name publisher_name, c.name category_name, COALESCE(string_agg(DISTINCT a.name, ', '), '') authors`;
const joins = `FROM books b LEFT JOIN publishers p ON p.id=b.publisher_id LEFT JOIN categories c ON c.id=b.category_id LEFT JOIN book_authors ba ON ba.book_id=b.id LEFT JOIN authors a ON a.id=ba.author_id`;

router.get('/', asyncHandler(async (req, res) => {
  const search = String(req.query.search || '').trim(); const page = parsePage(req.query.page); const limit = parseLimit(req.query.limit); const offset = (page - 1) * limit;
  const clauses = [`b.status='active'`]; const params: unknown[] = [];
  if (search) { params.push(`%${search}%`); clauses.push(`(b.title ILIKE $${params.length} OR b.isbn ILIKE $${params.length} OR b.book_code ILIKE $${params.length} OR EXISTS (SELECT 1 FROM book_copies sc WHERE sc.book_id=b.id AND sc.barcode ILIKE $${params.length}) OR EXISTS (SELECT 1 FROM book_authors sa JOIN authors sx ON sx.id=sa.author_id WHERE sa.book_id=b.id AND sx.name ILIKE $${params.length}))`); }
  if (req.query.category) { params.push(String(req.query.category)); clauses.push(`b.category_id=$${params.length}`); }
  if (req.query.availability === 'available') clauses.push('b.available_copies > 0');
  if (req.query.availability === 'borrowed') clauses.push('b.available_copies < b.total_copies');
  const where = `WHERE ${clauses.join(' AND ')}`; const count = await query<{count:string}>(`SELECT count(*) ${joins} ${where}`, params);
  const sortMap: Record<string,string> = { title: 'b.title', copies: 'b.total_copies', updated: 'b.updated_at' }; const sort = sortMap[String(req.query.sort)] || 'b.updated_at'; const direction = String(req.query.direction).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const result = await query(`${select} ${joins} ${where} GROUP BY b.id,p.name,c.name ORDER BY ${sort} ${direction} LIMIT $${params.length+1} OFFSET $${params.length+2}`, [...params, limit, offset]);
  res.json({ data: result.rows, meta: { page, limit, total: Number(count.rows[0].count), pages: Math.ceil(Number(count.rows[0].count)/limit) } });
}));
router.get('/copies/lookup', asyncHandler(async (req, res) => {
  const barcode = String(req.query.barcode || '').trim();
  if (!barcode) throw new AppError(400, 'Enter a barcode to search.', 'VALIDATION_ERROR');
  const result = await query(`SELECT c.*, b.title,b.book_code,b.id book_id FROM book_copies c JOIN books b ON b.id=c.book_id WHERE c.barcode=$1`, [barcode]);
  if (!result.rowCount) throw new AppError(404, 'No copy was found for that barcode.', 'NOT_FOUND');
  res.json({ data: result.rows[0] });
}));
router.get('/:id', asyncHandler(async (req, res) => {
  const book = await query(`${select} ${joins} WHERE b.id=$1 GROUP BY b.id,p.name,c.name`, [String(req.params.id)]); if (!book.rowCount) throw new AppError(404, 'Book not found.', 'NOT_FOUND');
  const copies = await query(`SELECT bc.*, l.id loan_id, l.due_date, m.full_name borrower_name FROM book_copies bc LEFT JOIN loans l ON l.copy_id=bc.id AND l.status='active' LEFT JOIN members m ON m.id=l.member_id WHERE bc.book_id=$1 ORDER BY bc.copy_number`, [String(req.params.id)]);
  res.json({ data: { ...book.rows[0], copies: copies.rows } });
}));
router.post('/', requireRole('admin','librarian'), asyncHandler(async (req, res) => {
  const data = bookInput.parse(req.body); const created = await withTransaction(async (client) => {
    const result = await client.query(`INSERT INTO books(book_code,isbn,title,publisher_id,publication_year,language,edition,description,shelf_location,cover_image,category_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`, [data.book_code,data.isbn||null,data.title,data.publisher_id||null,data.publication_year||null,data.language,data.edition||null,data.description||null,data.shelf_location||null,data.cover_image||null,data.category_id||null]);
    for (const author of data.author_ids) await client.query('INSERT INTO book_authors(book_id,author_id) VALUES($1,$2)', [result.rows[0].id, author]);
    await audit({ userId:req.user!.id, action:'created', entity:'book', entityId:result.rows[0].id, details:{title:data.title}, ip:req.ip }, client); return result.rows[0];
  });
  res.status(201).json({ data: created });
}));
router.put('/:id', requireRole('admin','librarian'), asyncHandler(async (req, res) => {
  const data = bookInput.partial().parse(req.body); const result = await withTransaction(async (client) => {
    const current = await client.query('SELECT id FROM books WHERE id=$1', [String(req.params.id)]); if (!current.rowCount) throw new AppError(404, 'Book not found.', 'NOT_FOUND');
    const keys: Array<[string,unknown]> = Object.entries(data).filter(([key]) => key !== 'author_ids') as Array<[string,unknown]>;
    if (keys.length) { const setters = keys.map(([key], i) => `${key}=$${i+1}`).join(','); await client.query(`UPDATE books SET ${setters}, updated_at=now() WHERE id=$${keys.length+1}`, [...keys.map(([,value]) => value ?? null), String(req.params.id)]); }
    if (data.author_ids) { await client.query('DELETE FROM book_authors WHERE book_id=$1', [String(req.params.id)]); for (const author of data.author_ids) await client.query('INSERT INTO book_authors(book_id,author_id) VALUES($1,$2)', [String(req.params.id),author]); }
    await audit({userId:req.user!.id,action:'updated',entity:'book',entityId:String(req.params.id),details:{title:data.title},ip:req.ip},client); return { id:String(req.params.id) };
  }); res.json({ data: result });
}));
router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => { const result = await query(`UPDATE books SET status='archived', updated_at=now() WHERE id=$1 AND status='active' RETURNING id`, [String(req.params.id)]); if (!result.rowCount) throw new AppError(404,'Active book not found.','NOT_FOUND'); await audit({userId:req.user!.id,action:'archived',entity:'book',entityId:String(req.params.id),ip:req.ip}); res.json({data:{success:true}}); }));
router.post('/:id/copies', requireRole('admin','librarian'), asyncHandler(async (req, res) => {
  const data = copyInput.parse(req.body); const result = await withTransaction(async (client) => { const copy = await client.query('INSERT INTO book_copies(book_id,barcode,copy_number,notes) VALUES($1,$2,$3,$4) RETURNING *',[String(req.params.id),data.barcode,data.copy_number,data.notes||null]); await client.query('UPDATE books SET total_copies=(SELECT count(*) FROM book_copies WHERE book_id=$1), available_copies=(SELECT count(*) FROM book_copies WHERE book_id=$1), updated_at=now() WHERE id=$1',[String(req.params.id)]); await audit({userId:req.user!.id,action:'created',entity:'book_copy',entityId:copy.rows[0].id,details:{barcode:data.barcode},ip:req.ip},client); return copy.rows[0]; }); res.status(201).json({data:result});
}));
router.patch('/:id/copies/:copyId', requireRole('admin','librarian'), asyncHandler(async (req, res) => { const data = z.object({status:z.enum(['available','lost','maintenance']),notes:z.string().max(500).optional()}).parse(req.body); const result = await query('UPDATE book_copies SET status=$1,notes=COALESCE($2,notes) WHERE id=$3 AND book_id=$4 AND NOT (status=\'borrowed\' AND $1<>\'borrowed\') RETURNING *',[data.status,data.notes||null,String(req.params.copyId),String(req.params.id)]); if(!result.rowCount) throw new AppError(400,'Copy not found or cannot change a borrowed copy.','INVALID_COPY'); await query('UPDATE books SET available_copies=(SELECT count(*) FROM book_copies WHERE book_id=$1 AND status=\'available\'),updated_at=now() WHERE id=$1',[String(req.params.id)]); res.json({data:result.rows[0]}); }));
export default router;
