# Known Limitations

Current as of the production-readiness review (2026-11-01). None of these block go-live for a
single business; each lists the workaround.

## Functional

| Area       | Limitation                                                                                                                | Workaround / plan                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Members    | Invitations go by email only; there is no link-copy fallback if the email provider is down.                               | Resend from Settings → Team members, or use _Forgot password_ on the sign-in page.  |
| Auth       | MFA has no backup/recovery codes; rate limiting stays at Supabase Auth defaults.                                          | A lost authenticator is removed by an owner via the admin process in `SECURITY.md`. |
| Purchasing | Over-receipt beyond the ordered quantity is rejected (no tolerance).                                                      | Amend the draft PO before confirming, or raise a second PO.                         |
| Purchasing | PO-level additional costs are allocated by ordered weight at each receipt; a cancelled remainder leaves part unallocated. | Record remaining freight as an expense with `inventory_acquisition` treatment.      |
| Roasting   | Artisan `.alog`/CSV files are stored but not parsed; measurements are entered manually.                                   | Later phase.                                                                        |
| Roasting   | A completed roast can only be voided while none of its roasted coffee has been used.                                      | Use an inventory adjustment for partial corrections.                                |
| Packaging  | Surplus roasted input beyond Σ outputs is absorbed into unit cost (no explicit "packing loss" line).                      | Enter exact input weight; the preview shows remaining grams.                        |
| Sales      | One location per order fulfilment; no multi-warehouse transfers UI (`transfer_*` movement types exist).                   | Single-site roastery for now.                                                       |
| Sales      | Returns can only be posted with a disposition; there is no "pending inspection" state.                                    | Record the return once inspected.                                                   |
| Finance    | Management reporting only (no VAT/BIR statutory statements, no accounts payable ledger).                                  | Export CSV to the accountant.                                                       |
| Finance    | Operating expenses are recognised when incurred (cash-basis style); no accruals/prepayments.                              | Document in the expense notes.                                                      |
| Reports    | Exports are capped at 10,000 rows per file.                                                                               | Narrow the date range.                                                              |
| Currency   | PHP only; timezone Asia/Manila only (both validated).                                                                     | By design for this business.                                                        |

## Technical

| Area         | Limitation                                                                                                       | Notes                                                                                          |
| ------------ | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| CSP          | No Content-Security-Policy header (Next.js inline scripts need nonces).                                          | X-Frame-Options, nosniff, referrer and permissions policies are set; React escapes all output. |
| Storage      | Local dev disables Supabase Studio/Realtime for speed; Storage is enabled.                                       | Hosted project runs all services.                                                              |
| Numbers      | PostgREST returns `numeric` as JS numbers; all arithmetic that matters runs in SQL or in integer centavos in TS. | Display-only rounding risk above ~₱90 trillion.                                                |
| Offline      | The PWA caches the shell and shows an offline page; documents cannot be drafted or queued offline.               | By design: stock and money postings need the server so nothing is double-counted.              |
| Multi-tenant | Schema is business-scoped and RLS-isolated, but there is no tenant onboarding/billing.                           | Future SaaS work; `create_business_with_owner` is the entry point.                             |
| Tests        | Integration and E2E suites share one local database and create uniquely named data; they do not reset it.        | Run `npm run db:reset` when the local DB grows large.                                          |

## Review findings fixed in this release (for the record)

- H1 Draft sales order totals were directly editable by sales staff → frozen for all statuses.
- H2 Viewers could reserve stock → reservations need `sales.manage` or `inventory.adjust`.
- H3 Audit logs were mutable by the service role → immutability trigger.
- H4 Cost/quantity snapshots on finished lots, roast batches, packaging sessions, inventory item identities and voided/allocated expenses could be overwritten → guards.
- B1 Entering a negative unit price crashed the order form (render-time throw) → preview is tolerant; schema still rejects on submit.
- B2 Search terms containing `,` `(` `)` `"` produced a PostgREST filter error → escaped/stripped.
