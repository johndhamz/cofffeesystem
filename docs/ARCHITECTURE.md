# Architecture

## Layers

```
Browser (React client components, forms)
   │  server actions (features/*/actions.ts) — thin: call a service, return ActionResult
   ▼
Application services (src/server/services) — permission checks, validation, orchestration
   │
Repositories (src/server/repositories) — Supabase queries / RPC calls, business_id scoping
   │
PostgreSQL (Supabase) — RLS, constraints, SECURITY DEFINER functions for all stock changes
```

- **UI** lives in `src/app` (routes), `src/components` (shared + layout + shadcn primitives) and
  `src/features/<module>` (module-specific forms, tables, schemas and actions).
- **Services** are the only place business rules are expressed in TypeScript. They never trust the
  client: every mutation re-validates with Zod (`validate()`) and re-checks the role with the
  central policy (`requirePermission()`).
- **Repositories** are thin. Every query filters by `business_id` in addition to RLS (defense in depth).
- **Database functions** own anything that must be atomic or idempotent (purchase confirmation,
  receipts, adjustments, reservations). They run as `SECURITY DEFINER` with explicit permission
  checks and `search_path = ''`.

## Request flow for a mutation

1. Client form (React Hook Form + Zod) validates and calls a server action with a client-generated
   idempotency key.
2. The action calls a service; the service validates, checks permissions and calls a repository.
3. The repository calls a Postgres function (RPC) with the user's session (RLS applies to reads;
   writes to ledger tables happen only inside the function).
4. Errors are mapped to `AppError` (`src/lib/errors`) and returned as `{ ok: false, error }` —
   nothing is thrown across the server/client boundary.
5. The action revalidates the affected routes.

## Auth and sessions

- `@supabase/ssr` keeps the session in HTTP-only cookies. `src/proxy.ts` refreshes the session on
  every request and redirects unauthenticated users to `/login`.
- `getSessionContext()` (React `cache`) resolves user + memberships once per request. The active
  business is the first membership; a future SaaS layer only needs to change this one function.
- The service-role key is read only in `src/lib/env/server.ts` (`server-only`). It is never bundled.

## Multi-business readiness

Every operational table carries `business_id`, composite foreign keys `(id, business_id)` prevent
cross-business references, and RLS helpers (`app.is_member`, `app.has_permission`) derive access
from `business_members`. Tenant subscriptions are intentionally not modelled.

## Conventions

- Weights are integer grams in the database and in services; `src/lib/units` converts for display.
- Money is `numeric(14,2)` in the database; TypeScript math uses integer centavos (`src/lib/money`).
- Dates shown to users are formatted in `Asia/Manila` (`src/lib/units/time.ts`).
- Master data is declared once in `src/features/settings/master-data/entities.ts` and drives
  list pages, dialogs, detail views, validation and the generic repository.
- Test ids: use `data-testid` on interactive elements; Playwright selectors never depend on CSS.

## Reporting model (Phase 6)

- **Single costing system.** Reports never recompute costs: green lots carry purchase + landed cost,
  roast batches snapshot production cost, packaging sessions snapshot unit cost, and each fulfilled
  sales line snapshots `unit_cost_snapshot` (COGS) and `unit_price_snapshot` (revenue).
- **Revenue recognition policy:** product sales are recognised when a fulfilment is posted (not on
  order, not on payment). Payments and refunds settle receivables and never change revenue.
- **Discounts & returns:** line and order discounts are prorated onto fulfilled units; returned units
  reduce revenue; restocked returns credit COGS, quarantine/waste keep it.
- **Each cost once:** `expenses.cost_treatment` decides recognition. Operating treatments (selling,
  administrative, other operating) are period expenses; inventory acquisition, roast production and
  packaging production are already inside inventory cost (COGS) and are excluded from operating
  expenses; capital is an asset. `cost_allocations` link such expenses to the batch/session/receipt
  for traceability only.
- **Formulas:** gross profit = net sales − COGS; gross margin = GP / net sales; operating result = GP −
  operating expenses. Inventory valuation = Σ remaining cost layers (reconciles to balances).
- **Performance:** aggregations run in SQL (`report_*` functions, indexed by business + date); report
  pages paginate (50 rows) and exports stream up to 10,000 rows server-side. Date ranges are inclusive
  calendar days in Asia/Manila. These are management reports, not statutory financial statements.
