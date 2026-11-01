# Development Roadmap

| Phase | Scope                                                                                                                                                                                                                 | Status  |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 0     | Foundation: auth, roles/RLS, dashboard shell, helpers, tests, CI, docs                                                                                                                                                | ✅ done |
| 1     | Master data: settings, suppliers, green coffee catalog, roasters, locations, expense categories, sales channels                                                                                                       | ✅ done |
| 2     | Purchasing, green lots, transactional inventory ledger, adjustments, inventory dashboard                                                                                                                              | ✅ done |
| 3     | Roast production: batches on the Yoshan DY-2kg, green consumption (`roast_consume`), roasted bulk output (`roast_output`), yield/shrinkage, roast profiles, measurements/events/attachments, void reversal            | ✅ done |
| 4     | Packaging & products: packaging materials inventory, pack bulk into finished units (`pack_consume`/`pack_output`), product catalog and pricing                                                                        | planned |
| 5     | Sales & customers: orders per channel, reservations → `sale` movements, returns, invoices                                                                                                                             | planned |
| 6     | Expenses & reports: expense entry, COGS from lot costs, margins, valuation snapshots, Recharts dashboards                                                                                                             | planned |
| 7     | Team members UI (invitations by email, role changes, deactivation, last-owner guard), TOTP multi-factor authentication with an owner-level "require MFA" policy, PWA polish (icons, service worker, offline fallback) | ✅ done |

## Placeholder content

None remain. Every module through Phase 7 is live; the dashboard and reports read recorded cost
snapshots and the inventory ledger. Later work (not scheduled): Artisan roast-log parsing, offline
queueing of documents, multi-business onboarding/billing.

## Ledger readiness for later phases

Every fulfilled sales line carries `unit_cost_snapshot` / `total_cost` (COGS) and
`unit_price_snapshot` (revenue), so Phase 6 reporting reads snapshots only. Movement types
`transfer_*` and `write_off` remain available. Artisan CSV parsing of uploaded roast attachments is
deferred.
