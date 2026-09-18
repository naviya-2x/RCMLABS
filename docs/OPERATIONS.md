# Operations notes

- `GET /health` is unauthenticated and returns database reachability.
- The API logs JSON request records to stdout; collect them with Docker/journald.
- Set `TRUST_PROXY` in a process manager if the API is directly exposed behind a trusted proxy.
- Keep the Postgres volume on encrypted disk and restrict port 5432 to the Docker network.
- Use a separate database and secrets for staging and production. Seed credentials are for development only.
- The web container proxies `/api` to the API and serves the built SPA with a fallback to `index.html`.
