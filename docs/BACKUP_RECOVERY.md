# Backup and Recovery

## What must be protected

| Asset                                   | Where                                   | Recovery requirement                |
| --------------------------------------- | --------------------------------------- | ----------------------------------- |
| PostgreSQL database (all business data) | Supabase project `cofffeesystem`        | RPO ≤ 24 h (daily), ideally minutes |
| Storage objects (roast logs, receipts)  | Supabase Storage buckets                | RPO ≤ 24 h                          |
| Auth users                              | Supabase Auth (`auth.users`, in the DB) | included in database backups        |
| Application code and migrations         | GitHub `johndhamz/cofffeesystem`        | git history                         |
| Environment variables                   | Vercel + Supabase dashboards            | documented in PRODUCTION_DEPLOYMENT |

## Database backup strategy

1. **Supabase automatic backups** — daily snapshots on all paid plans (7 days on Pro). Enable
   **Point-in-Time Recovery (PITR)** on the Pro plan for minute-level recovery; this is the primary
   mechanism and is recommended before go-live.
2. **Off-platform logical backup** (independent of the vendor), nightly via a cron job or GitHub
   Action with the pooler connection string stored as a secret:
   ```bash
   pg_dump "$SUPABASE_DB_URL" --format=custom --no-owner --no-privileges \
     --schema=public --schema=app --schema=auth --schema=storage \
     --file "roastery-$(date +%F).dump"
   ```
   Keep 30 daily and 12 monthly files in encrypted object storage (e.g. a private S3/B2 bucket).
3. **Verify** backups monthly by restoring into a scratch Supabase project and running
   `npm run test:integration` against it (the invariants suite proves balances reconcile).

## Restore process

**Point-in-time (preferred):** Supabase Dashboard → Database → Backups → PITR → choose timestamp →
restore. The project is unavailable for a few minutes. Afterwards run the post-deploy verification.

**From a logical dump into a new project:**

```bash
npx supabase db push                      # recreate schema on the new project first
pg_restore "$NEW_DB_URL" --data-only --disable-triggers --no-owner roastery-YYYY-MM-DD.dump
```

`--disable-triggers` is required because movements and audit logs are immutable by trigger; the
restore reinserts them as data. After restore, check `inventory_reconciliation_view` returns no rows.
Then point Vercel's `NEXT_PUBLIC_SUPABASE_URL` / keys at the new project and redeploy.

## Storage recovery

Buckets are small (images, Artisan logs, receipts). Mirror them nightly:

```bash
npx supabase storage cp -r ss:///roast-attachments ./backup/roast-attachments --experimental
npx supabase storage cp -r ss:///expense-receipts ./backup/expense-receipts --experimental
```

Object paths are `<business_id>/<document_id>/<file>` and are referenced from `roast_attachments`
and `expenses.receipt_path`, so a restore is a straight copy back into the same paths. A missing
object only affects that attachment link; stock and money are unaffected.

## Migration rollback / recovery

- Migrations are forward-only and tracked in `supabase_migrations.schema_migrations`.
- To undo a bad migration, write a new reverting migration; test it locally with
  `npm run db:reset`, then `db push`.
- If a migration fails midway on production, Postgres rolls that file back atomically; fix the
  file (new migration) and push again.
- Data-destructive changes (dropping columns) must ship only after a release that stopped using
  them, and only after a verified backup.

## Incident response

1. **Detect**: uptime monitor on `/api/health`, error webhook, Supabase alerts, user report.
2. **Triage** (15 min): is it app (Vercel logs), database (Supabase reports), or data (reconciliation banner)?
3. **Contain**: roll the app back (`PRODUCTION_DEPLOYMENT.md` §5); if data integrity is in doubt,
   ask staff to stop posting documents (announce in the team chat) rather than taking the DB down.
4. **Recover**: restore PITR to just before the incident if data was corrupted; replay documents
   manually from printed/exported records if needed.
5. **Review**: write a short post-mortem (what, impact, timeline, fix, prevention) and add any
   missing guard as a migration + test.

Severity guide: **S1** stock or money wrong / data leak → page the owner now; **S2** a module
unusable → same day; **S3** cosmetic → next release.

## Operational monitoring

- `/api/health` every minute (expect `db: ok`, latency < 1 s).
- Vercel error logs + `ERROR_WEBHOOK_URL`.
- Supabase: CPU, connections (budget < 80 % of plan), storage size, auth failures.
- Weekly owner check: dashboard reconciliation banner absent; `/reports` valuation plausible.
- Quarterly: restore test, key rotation (service-role key), review `business_members`.
