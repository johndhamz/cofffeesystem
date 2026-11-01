# ADR 0007: Immutable historical financial snapshots

**Status:** accepted

## Context

Supplier prices, landed costs and master data change; historical reports must not drift.

## Decision

Financial figures are copied onto the document at posting time (`purchase_order_items.line_total`,
`goods_receipt_items.purchase_cost / po_cost_share / total_cost`, movement `total_cost`,
cost-layer `original_cost`). Posted documents cannot be edited or deleted; items of non-draft
documents are frozen by triggers. Later phases follow the same rule for roast and sales costs.

## Consequences

- Reports read snapshots, not live joins to master data prices.
- Corrections create new documents (reversals), preserving the original figures.
