# Deployment

Target: Vercel (Next.js) + hosted Supabase project `cofffeesystem` (ref `zdjqjxvotcsxljyprbyb`,
region ap-southeast-1). The hosted keys are kept in the git-ignored `.env.hosted`.

## One-time setup (run from the project folder)

```bash
# 1. Apply all migrations to the hosted database (idempotent; re-run after each new migration)
npx supabase db push

# 2. Sync Auth settings (signups disabled, redirect URLs) — edit supabase/config.toml [auth] first:
#    site_url = "https://<your-vercel-domain>"  and add it to additional_redirect_urls
npx supabase config push

# 3. Create the first owner account on the hosted project
npm run provision:owner -- --email you@example.com --name "Your Name" --business "Kape Roastery"
#    (reads NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY; export them from .env.hosted first:
#     set -a; source .env.hosted; set +a)

# 4. Link the Vercel project, set env vars, deploy
npx vercel link
bash scripts/vercel-env.sh production
npx vercel --prod
```

After the first deploy, put the real domain into `NEXT_PUBLIC_APP_URL` (re-run step 4's env
script) and into Supabase Auth's Site URL / Redirect URLs (step 2), then redeploy.

## Ongoing

- Every merge to `main` runs CI. Deploys are manual (`npx vercel --prod`) until the Vercel GitHub
  integration is enabled on the repository, after which pushes to `main` deploy automatically.
- New migrations: commit under `supabase/migrations`, CI verifies them, then `npx supabase db push`.

## Environment variables on Vercel

| Variable                        | Scope       | Source                  |
| ------------------------------- | ----------- | ----------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | all         | hosted project URL      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | all         | hosted anon key         |
| `SUPABASE_SERVICE_ROLE_KEY`     | server only | hosted service-role key |
| `NEXT_PUBLIC_APP_URL`           | all         | the production URL      |

Never add the service-role key to a `NEXT_PUBLIC_` variable.
