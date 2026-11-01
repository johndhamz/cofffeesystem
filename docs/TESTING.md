# Testing

| Suite       | Command                    | Scope                                                                                                                      |
| ----------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Unit        | `npm test`                 | money, units, timezone, validation schemas, permissions, errors, display components (Vitest + jsdom)                       |
| Integration | `npm run test:integration` | real local Postgres via Supabase: CRUD, duplicates, FKs, RLS, posting, idempotency, concurrency, reversals, reconciliation |
| E2E         | `npm run test:e2e`         | Playwright (Chromium) against the running app with Page Object Model                                                       |

## Integration tests

- Require `npm run db:start && npm run env:local`.
- Sign in as the seeded users through Supabase Auth so RLS is exercised exactly as in production.
- Each test creates its own supplier/coffee/purchase with unique names, so files can run in any
  order and repeatedly without a reset. `fileParallelism` is off because they share one database.
- Concurrency tests fire parallel RPC calls (8 posts of one receipt; 10 adjustments draining one
  lot) and assert exactly one movement / no negative stock.

## Playwright

- `src/tests/e2e/fixtures/global-setup.ts` logs in each role once through the UI and stores the
  session (`src/tests/e2e/.auth/*.json`). Specs call `asRole("owner")` to reuse it.
- Page objects live in `src/tests/e2e/pages`. Selectors use `data-testid` only.
- No fixed sleeps: tests wait on locators, URLs or `toHaveText` assertions.
- Test data uses unique names so reruns never collide; the suite does not reset the database.
- `playwright.config.ts` starts `npm run dev` (or `npm run start` in CI) and waits for the app.

Covered flows: login/logout/redirects, wrong password, reset request, supplier create/edit,
duplicate rejection, green coffee create with blank measurements, altitude validation, roaster
configuration + default roaster, list sorting/filtering, viewer restrictions, create purchase →
confirm → receive 10 kg → stock +10 kg, second lot with separate balance, authorized adjustment,
movement history, viewer cannot adjust, receive 10 kg → roast 1.5 kg → 1.26 kg out (16% loss, 84% yield,
20% DTR) → green 8.5 kg and roasted 1.26 kg with cost/kg, immutability of completed batches, viewer
cannot create roasts; 1260 g batch → five 250 g bags → 10 g roasted left, 5 units, 45 bags left,
lineage to roast + green lot, unit cost ₱159.87.

## CI

`.github/workflows/ci.yml` runs lint, format check, typecheck, unit tests, then starts Supabase
(migrations + seed), runs integration tests, verifies `supabase db diff` is empty, builds, asserts
the service-role key is absent from client bundles, and runs the Playwright smoke suite.
