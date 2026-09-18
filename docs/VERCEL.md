# Deploying on Vercel

Vercel can host the React frontend and run the Express API as a serverless function. PostgreSQL must be hosted separately; use Neon, Supabase, or another managed PostgreSQL provider. The repository includes `api/index.ts` and `vercel.json` for this layout.

## One-time setup

1. Create a managed PostgreSQL database and copy its connection string.
2. Run migrations and seed data from a machine with Node.js:

   ```bash
   DATABASE_URL='postgresql://...' JWT_SECRET='a-long-random-secret' npm run db:migrate
   DATABASE_URL='postgresql://...' JWT_SECRET='a-long-random-secret' npm run db:seed
   ```

   Use a separate database for production. Seed credentials are for development only.

3. Import the GitHub repository into Vercel. Leave the project root at the repository root; `vercel.json` builds `frontend/dist` and routes `/api/*` to the Express function.
4. Add these Vercel environment variables for Production, Preview, and Development as appropriate:

   - `DATABASE_URL` — managed PostgreSQL connection string
   - `JWT_SECRET` — at least 32 random characters
   - `NODE_ENV=production`
   - `COOKIE_SECURE=true`
   - `CORS_ORIGIN` — your Vercel URL or custom domain

5. Deploy. The frontend and API share the same origin, so the existing relative `/api` requests work without frontend changes.
6. Add a custom domain in Vercel if desired. Update `CORS_ORIGIN` to that exact `https://` origin and redeploy.

## Important operational notes

- Do not run migrations from every serverless invocation. Run `npm run db:migrate` once per release from CI or a deployment machine before promoting the release.
- Vercel functions are stateless. The app stores session state in signed HTTP-only cookies and data in PostgreSQL, so it does not require a local filesystem.
- Cover images should use a public object-storage URL; local uploads are not durable on Vercel's ephemeral filesystem.
- If the API returns `An unexpected server error occurred`, check `DATABASE_URL`, `JWT_SECRET`, Vercel Function Logs, and whether migrations have been applied.
