# Development Roadmap

| Phase | Scope                                                                                                                                                                                                      | Status  |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 0     | Foundation: auth, roles/RLS, dashboard shell, helpers, tests, CI, docs                                                                                                                                     | ✅ done |
| 1     | Master data: settings, suppliers, green coffee catalog, roasters, locations, expense categories, sales channels                                                                                            | ✅ done |
| 2     | Purchasing, green lots, transactional inventory ledger, adjustments, inventory dashboard                                                                                                                   | ✅ done |
| 3     | Roast production: batches on the Yoshan DY-2kg, green consumption (`roast_consume`), roasted bulk output (`roast_output`), yield/shrinkage, roast profiles, measurements/events/attachments, void reversal | ✅ done |
| 4     | Packaging & products: packaging materials inventory, pack bulk into finished units (`pack_consume`/`pack_output`), product catalog and pricing                                                             | planned |
| 5     | Sales & customers: orders per channel, reservations → `sale` movements, returns, invoices                                                                                                                  | planned |
| 6     | Expenses & reports: expense entry, COGS from lot costs, margins, valuation snapshots, Recharts dashboards                                                                                                  | planned |
| 7     | Members UI, invitations, MFA, PWA offline polish, Storage for photos/documents                                                                                                                             | planned |

## Placeholder content

The following are intentionally placeholders with no business logic: the "production, sales and
financial metrics" card on the dashboard and the Expenses and Reports pages. Inventory,
purchasing, roasting, packaging and sales numbers are live.

## Ledger readiness for later phases

Every fulfilled sales line carries `unit_cost_snapshot` / `total_cost` (COGS) and
`unit_price_snapshot` (revenue), so Phase 6 reporting reads snapshots only. Movement types
`transfer_*` and `write_off` remain available. Artisan CSV parsing of uploaded roast attachments is
deferred.
