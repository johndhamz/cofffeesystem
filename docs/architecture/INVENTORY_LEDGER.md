# Inventory Ledger Architecture

The ledger is the single source of truth for stock. It supports green coffee lots (grams), roasted
bulk (grams), finished products (units) and packaging materials (configured units) through one set
of tables and one posting primitive.

## Tables

| Table                           | Role                                                                                                            |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `inventory_items`               | One row per stock-keeping thing: `(item_type, reference_id)` + `base_unit`.                                     |
| `inventory_movements`           | **Append-only** ledger. Every stock change is one row with a signed `quantity_delta`.                           |
| `inventory_balances`            | Running `on_hand_quantity` / `reserved_quantity` per item + location. Maintained only by `app.post_movement()`. |
| `inventory_cost_layers`         | Actual cost per receipt (or positive adjustment). `remaining_*` fields decrease as stock is consumed.           |
| `inventory_reservations`        | Soft holds that reduce availability without moving stock.                                                       |
| `inventory_adjustments(_lines)` | Documents for corrections; posting creates movements.                                                           |

Green coffee lots are `green_coffee_lots`; each lot becomes an `inventory_items` row of type
`green_coffee_lot` on first receipt.

## Invariants (enforced in PostgreSQL)

1. `inventory_balances.on_hand_quantity >= 0` and `reserved_quantity <= on_hand_quantity` (CHECK + locked update).
2. `sum(inventory_movements.quantity_delta) == inventory_balances.on_hand_quantity` per item/location
   (`inventory_reconciliation_view` reports any difference; the UI shows an alert if non-zero).
3. Movements are immutable: a trigger rejects UPDATE/DELETE even for the service role.
4. Each movement is unique on `(business_id, idempotency_key)`.
5. Authenticated users have **no** INSERT/UPDATE/DELETE policies on ledger tables; writes happen
   only inside `SECURITY DEFINER` functions that check `app.has_permission()`.

## The posting primitive

`app.post_movement(business, item, location, delta, type, source_type, source_id, idempotency_key, cost, notes, actor)`

1. Insert the balance row if missing, then `SELECT … FOR UPDATE` it. This serialises all
   concurrent posts for that item + location.
2. If a movement with the same idempotency key exists, return it (no change).
3. Reject if `on_hand + delta < 0` or `< reserved` (`INSUFFICIENT_STOCK`).
4. Insert the movement, update the balance. All inside the caller's transaction.

Because a Postgres function runs in one transaction, a receipt with five lines either posts all
five movements or none.

## Purchase → stock flow

```
create_purchase_order (draft) → confirm_purchase_order (locks items/prices)
→ create_goods_receipt (draft receipt, creates/assigns lots, validates landed-cost allocation)
→ post_goods_receipt:
     for each line: purchase_cost = received_g × unit_cost/kg ÷ 1000
                    po_cost_share  = PO additional_costs × received_g ÷ total_ordered_g
                    total_cost     = purchase_cost + po_cost_share + allocated_landed_cost
                    post_movement(+received_g, 'receipt', key = 'grn:<receipt>:<line>')
                    add_cost_layer(received_g, total_cost)
     mark receipt posted; PO → partially_received / received
```

- A purchase order never changes stock. Only `post_goods_receipt` does.
- Partial and multiple receipts per PO are supported; over-receipt is rejected.
- `post_goods_receipt` on an already-posted receipt returns immediately (idempotent), and the
  receipt row is locked `FOR UPDATE` so concurrent posts serialise.
- `create_goods_receipt` is idempotent on `(business_id, idempotency_key)`; the UI generates one
  key per form instance so retries never create two receipts.

## Costing

Lot-based actual cost. Each receipt line creates its own cost layer; later purchases at different
prices create new layers and never touch earlier ones. Negative movements consume layers oldest
first (`app.consume_cost_layers`) and reduce `remaining_cost` proportionally, so `stock_value` in
`green_lot_inventory_view` always equals the cost of what is still on hand. Landed costs are
allocated by weight with the largest-remainder method (`allocateCentavos`) so centavos sum exactly.

## Corrections

Nothing is edited. `reverse_inventory_adjustment` posts a new adjustment with negated lines
(`adjustment_reversal` movements) and marks the original `reversed`.

## Reconciliation

`inventory_reconciliation_view` compares balances with the ledger. The integration suite asserts
it is empty after every scenario, and the inventory page shows an alert if it is not.

## Roast production (Phase 3)

```
create_roast_batch (draft; inputs = green lots + weights)
→ start_roast_batch (in_progress; measurements/events recorded manually or attached)
→ complete_roast_batch:
     for each input lot: post_movement(-input_g, 'roast_consume', key 'roast:<batch>:in:<input>')
                         allocated_green_cost = consume_cost_layers(lot item, input_g)
     total = Σ allocated_green_cost + LPG + labor + overhead + other
     post_movement(+roasted_g, 'roast_output', key 'roast:<batch>:out', total)
     add_cost_layer(roasted_bulk item, roasted_g, total)
     snapshot loss %, yield %, development ratio, cost per gram on the batch
```

- One `roasted_bulk` inventory item per completed batch, so every gram of roasted coffee traces to its
  batch and, through `roast_batch_inputs`, to the green lots and their actual cost.
- The whole completion is one PL/pgSQL function: if any lot lacks stock the transaction rolls back and
  no roasted stock, cost layer or snapshot exists. Re-running completion on a completed batch returns
  immediately; concurrent completions serialise on the batch row lock.
- Roaster capacity is configuration (`roasters.capacity_g`, `capacity_policy` warn|block, optional
  `max_gas_kpa`). Drafts only warn; completion enforces the policy.
- Void of a completed batch posts `roast_void_consume` (−roasted) and `roast_void_restore` (+green
  with the original allocated cost as a new layer) and is refused if any roasted stock was consumed.
