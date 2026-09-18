# Shelfwise Library Management System

Shelfwise is a production-oriented library management system with a React/TypeScript frontend, Express REST API, PostgreSQL, secure cookie authentication, role-based access control, transactional circulation, fines, reservations, reports, audit logging, and Docker deployment support.

## Quick start with Docker

```bash
cp .env.example .env
# Set a long random JWT_SECRET in .env
# Optionally change POSTGRES_* values before the first start
docker compose up -d --build
# Seed development data (safe to run again)
docker compose exec api npm run db:seed
```

Open `http://localhost:8080` (or put Nginx in front on port 80). Development accounts created by the seed are `admin@example.com` / `Admin123!` and `librarian@example.com` / `Librarian123!`. Change or remove these accounts before production use.

## Local development

Requirements: Node.js 20+, PostgreSQL 14+.

```bash
cp .env.example .env
npm install
npm run build -w backend
npm run db:migrate
npm run db:seed
npm run dev
```

The API is at `http://localhost:4000` and the Vite frontend at `http://localhost:5173`.

## Features

- Admin and librarian roles, secure bcrypt password hashing, HTTP-only JWT cookie, rate-limited login, role checks, and audit logs.
- Book/catalog management with authors, categories, publishers, archives, cover URL, physical copy barcodes, server-side search and pagination.
- Member registration, expiry and status management, borrowing history, and membership renewal.
- Atomic issue, return, and renewal workflows. Row locks prevent a copy being loaned twice during concurrent requests.
- Configurable borrowing period, borrowing limit, renewals, grace period, fine-per-day, and maximum fine.
- Fine assessment and payments, reservations, CSV reports, and dashboard metrics.
- Health endpoint, structured request logs, central error responses, migrations, seed data, tests, Docker, Nginx, and backup guidance.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | At least 32 random characters used to sign sessions |
| `PORT` | API port, default `4000` |
| `NODE_ENV` | `development` or `production` |
| `CORS_ORIGIN` | Allowed browser origin; use the public app URL |
| `COOKIE_SECURE` | Set `true` when served over HTTPS |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | Optional email integration settings |

## Linux VPS deployment

1. On Ubuntu/Debian install Docker Engine and the Compose plugin, then clone this repository.
2. Copy `.env.example` to `.env`, set a unique database password, a 32+ character random `JWT_SECRET`, `COOKIE_SECURE=true`, and your public origin.
3. Run `docker compose up -d --build` and `docker compose exec api npm run db:seed` once if seed data is desired. For production, create the first account manually or change the seeded passwords immediately.
4. Put the server behind Nginx. A sample config is in `nginx/library.conf`; it proxies `/` to `127.0.0.1:8080` and can be extended with TLS.
5. Run `sudo certbot --nginx -d library.example.com`, then set `CORS_ORIGIN=https://library.example.com` and restart the API.
6. Check `docker compose ps`, `docker compose logs -f api`, and `curl http://127.0.0.1:4000/health`.
7. Update safely with `git pull && docker compose up -d --build`; migrations run before the API starts. Back up before updates.

## PostgreSQL backups

Use a host with access to Docker:

```bash
mkdir -p backups
# custom-format backup, suitable for pg_restore
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" > "backups/library-$(date +%F).dump"
# restore into an empty database (stop API first)
docker compose stop api
docker compose exec -T db pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists < backups/library-2026-01-01.dump
docker compose start api
```

Do not put passwords in scripts. Use a protected `.pgpass` file or environment loaded by your deployment system. Schedule the dump with cron, retain several days off-server, and test restores regularly, for example: `0 2 * * * cd /srv/library && /usr/bin/docker compose exec -T db pg_dump -U library -Fc library > /srv/backups/library-$(date +\%F).dump`.

## Tests

`npm test` runs API/service tests. Set `TEST_DATABASE_URL` to an isolated PostgreSQL database for integration tests; unit tests for circulation calculations run without a database.

## API

All API routes are under `/api`. Responses use `{ data }` for success and `{ error: { code, message, details? } }` for failures. Main resources include `/auth`, `/dashboard`, `/books`, `/members`, `/loans`, `/fines`, `/catalog`, `/reports`, `/settings`, `/users`, and `/audit-logs`.
