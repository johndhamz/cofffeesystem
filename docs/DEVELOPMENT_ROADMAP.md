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
financial metrics" card on the dashboard and the Sales, Customers, Expenses and Reports pages.
Inventory, purchasing, roasting and packaging numbers are live.

## Ledger readiness for later phases

Movement types `sale`, `sale_return`, `transfer_*`, `write_off` and the reservation functions
already exist so Phase 5 only adds sales documents and calls `app.post_movement()` /
`reserve_inventory()`. Finished-goods lots (`finished_product` items, one per packaging output
line) are what sales fulfil; each carries its unit cost for COGS. Artisan CSV parsing of uploaded
roast attachments is deferred.
