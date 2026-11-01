# ADR 0002: Append-only inventory movement ledger

**Status:** accepted

## Context

Stock must be explainable: every kilogram on hand should trace to receipts, roasts, sales or
adjustments, and history must survive corrections.

## Decision

`inventory_movements` is append-only (trigger forbids update/delete). `inventory_balances` is a
derived running total maintained only by `app.post_movement()`. Corrections are reversing
movements. A reconciliation view proves balances equal the ledger.

## Consequences

- Fast balance reads without summing history; exact auditability.
- Mistakes are visible in history (a reversal), which is intended.
