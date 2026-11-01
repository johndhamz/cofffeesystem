# Production Deployment

Target: **Vercel** (Next.js, region `sin1` Singapore, closest to Manila) + **Supabase** hosted project
`cofffeesystem` (ref `zdjqjxvotcsxljyprbyb`, `ap-southeast-1`). Deployment is manual and requires
explicit approval from the business owner; nothing in this repository deploys automatically.

> Never copy development secrets into production. Local keys (`.env.local`) are the public demo
> keys of the local Supabase container; production keys come only from the Supabase dashboard and
> are stored only in Vercel environment variables.

## 1. Supabase production project

1. **Migrations** (from a machine with `supabase link` done):
   ```bash
   npx supabase db push            # applies supabase/migrations/* in order, idempotent
   npx supabase db diff --linked   # must print "No schema changes found"
   ```
2. **Auth settings** (Dashboard → Authentication):
   - Disable _Allow new users to sign up_.
   - Site URL = production URL; Redirect URLs = `https://<domain>/**` (and the Vercel preview domain if used).
   - Email provider enabled; customise the recovery email template with the business name.
   - Minimum password length ≥ 8 (the app enforces 8 on reset).
     Alternatively edit `supabase/config.toml [auth]` and run `npx supabase config push`.
3. **Storage**: buckets `roast-attachments` and `expense-receipts` are created by migrations
   (private, 10 MB, MIME allow-lists). No public buckets exist.
4. **Seed strategy**: production is **never** seeded with `supabase/seed.sql` (it creates test
   users with known passwords). Create the owner with the provisioning script, which also seeds the
   business defaults (Yoshan DY-2kg, locations, categories, channels, packaging materials):
   ```bash
   set -a; source .env.hosted; set +a     # NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY of PRODUCTION
   npm run provision:owner -- --email owner@yourroastery.ph --name "Owner Name" --business "Your Roastery"
   ```
   The one-time password is printed once; the owner changes it via _Forgot password_.
5. **Database settings**: keep _Connection pooling_ (Supavisor) enabled for any direct Postgres
   clients; the app itself uses PostgREST over HTTPS and needs no pooler string. Enable _Point in
   time recovery_ (Pro plan) — see `BACKUP_RECOVERY.md`.

## 2. Vercel project

```bash
npx vercel link                       # one-time, links this folder to the Vercel project
bash scripts/vercel-env.sh production # writes the 4 variables below from .env.hosted (production keys)
npx vercel --prod                     # deploy (only after approval; see RELEASE_CHECKLIST.md)
```

Environment variables (Project → Settings → Environment Variables):

| Variable                        | Environments        | Notes                                              |
| ------------------------------- | ------------------- | -------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Production, Preview | `https://<ref>.supabase.co`                        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview | anon key (public by design, RLS-limited)           |
| `SUPABASE_SERVICE_ROLE_KEY`     | Production only     | **Sensitive**. Server only; never `NEXT_PUBLIC_`   |
| `NEXT_PUBLIC_APP_URL`           | Production, Preview | canonical URL, used in password-reset links        |
| `ERROR_WEBHOOK_URL`             | optional            | Slack/Discord/Sentry-compatible webhook for errors |

Preview deployments should point at a **separate staging Supabase project**, never at production.

`vercel.json` pins the Singapore region and silences GitHub comments. Build command is the default
(`next build`); Node 24 is selected from `package.json` engines by Vercel automatically (set _Node.js
Version_ to 24.x in the project settings if the UI differs).

## 3. Domain

1. Vercel → Domains → add `app.<yourdomain>` → create the CNAME shown at your DNS provider.
2. After HTTPS is issued, set `NEXT_PUBLIC_APP_URL` to the final URL and redeploy.
3. Add the final URL to Supabase Auth _Site URL_ and _Redirect URLs_.

## 4. Monitoring and health

- `GET /api/health` returns `{status, db, latencyMs, version}`; `503` when PostgREST is unreachable.
  Point an uptime monitor (Better Uptime, UptimeRobot, Vercel Checks) at it with a 1-minute interval.
- Unhandled server errors are logged as structured JSON (`src/instrumentation.ts`) and, when
  `ERROR_WEBHOOK_URL` is set, posted to the webhook. Vercel → Logs shows them; add a Log Drain for
  retention beyond Vercel's limits.
- Supabase → Reports shows database CPU, connections and slow queries; set alerts at 70% CPU and
  80% connections.
- Weekly: open `/inventory` as owner; the reconciliation banner must be absent (balances = ledger).

## 5. Rollback

- **Application**: Vercel → Deployments → _Promote to Production_ on the previous deployment
  (instant, no data change). Or `npx vercel rollback`.
- **Database**: migrations are forward-only. If a migration must be reverted, write a new
  migration that reverses it (see `BACKUP_RECOVERY.md` for data restore). Never edit a migration
  that has been pushed.
- **Both**: if a release pairs a migration with app changes, roll the app back first (older app
  tolerates newer additive schema), then decide on the data.

## 6. Post-deploy verification (10 minutes)

1. `/api/health` → `status: ok`.
2. Log in as the owner; dashboard renders with financial metrics.
3. Create and deactivate a test supplier; confirm it appears in Settings → audit (owner).
4. Open Reports → Production → export CSV and PDF.
5. Log in as a viewer account (or check with the owner that non-owner roles see no finance).
6. Check Vercel logs for errors during the above.
