# QA Test Plan

## Strategy

Three automated layers plus manual UAT, all runnable locally and in CI:

| Layer       | Tool                                               | Count (2026-11-01) | What it proves                                                                                                                                  |
| ----------- | -------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | Vitest (jsdom)                                     | 91                 | money/weight/time arithmetic, Zod schemas, permission policy, error mapping, calculations for roast/packaging/sales/finance, display components |
| Integration | Vitest (node) against local Supabase as real users | 107 (11 files)     | RLS, functions, idempotency, concurrency, reversals, costing, reporting reconciliation, global invariants, security                             |
| End-to-end  | Playwright (Chromium, POM, tags)                   | 68 (14 specs)      | real UI flows per role, the full business scenario, negative paths, security headers/redirects, invitations by email, MFA sign-in, PWA assets   |
| Manual      | `docs/UAT_CHECKLIST.md`                            | 66 items           | business sign-off on staging                                                                                                                    |

Flakiness policy: **retries are disabled**. Every wait is state-based (`expect(...).toBe…`,
`waitForURL`, `waitFor`); no `sleep`. Traces, screenshots and the HTML report are retained on
failure and uploaded by CI.

## Suites and tags (Playwright)

| Tag           | Scope                                                                            | Command                       |
| ------------- | -------------------------------------------------------------------------------- | ----------------------------- |
| `@smoke`      | login/logout/redirects, master data, purchase→receive, headers                   | `npm run test:e2e:smoke`      |
| `@regression` | every functional flow                                                            | `npm run test:e2e:regression` |
| `@inventory`  | receiving, lots, adjustments, movements, the business flow                       | `npm run test:e2e:inventory`  |
| `@production` | roasting                                                                         | `npm run test:e2e:production` |
| `@packaging`  | products, materials, sessions                                                    | `npm run test:e2e:packaging`  |
| `@sales`      | customers, orders, fulfilment, payments, returns                                 | `npm run test:e2e:sales`      |
| `@finance`    | dashboard, expenses, reports, exports                                            | `npm run test:e2e:finance`    |
| `@security`   | role boundaries, headers, sessions, injection, negative paths, team members, MFA | `npm run test:e2e:security`   |

Fixtures: `fixtures/test.ts` (page objects as fixtures, `asRole()`), `fixtures/global-setup.ts`
(logs each role in once through the UI, stores sessions), `fixtures/api.ts` (API-based setup
through the same Postgres functions as the app, as the owner), `fixtures/users-admin.ts`
(service-role creation/removal of throwaway accounts for the MFA and invitation specs, plus a
reset of the MFA policy in global setup), `fixtures/mailpit.ts` (reads invitation links from the
local Mailpit API). TOTP codes are generated with `otpauth`. Test data is uniquely named per run;
suites never reset the database and can run repeatedly.

## Inventory invariants (STEP 2)

`src/tests/integration/invariants.test.ts` runs a concurrent workload (3 roasts completed twice
each in parallel, 3 packaging sessions completed twice each, 6 orders confirming for 15 bags, 5
fulfilments each submitted twice, a refused void, a return) and then checks the **whole database**:
no negative balance, reserved ≤ on hand, every balance = Σ movements, idempotency keys unique,
movements immutable, exactly one stock posting per document, exact quantities (5.5 kg green left,
10 g per batch, 1 bag), cost layers within bounds and equal to on-hand, exact cost inheritance
(₱0.4625/g → ₱733.75/batch → ₱777.93/session → ₱155.586/bag), lineage for every finished lot,
immutability of posted documents.

## End-to-end business scenario (STEP 3)

`src/tests/e2e/specs/business-flow.spec.ts` — the 23 steps through the UI with reconciled values:
10 kg received → 1,500 g roasted to 1,260 g (green 8,500 g) → 5 × 250 g (roasted 10 g, 5 units) →
customer buys 3 (2 units left) → paid → revenue ₱1,050, COGS ₱479.60, gross profit ₱570.40 →
dashboard deltas (net sales, COGS, gross profit, units, output, stock) → movement history →
lineage finished lot → roast batch → green lot.

## Negative testing (STEP 4)

UI: `negative.spec.ts` (insufficient green/roasted/finished stock, invalid weights, invalid prices,
double-click payment, missing references, invalid attachment, interrupted request, cleared session).
Database: every integration suite (over-receipt, over-fulfilment, over-allocation, negative stock,
duplicate references, concurrent overconsumption, unauthorized roles, cross-business references).

## Performance (STEP 6)

`npm run perf` — see `docs/PERFORMANCE.md` for budgets and the measured results.

## Security (STEP 7)

`src/tests/integration/security.test.ts` and `src/tests/e2e/specs/security.spec.ts`; findings and
verification matrix in `docs/SECURITY_REVIEW.md`.

## Running everything

```bash
npm run db:start && npm run env:local
npm run check                 # lint + typecheck + unit
npm run test:integration
npm run test:e2e              # or a tag: npm run test:e2e:smoke
npm run perf
npm run test:e2e:report       # open the HTML report
```

CI (`.github/workflows/ci.yml`) runs lint/format/typecheck, unit, migrations + integration,
`supabase db diff`, build + secret scan, the full Playwright suite, and uploads `playwright-report`
and `test-results` (traces, screenshots, JUnit) on every run.

## Entry / exit criteria for release

- Entry: CI green on `main`; `db diff` empty; UAT scheduled.
- Exit: all automated suites green on a fresh database (`npm run db:reset && npm run test:all`),
  perf within budgets, UAT signed, backup verified, release checklist complete.
