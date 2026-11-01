# ADR 0004: Idempotent operations

**Status:** accepted

## Context

Network retries, double clicks and replays must not duplicate purchases, receipts or stock.

## Decision

Documents (`purchase_orders`, `goods_receipts`, `inventory_adjustments`) carry a client-generated
`idempotency_key`, unique per business; create functions return the existing document when the key
repeats. Movements carry a deterministic key (`grn:<receipt>:<line>`, `adj:<adjustment>:<line>`)
unique per business, and posting functions return early when the document is already posted.

## Consequences

- Forms generate one key per instance; retries are safe.
- Tests assert repeated and concurrent submissions change stock exactly once.
