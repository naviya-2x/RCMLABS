CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE CHECK (name IN ('admin','librarian')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), role_id INT NOT NULL REFERENCES roles(id),
  name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true, last_login_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), member_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL, email TEXT, phone TEXT, address TEXT, date_of_birth DATE,
  membership_type TEXT NOT NULL DEFAULT 'General Member' CHECK (membership_type IN ('Student','Staff','General Member')),
  registration_date DATE NOT NULL DEFAULT CURRENT_DATE, membership_expiry_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','expired')),
  profile_photo TEXT, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS authors (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS categories (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL UNIQUE, description TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS publishers (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), book_code TEXT NOT NULL UNIQUE, isbn TEXT UNIQUE,
  title TEXT NOT NULL, publisher_id UUID REFERENCES publishers(id) ON DELETE SET NULL, publication_year INT,
  language TEXT NOT NULL DEFAULT 'English', edition TEXT, description TEXT, shelf_location TEXT, cover_image TEXT,
  total_copies INT NOT NULL DEFAULT 0, available_copies INT NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS book_authors (book_id UUID REFERENCES books(id) ON DELETE CASCADE, author_id UUID REFERENCES authors(id) ON DELETE RESTRICT, PRIMARY KEY(book_id, author_id));
CREATE TABLE IF NOT EXISTS book_copies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), book_id UUID NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
  barcode TEXT NOT NULL UNIQUE, copy_number TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','borrowed','lost','maintenance')),
  acquired_at DATE NOT NULL DEFAULT CURRENT_DATE, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), member_id UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  copy_id UUID NOT NULL REFERENCES book_copies(id) ON DELETE RESTRICT, issued_by UUID REFERENCES users(id) ON DELETE SET NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE, due_date DATE NOT NULL, returned_at TIMESTAMPTZ,
  returned_by UUID REFERENCES users(id) ON DELETE SET NULL, renewal_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','returned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_loan_per_copy ON loans(copy_id) WHERE status = 'active';
CREATE TABLE IF NOT EXISTS fines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), member_id UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  loan_id UUID REFERENCES loans(id) ON DELETE SET NULL, type TEXT NOT NULL CHECK (type IN ('overdue','manual')),
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0), paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status TEXT NOT NULL DEFAULT 'outstanding' CHECK (status IN ('outstanding','partially_paid','paid')), assessed_at TIMESTAMPTZ NOT NULL DEFAULT now(), notes TEXT
);
CREATE TABLE IF NOT EXISTS fine_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), fine_id UUID NOT NULL REFERENCES fines(id) ON DELETE RESTRICT,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0), paid_by UUID REFERENCES users(id) ON DELETE SET NULL, paid_at TIMESTAMPTZ NOT NULL DEFAULT now(), notes TEXT
);
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), member_id UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE RESTRICT, reserved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  queue_position INT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','fulfilled','cancelled','expired')), expires_at DATE
);
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_reservation ON reservations(member_id, book_id) WHERE status = 'pending';
CREATE TABLE IF NOT EXISTS library_settings (
  key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY, user_id UUID REFERENCES users(id) ON DELETE SET NULL, action TEXT NOT NULL, entity TEXT NOT NULL,
  entity_id TEXT, details JSONB NOT NULL DEFAULT '{}', ip_address INET, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS books_search_idx ON books USING gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(isbn,'') || ' ' || coalesce(book_code,'')));
CREATE INDEX IF NOT EXISTS members_search_idx ON members USING gin (to_tsvector('english', coalesce(full_name,'') || ' ' || coalesce(member_code,'') || ' ' || coalesce(email,'')));
CREATE INDEX IF NOT EXISTS loans_status_idx ON loans(status, due_date);
CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_logs(created_at DESC);

INSERT INTO roles (name) VALUES ('admin'), ('librarian') ON CONFLICT (name) DO NOTHING;
INSERT INTO library_settings (key, value) VALUES
  ('borrowing_period_days','14'), ('max_books_per_member','5'), ('max_renewals','2'), ('fine_per_day','0.50'), ('max_fine','25'), ('grace_period_days','0')
ON CONFLICT (key) DO NOTHING;
