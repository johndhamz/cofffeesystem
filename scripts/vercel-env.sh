#!/usr/bin/env bash
# Pushes the hosted Supabase settings from .env.hosted into the linked Vercel project (production).
# Usage: bash scripts/vercel-env.sh [production|preview]
set -euo pipefail
TARGET="${1:-production}"
ENV_FILE="$(dirname "$0")/../.env.hosted"
[ -f "$ENV_FILE" ] || { echo ".env.hosted not found (run the Supabase key export first)"; exit 1; }
APP_URL="${NEXT_PUBLIC_APP_URL:-}"
if [ -z "$APP_URL" ]; then
  read -r -p "Production URL (e.g. https://cofffeesystem.vercel.app): " APP_URL
fi
set -a; # shellcheck disable=SC1090
source "$ENV_FILE"; set +a
# Public values stay readable (Config); the service-role key is stored as a Secret.
add() { # name value sensitivity-flag
  printf '%s' "$2" | npx vercel env add "$1" --environment "$TARGET" --force --yes "$3" >/dev/null
  echo "set $1 ($TARGET)"
}
add NEXT_PUBLIC_SUPABASE_URL "$NEXT_PUBLIC_SUPABASE_URL" --no-sensitive
add NEXT_PUBLIC_SUPABASE_ANON_KEY "$NEXT_PUBLIC_SUPABASE_ANON_KEY" --no-sensitive
add SUPABASE_SERVICE_ROLE_KEY "$SUPABASE_SERVICE_ROLE_KEY" --sensitive
add NEXT_PUBLIC_APP_URL "$APP_URL" --no-sensitive
