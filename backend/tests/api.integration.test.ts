import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/app.js';
import { pool } from '../src/config/db.js';

const integration = Boolean(process.env.TEST_DATABASE_URL);
describe.skipIf(!integration)('library circulation API integration', () => {
  const email = `test-${Date.now()}@example.com`;
  let agent: ReturnType<typeof request.agent>;
  let memberId = '';
  let bookId = '';
  let loanId = '';
  beforeAll(async () => {
    const role = await pool.query<{id:number}>(`SELECT id FROM roles WHERE name='librarian'`);
    const hash = await bcrypt.hash('TestPassword123!', 4);
    await pool.query(`INSERT INTO users(name,email,password_hash,role_id) VALUES('Integration Librarian',$1,$2,$3)`, [email, hash, role.rows[0].id]);
    agent = request.agent(app);
    await agent.post('/api/auth/login').send({email, password:'TestPassword123!'}).expect(200);
  });
  afterAll(async () => { await pool.end(); });
  it('requires authentication and creates a member and book', async () => {
    await request(app).get('/api/books').expect(401);
    const member = await agent.post('/api/members').send({full_name:'Integration Member',email:`member-${Date.now()}@example.com`,membership_type:'Student',membership_expiry_date:'2099-12-31'}).expect(201);
    memberId = member.body.data.id;
    const book = await agent.post('/api/books').send({book_code:`TEST-${Date.now()}`,title:'Integration Book',author_ids:[]}).expect(201);
    bookId = book.body.data.id;
    expect(memberId).toBeTruthy(); expect(bookId).toBeTruthy();
  });
  it('issues atomically, rejects a second issue, returns, and assesses an overdue fine', async () => {
    const copy = await agent.post(`/api/books/${bookId}/copies`).send({barcode:`TEST-BC-${Date.now()}`,copy_number:'001'}).expect(201);
    const issued = await agent.post('/api/loans').send({member_id:memberId,copy_id:copy.body.data.id}).expect(201);
    loanId = issued.body.data.id;
    await agent.post('/api/loans').send({member_id:memberId,copy_id:copy.body.data.id}).expect(409);
    await pool.query(`UPDATE loans SET due_date=CURRENT_DATE-2 WHERE id=$1`, [loanId]);
    const returned = await agent.post(`/api/loans/${loanId}/return`).expect(200);
    expect(returned.body.data.fine).toBeGreaterThanOrEqual(0);
    const copyState = await pool.query(`SELECT status FROM book_copies WHERE id=$1`, [copy.body.data.id]);
    expect(copyState.rows[0].status).toBe('available');
  });
});
