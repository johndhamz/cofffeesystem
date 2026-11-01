# Database

Supabase PostgreSQL 17. Migrations live in `supabase/migrations` and are applied in order by
`supabase start` / `supabase db reset`. Local seed data is in `supabase/seed.sql` (never run in
production).

## Migrations

| File                                       | Contents                                                                                                                                                                                             |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261031000001_foundation.sql`            | `businesses`, `user_profiles`, `business_members`, `business_settings`, `audit_logs`, `role_permissions`, RLS helpers, audit/updated_at triggers, `create_business_with_owner()`, `my_memberships()` |
| `20261031000002_master_data.sql`           | `suppliers`, `green_coffees`, `roasters`, `inventory_locations`, `expense_categories`, `sales_channels`, `document_sequences`, settings defaults, `seed_business_defaults()`                         |
| `20261031000003_procurement_inventory.sql` | Purchase orders, goods receipts, green lots, the inventory ledger, adjustments, reservations, posting functions, views                                                                               |

## Conventions

- UUID primary keys (`gen_random_uuid()`), `created_at`, `updated_at` (trigger-maintained).
- Every business-owned table has `business_id` and `unique (id, business_id)` so child tables can
  use composite foreign keys that make cross-business references impossible.
- `business_id` is immutable on master/transactional rows (trigger).
- Case-insensitive unique names per business via `unique index … (business_id, lower(btrim(name)))`.
- Weights are `bigint` grams; money is `numeric(14,2)`; per-kg unit cost is `numeric(14,4)`.
- Master records referenced by transactions use `ON DELETE RESTRICT` — deactivate instead of delete.
- `app` schema holds internal helpers (not exposed through the API); `public` holds tables, views
  and callable RPCs.

## Roles and RLS

`public.role_permissions` is the permission matrix (mirrored in `src/lib/permissions/policy.ts`;
an integration test keeps them identical). Policies call:

- `app.is_member(business_id)` — any active member
- `app.has_permission(business_id, 'permission')` — role has that permission
- `app.member_role(business_id)` — e.g. hard deletes are owner-only

Ledger tables (`inventory_*`) have **select-only** policies; mutations go through functions.

## Functions (RPC)

| Function                                              | Permission        | Notes                                          |
| ----------------------------------------------------- | ----------------- | ---------------------------------------------- |
| `create_purchase_order`                               | purchases.manage  | idempotent on key; numbers `PO-YYYY-0001`      |
| `update_purchase_order_draft`                         | purchases.manage  | draft only                                     |
| `confirm_purchase_order`                              | purchases.manage  | idempotent                                     |
| `cancel_purchase_order`                               | purchases.manage  | not after posted receipts                      |
| `create_goods_receipt`                                | purchases.post    | creates lots; validates landed-cost allocation |
| `post_goods_receipt`                                  | purchases.post    | the only path that increases green stock       |
| `create_inventory_adjustment`                         | inventory.adjust  | create + post atomically; idempotent           |
| `post_inventory_adjustment`                           | inventory.adjust  |                                                |
| `reverse_inventory_adjustment`                        | inventory.adjust  | posts opposite movements                       |
| `reserve_inventory` / `release_inventory_reservation` | inventory.read    | for later phases                               |
| `create_business_with_owner`                          | service role only | provisioning                                   |
| `my_memberships`                                      | authenticated     | current user's businesses                      |

Functions raise errors prefixed `VALIDATION:`, `FORBIDDEN:`, `NOT_FOUND:`, `INVALID_STATE:`,
`INSUFFICIENT_STOCK:` or `OVER_RECEIPT:`; `fromDatabaseError()` maps them to `AppError`.

## Views (security_invoker)

- `green_lot_inventory_view` — the inventory dashboard row: quantities, cost/kg, stock value, status.
- `inventory_movement_history_view` — movements joined with location, lot, coffee and actor.
- `inventory_reconciliation_view` — balance vs ledger differences (should always be empty).
- `roast_batch_summary_view` — batch with roaster, profile, operator, lots, yield metrics, cost/kg and roasted stock on hand.

## Workflow

```bash
npx supabase migration new <name>   # add a migration
npm run db:reset                    # apply + seed
npm run db:types                    # regenerate TypeScript types
npx supabase db diff --local        # must be empty: migrations are the source of truth
```
