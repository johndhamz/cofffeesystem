# Coffee Roastery OS

Production and business management for a single specialty coffee roastery in the Philippines
(initial roaster: Yoshan DY-2kg). Built with Next.js App Router, TypeScript (strict), Tailwind,
shadcn/ui, Supabase (Postgres + Auth), Zod, React Hook Form, Vitest and Playwright.

**Status:** Phase 0 (foundation), Phase 1 (master data) and Phase 2 (purchasing + inventory ledger)
are implemented. Roasting, packaging, products, sales, customers, expenses and reports are
placeholder pages (see `docs/DEVELOPMENT_ROADMAP.md`).

## Quick start

Prerequisites: Node 24, npm 11, Docker (for local Supabase).

```bash
npm install
npm run db:start        # starts local Supabase, applies migrations + seed
npm run env:local       # writes .env.local from `supabase status`
npm run dev             # http://localhost:3000
```

Seeded local accounts (local only — see `supabase/seed.sql`):

| Role            | Email                   | Password          |
| --------------- | ----------------------- | ----------------- |
| owner           | owner@coffee.test       | OwnerPass123!     |
| roaster         | roaster@coffee.test     | RoasterPass123!   |
| inventory_staff | inventory@coffee.test   | InventoryPass123! |
| sales_staff     | sales@coffee.test       | SalesPass123!     |
| viewer          | viewer@coffee.test      | ViewerPass123!    |
| owner (other)   | other-owner@coffee.test | OtherPass123!     |

Local Supabase uses ports 55821–55829 (API 55821, Postgres 55822, Mailpit 55824) so it can run
alongside other local Supabase projects. Studio, Realtime and Storage are disabled locally for
speed; re-enable them in `supabase/config.toml` when a feature needs them.

## Scripts

| Script                     | Purpose                                                           |
| -------------------------- | ----------------------------------------------------------------- |
| `npm run dev` / `build`    | Next.js dev server / production build                             |
| `npm run lint`             | ESLint (Next + TypeScript rules, Prettier-compatible)             |
| `npm run typecheck`        | `tsc --noEmit` (run `npx next typegen` first on a fresh clone)    |
| `npm run format`           | Prettier                                                          |
| `npm test`                 | Vitest unit tests (jsdom)                                         |
| `npm run test:integration` | Vitest against the local database (RLS, functions, concurrency)   |
| `npm run test:e2e`         | Playwright smoke tests (starts the dev server automatically)      |
| `npm run db:start/stop`    | Local Supabase                                                    |
| `npm run db:reset`         | Re-apply migrations and seed                                      |
| `npm run db:types`         | Regenerate `src/types/database.ts`                                |
| `npm run provision:owner`  | Create an owner + business (service role; see `docs/SECURITY.md`) |

## Documentation

- `docs/ARCHITECTURE.md` — layers, request flow, conventions
- `docs/architecture/INVENTORY_LEDGER.md` — the transactional inventory design
- `docs/DATABASE.md` — schema, RLS, functions, migrations
- `docs/SECURITY.md` — auth, roles, secrets, provisioning
- `docs/TESTING.md` — test strategy and how to run each suite
- `docs/DEVELOPMENT_ROADMAP.md` — phases and what is placeholder
- `docs/decisions/` — architecture decision records
