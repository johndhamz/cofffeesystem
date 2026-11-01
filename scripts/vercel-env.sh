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
for KEY in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY; do
  npx vercel env rm "$KEY" "$TARGET" --yes >/dev/null 2>&1 || true
  printf '%s' "${!KEY}" | npx vercel env add "$KEY" "$TARGET" >/dev/null
  echo "set $KEY ($TARGET)"
done
npx vercel env rm NEXT_PUBLIC_APP_URL "$TARGET" --yes >/dev/null 2>&1 || true
printf '%s' "$APP_URL" | npx vercel env add NEXT_PUBLIC_APP_URL "$TARGET" >/dev/null
echo "set NEXT_PUBLIC_APP_URL=$APP_URL ($TARGET)"
