# Release Checklist

Use for every production release. Copy into the release ticket and tick each box.

## Before merging to `main`

- [ ] CI green on the branch: lint, format, typecheck, 75+ unit, 100+ integration, Playwright suite.
- [ ] `npx supabase db diff --local` prints no changes (migrations are the source of truth).
- [ ] New migrations are additive, idempotent where possible, and reviewed for RLS on every new table.
- [ ] Any new table has: `business_id`, composite FK `(id, business_id)`, RLS enabled, audit trigger if it holds business data.
- [ ] Any new stock or money mutation goes through a `SECURITY DEFINER` function with `app.require_permission` and `app.posting`.
- [ ] `src/lib/permissions/policy.ts` and `public.role_permissions` updated together (the integration test enforces this).
- [ ] `docs/` updated (DATABASE.md tables/functions, ARCHITECTURE.md, KNOWN_LIMITATIONS.md).

## Release preparation

- [ ] Version/tag the release: `git tag -a vX.Y.Z -m "..." && git push --tags`.
- [ ] Run the full suite locally against a fresh database: `npm run db:reset && npm run test:all`.
- [ ] Run `npm run perf` and compare with `docs/PERFORMANCE.md` budgets.
- [ ] UAT checklist (`docs/UAT_CHECKLIST.md`) signed off by the business owner on staging.
- [ ] Backup verified: a PITR restore or `pg_dump` of production taken within the last 24 h (`BACKUP_RECOVERY.md`).
- [ ] Announce a maintenance window if a migration touches large tables (none so far are heavy).

## Deploy (requires explicit owner approval)

- [ ] `npx supabase db push` against production → `npx supabase db diff --linked` is empty.
- [ ] `npx vercel --prod` → note the deployment URL/ID.
- [ ] Post-deploy verification from `PRODUCTION_DEPLOYMENT.md` §6 completed.
- [ ] Error log quiet for 30 minutes.

## Rollback triggers

Roll back immediately (see `PRODUCTION_DEPLOYMENT.md` §5) if any of the following occurs:

- `/api/health` returns 503 for more than 2 minutes.
- Any inventory reconciliation difference appears (`/inventory` banner).
- Users cannot log in or any role sees another business's data.
- Posting functions raise unexpected errors (not VALIDATION/INSUFFICIENT_STOCK/FORBIDDEN).

## After release

- [ ] Record the release in the changelog section of `KNOWN_LIMITATIONS.md` if limitations changed.
- [ ] Rotate any credential that was shared during the release (one-time owner password, etc.).
