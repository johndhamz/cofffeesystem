# Security Review

Scope: authentication, authorization, RLS, business boundaries, schema/FKs, transactions, inventory
ledger, costing, audit logging, API security, file storage. Performed 2026-11-01 against commit
following Phase 6; findings fixed in migration `20261101000008_hardening.sql` and verified by
`src/tests/integration/security.test.ts`, `invariants.test.ts` and `src/tests/e2e/specs/security.spec.ts`.

## Architecture summary

- **Authentication**: Supabase Auth, email + password, HTTP-only cookies via `@supabase/ssr`;
  `src/proxy.ts` validates the JWT with `auth.getUser()` on every request and redirects anonymous
  users. Public sign-up disabled. Logout is local-scope sign-out. Password reset via token hash
  exchange on `/auth/confirm`; the request form never reveals whether an email exists.
- **Authorization**: one permission matrix in `public.role_permissions`, mirrored in
  `src/lib/permissions/policy.ts` (an integration test fails if they diverge). Services call
  `requirePermission()`; RLS policies call `app.has_permission()`; posting functions re-check inside
  `SECURITY DEFINER` with `search_path = ''`. Money reports need `finance.read` (owner only).
- **Business boundary**: every operational table has `business_id` and composite FKs
  `(id, business_id)`; RLS filters by membership; functions validate that every referenced row
  belongs to the caller's business.
- **Ledger**: no INSERT/UPDATE/DELETE policies on `inventory_movements`, `inventory_balances`,
  `inventory_cost_layers`, `payments`, `refunds`, fulfilments, receipts; writes only through functions.
  Movements are immutable by trigger for everyone including the service role.
- **Audit**: before/after images with `auth.uid()` on settings, members, master data and documents;
  now immutable (H3).
- **API**: the only custom route is `/api/reports/*` (session + report gate) and `/api/health`
  (no data). Server actions return typed results; errors never leak stack traces to the client.
- **Storage**: private buckets, 10 MB limit, MIME allow-lists; object paths are
  `<business_id>/…` and policies check the caller's permission on that business.
- **Secrets**: service-role key only in `src/lib/env/server.ts` (`server-only`); CI greps client
  bundles for it on every build.

## Findings

| ID  | Severity | Finding                                                                                                                                                                                                                          | Fix                                                                                        | Verified by                          |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------ |
| H1  | High     | `sales_orders_update` let `sales.manage` edit `subtotal/total_amount/discount` on drafts directly; a confirmed order could carry a tampered total.                                                                               | Guard freezes financial/status columns in every status unless a sales function is posting. | security.test.ts, invariants.test.ts |
| H2  | High     | `reserve_inventory`/`release_inventory_reservation` required only `inventory.read` → viewers could lock stock.                                                                                                                   | Require `sales.manage` or `inventory.adjust`.                                              | security.test.ts                     |
| H3  | High     | `audit_logs` had no immutability trigger; service-role scripts could alter history.                                                                                                                                              | `immutable_audit` trigger (update/delete raise).                                           | security.test.ts                     |
| H4  | Medium   | Roles with update rights could overwrite `finished_goods_lots.unit_cost/quantity`, `inventory_items.reference_id`, draft `roast_batches` weights/costs, `packaging_sessions` snapshots, and edit voided/over-allocated expenses. | Column guards on each table; posting functions set `app.posting`.                          | invariants.test.ts, security.test.ts |
| B1  | Medium   | Negative unit price in the order form threw during render → page error boundary (DoS of the screen).                                                                                                                             | Preview tolerates invalid input; schema rejects on submit.                                 | negative.spec.ts                     |
| B2  | Low      | Search terms with `,` `(` `)` `"` produced a PostgREST parse error (500).                                                                                                                                                        | `escapeLike()` strips filter syntax and escapes wildcards.                                 | security.test.ts, security.spec.ts   |
| L1  | Low      | No Content-Security-Policy header.                                                                                                                                                                                               | Deferred (needs nonce plumbing); other headers set.                                        | KNOWN_LIMITATIONS.md                 |
| L2  | Low      | No MFA / rate limiting beyond Supabase defaults.                                                                                                                                                                                 | Deferred to Phase 7; enable Supabase TOTP.                                                 | —                                    |

## Verification matrix (automated)

| Control                                                                                               | Test                                              |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Anonymous reads nothing from 50 tables / 9 views                                                      | security.test.ts "anonymous clients read nothing" |
| Another business sees zero rows in every table/view                                                   | security.test.ts "other business sees zero rows"  |
| Ledger/financial tables reject direct writes (42501)                                                  | security.test.ts "no direct writes"               |
| Role escalation via `business_members` blocked                                                        | security.test.ts                                  |
| Audit written with actor; immutable for service role                                                  | security.test.ts                                  |
| Storage: foreign business path, viewer upload, `.exe`, cross-business/anonymous download all rejected | security.test.ts                                  |
| Filter injection via search                                                                           | security.test.ts, security.spec.ts                |
| Privileged functions blocked for anon / non-members                                                   | security.test.ts                                  |
| Hardening headers, no `x-powered-by`, no service key in HTML                                          | security.spec.ts                                  |
| Protected pages/API redirect anonymous (307 → /login)                                                 | security.spec.ts, negative.spec.ts                |
| Viewer UI: no create buttons, access-denied on mutation routes                                        | security.spec.ts                                  |
| XSS: script in search/name rendered as text                                                           | security.spec.ts                                  |
| Session cleared mid-use → redirect                                                                    | negative.spec.ts                                  |
| Duplicate submissions (idempotency)                                                                   | negative.spec.ts, every integration suite         |
| Service-role key absent from client bundle                                                            | CI "Assert no server secrets in client bundles"   |

## Common web vulnerabilities

- **Injection**: all data access is parameterised (PostgREST / plpgsql parameters); `.or()` search
  strings are sanitised. No raw SQL from user input.
- **XSS**: React escaping; no `dangerouslySetInnerHTML`; markdown is not rendered.
- **CSRF**: Next.js server actions are POST-only with origin checks; auth cookies are `SameSite=Lax`.
- **Clickjacking**: `X-Frame-Options: DENY`.
- **Open redirects**: `next` parameters must start with `/` and not `//`.
- **Mass assignment**: Zod schemas whitelist fields; services map to explicit columns.
- **IDOR**: every query filters by `business_id` _and_ RLS enforces membership; functions verify
  ownership of referenced ids.
- **Secrets in logs**: error instrumentation logs path/method/digest only.

## Residual risks and recommendations

1. Enable PITR and the off-platform `pg_dump` job before go-live (`BACKUP_RECOVERY.md`).
2. Turn on MFA for owner accounts once Phase 7 ships the UI; until then use long unique passwords.
3. Rotate the service-role key if it was ever pasted into a chat or ticket.
4. Review `business_members` quarterly; deactivate leavers (`is_active = false` keeps history).
