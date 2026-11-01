# Performance

Measured with `npm run perf` (`scripts/perf.ts`) on 2026-11-01 against the local Supabase stack
(Docker, Postgres 17) through supabase-js/PostgREST with the owner session (RLS active), on an
Apple-silicon laptop also running the dev server. Numbers are **local**; hosted latency adds
network round-trip (Manila ↔ Singapore ≈ 30–60 ms) but the database work is identical.

## Budgets and results

Dataset: an existing test database plus one 5,000 kg lot and **5,000 extra movements** inserted
through 50 adjustments of 100 lines (1.7 s total, ≈ 3,000 movements/s through the posting function).
Total movements at measurement time: 5,366.

| Metric                                                        | Budget (p95) | p50    | p95    | max    | n   | Result |
| ------------------------------------------------------------- | ------------ | ------ | ------ | ------ | --- | ------ |
| `dashboard_metrics` RPC, full year                            | 800 ms       | 63 ms  | 118 ms | 118 ms | 20  | PASS   |
| `green_lot_inventory_view` page (25 rows)                     | 400 ms       | 69 ms  | 84 ms  | 84 ms  | 20  | PASS   |
| `inventory_movement_history_view` page (50 rows)              | 400 ms       | 154 ms | 233 ms | 233 ms | 20  | PASS   |
| movement history for one item with 5,000+ rows (page 1)       | 400 ms       | 132 ms | 252 ms | 252 ms | 20  | PASS   |
| `inventory_reconciliation_view` (all balances)                | 800 ms       | 65 ms  | 86 ms  | 86 ms  | 10  | PASS   |
| `report_profitability` (year)                                 | 800 ms       | 24 ms  | 30 ms  | 30 ms  | 10  | PASS   |
| `report_sales_lines_view` export page (200 rows)              | 1000 ms      | 44 ms  | 48 ms  | 48 ms  | 10  | PASS   |
| monthly sales + sales by product + weekly production (3 RPCs) | 1200 ms      | 22 ms  | 26 ms  | 26 ms  | 10  | PASS   |
| 5 concurrent roast completions on the same green lot          | 1500 ms      | 17 ms  | 17 ms  | 17 ms  | 1   | PASS   |
| 10 concurrent order fulfilments (30 bags across 5 lots)       | 2000 ms      | 36 ms  | 36 ms  | 36 ms  | 1   | PASS   |

Database connections during the run: **19 total, 1 active** (max 100 on the local image; the
hosted Micro instance allows 60 direct / 200 pooled). Reconciliation differences after the load: **0**.

The two concurrency rows are a single timed `Promise.all` (n = 1) and prove correctness under
contention more than latency; all calls succeeded and serialised on the balance row locks.

## Budgets rationale

- Interactive pages (dashboard, inventory, lists): p95 ≤ 400–800 ms server time keeps total page
  render under ~1.5 s on hosted infrastructure.
- Reports/exports: ≤ 1–1.2 s per 200-row page; exports page through up to 50 pages server-side.
- Concurrency: posting functions hold row locks for a few milliseconds; 10 parallel fulfilments
  must complete well under 2 s with no failures or oversell.

## Query design notes

- Views are `security_invoker` and use `LEFT JOIN LATERAL` aggregates per row; list pages always
  paginate (`range`) and filter by `business_id` first, which hits the `(business_id, …)` indexes.
- Report aggregation runs in SQL functions; the browser never receives raw history.
- `inventory_movement_history_view` is the heaviest (joins profiles, locations, lots, coffees); it
  stays well inside budget at 5k rows. At 500k+ rows, add a composite index
  `(business_id, posted_at desc)` (already present) and consider a materialised monthly rollup.

## Not measured

- Hosted Vercel cold starts and CDN behaviour (measure after first deploy with the same script
  pointed at staging: set `NEXT_PUBLIC_SUPABASE_URL`/keys in `.env.local` to staging values).
- PDF generation CPU time (pdf-lib, pure JS): a 10,000-row export is the cap; expect a few seconds.
