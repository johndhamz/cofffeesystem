# ADR 0005: Lot-based actual costing

**Status:** accepted

## Context

Green coffee prices vary by purchase; margins must reflect what each lot actually cost, including
freight and handling.

## Decision

Each goods receipt line creates a green coffee lot and an `inventory_cost_layers` row with the
actual cost: purchase cost (per-kg price × received weight) + proportional share of PO-level
additional costs + receipt-level landed costs allocated by weight (largest-remainder rounding so
centavos sum exactly). Costs are snapshotted on the receipt line and never recalculated.
`business_settings.costing_method` records the method; FIFO/weighted average are reserved values.

## Consequences

- Cost per kg and stock value per lot are exact and stable over time.
- Consumption reduces layer `remaining_cost` proportionally (oldest first within an item).
