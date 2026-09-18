import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';

const client = await pool.connect();
try {
  await client.query('BEGIN');
  const adminRole = (await client.query<{id:number}>('SELECT id FROM roles WHERE name=$1', ['admin'])).rows[0].id;
  const librarianRole = (await client.query<{id:number}>('SELECT id FROM roles WHERE name=$1', ['librarian'])).rows[0].id;
  const adminHash = await bcrypt.hash('Admin123!', 12);
  const librarianHash = await bcrypt.hash('Librarian123!', 12);
  await client.query(`INSERT INTO users(name,email,password_hash,role_id) VALUES ('Library Administrator','admin@example.com',$1,$2),('Main Librarian','librarian@example.com',$3,$4) ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash, role_id=EXCLUDED.role_id, is_active=true`, [adminHash, adminRole, librarianHash, librarianRole]);
  const cat = await client.query<{id:string}>('INSERT INTO categories(name,description) VALUES ($1,$2) ON CONFLICT(name) DO UPDATE SET description=EXCLUDED.description RETURNING id', ['Fiction','Stories and novels']);
  const author = await client.query<{id:string}>('INSERT INTO authors(name) VALUES ($1) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id', ['J. K. Rowling']);
  const publisher = await client.query<{id:string}>('INSERT INTO publishers(name) VALUES ($1) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id', ['Bloomsbury']);
  const member = await client.query<{id:string}>('INSERT INTO members(member_code,full_name,email,phone,membership_type,membership_expiry_date) VALUES ($1,$2,$3,$4,$5,CURRENT_DATE + INTERVAL \'1 year\') ON CONFLICT(member_code) DO UPDATE SET full_name=EXCLUDED.full_name RETURNING id', ['MEM-00001','Avery Morgan','avery@example.com','+1 555 0142','Student']);
  const book = await client.query<{id:string}>('INSERT INTO books(book_code,isbn,title,publisher_id,publication_year,category_id,total_copies,available_copies,shelf_location,description) VALUES ($1,$2,$3,$4,$5,$6,0,0,$7,$8) ON CONFLICT(book_code) DO UPDATE SET title=EXCLUDED.title RETURNING id', ['BK-00001','9780747532699','Harry Potter and the Philosopher’s Stone',publisher.rows[0].id,1997,cat.rows[0].id,'FIC-A-12','A well-loved starter title.']);
  await client.query('INSERT INTO book_authors(book_id,author_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [book.rows[0].id, author.rows[0].id]);
  for (const barcode of ['BC-00001','BC-00002','BC-00003']) await client.query('INSERT INTO book_copies(book_id,barcode,copy_number) VALUES($1,$2,$3) ON CONFLICT(barcode) DO NOTHING', [book.rows[0].id, barcode, barcode.slice(-2)]);
  await client.query('UPDATE books SET total_copies=(SELECT count(*) FROM book_copies WHERE book_id=$1), available_copies=(SELECT count(*) FROM book_copies WHERE book_id=$1) WHERE id=$1', [book.rows[0].id]);
  await client.query('COMMIT');
  console.log('Seed complete. admin@example.com / Admin123! and librarian@example.com / Librarian123!');
} catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); await pool.end(); }
