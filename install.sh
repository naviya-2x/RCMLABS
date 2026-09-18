#!/usr/bin/env bash
# Shelfwise one-command installer for a Linux machine with Docker Compose.
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/naviya-2x/RCMLABS/arena/01a0b311-rcmlabs/install.sh -o install.sh
#   chmod +x install.sh
#   SHELFWISE_ORIGIN=https://library.example.com ./install.sh
set -Eeuo pipefail

REPO_URL="${SHELFWISE_REPO_URL:-https://github.com/naviya-2x/RCMLABS.git}"
BRANCH="${SHELFWISE_BRANCH:-arena/01a0b311-rcmlabs}"
APP_DIR="${SHELFWISE_DIR:-$HOME/shelfwise}"
ORIGIN="${SHELFWISE_ORIGIN:-http://localhost:8080}"
SEED="${SHELFWISE_SEED:-true}"

log() { printf '\033[1;34m[shelfwise]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[shelfwise] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

command -v git >/dev/null 2>&1 || die "git is required. Install git and run this script again."
command -v docker >/dev/null 2>&1 || die "Docker is required. Install Docker Engine and the Compose plugin first."
docker compose version >/dev/null 2>&1 || die "Docker Compose is required. Try: docker compose version"

if [[ -e "$APP_DIR" && ! -d "$APP_DIR/.git" ]]; then
  die "$APP_DIR exists but is not a Git checkout. Set SHELFWISE_DIR to another directory or remove it."
fi

if [[ ! -d "$APP_DIR/.git" ]]; then
  log "Downloading Shelfwise into $APP_DIR"
  mkdir -p "$(dirname "$APP_DIR")"
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  log "Updating existing checkout in $APP_DIR"
  git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH"
  if [[ -z "$(git -C "$APP_DIR" status --porcelain)" ]]; then
    git -C "$APP_DIR" checkout -q "$BRANCH"
    git -C "$APP_DIR" reset --hard -q "origin/$BRANCH"
  else
    log "Local changes detected; leaving them untouched."
  fi
fi

cd "$APP_DIR"
[[ -f .env ]] || cp .env.example .env

random_hex() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    od -An -N32 -tx1 /dev/urandom | tr -d ' \n'
  fi
}

set_env() {
  local key="$1" value="$2" file=".env"
  if grep -q "^${key}=" "$file"; then
    KEY="$key" VALUE="$value" awk 'BEGIN { updated=0 } $0 ~ "^" ENVIRON["KEY"] "=" { print ENVIRON["KEY"] "=" ENVIRON["VALUE"]; updated=1; next } { print } END { if (!updated) print ENVIRON["KEY"] "=" ENVIRON["VALUE"] }' "$file" > "$file.tmp"
  else
    cp "$file" "$file.tmp"
    printf '%s=%s\n' "$key" "$value" >> "$file.tmp"
  fi
  mv "$file.tmp" "$file"
}

# Only generate secrets on the first install. Existing values are preserved.
if ! grep -q '^JWT_SECRET=.' .env; then set_env JWT_SECRET "$(random_hex)"; fi
if ! grep -q '^POSTGRES_PASSWORD=.' .env; then set_env POSTGRES_PASSWORD "$(random_hex)"; fi
set_env NODE_ENV production
set_env CORS_ORIGIN "$ORIGIN"
set_env COOKIE_SECURE "$([[ "$ORIGIN" == https://* ]] && echo true || echo false)"
set_env POSTGRES_DB "${POSTGRES_DB:-library}"
set_env POSTGRES_USER "${POSTGRES_USER:-library}"

log "Building and starting the application"
docker compose up -d --build

log "Waiting for the API and database"
ready=0
for _ in $(seq 1 90); do
  if docker compose exec -T api node -e "fetch('http://localhost:4000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done
[[ "$ready" == 1 ]] || { docker compose logs --tail=80 api; die "The API did not become ready. Check: docker compose logs -f api"; }

if [[ "$SEED" == "true" ]]; then
  log "Adding development seed data"
  docker compose exec -T api npm run db:seed
fi

cat <<SUMMARY

Shelfwise is running.

Open:       $ORIGIN
Admin:      admin@example.com / Admin123!
Librarian:  librarian@example.com / Librarian123!

Useful commands:
  cd "$APP_DIR"
  docker compose logs -f api
  docker compose ps
  docker compose exec api npm run db:seed
  docker compose down

Change the seeded passwords before production use. Set SHELFWISE_SEED=false to skip sample data on a fresh install.
SUMMARY
