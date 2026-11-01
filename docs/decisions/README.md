# Architecture Decision Records

| ADR                                              | Decision                                                                            |
| ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| [0001](0001-server-side-mutations.md)            | All business mutations run on the server (actions → services → Postgres functions)  |
| [0002](0002-append-only-inventory-ledger.md)     | Inventory is an append-only movement ledger with derived balances                   |
| [0003](0003-atomic-transactions.md)              | Multi-row stock operations are PostgreSQL functions (single transaction, row locks) |
| [0004](0004-idempotent-operations.md)            | Every stock-changing operation carries an idempotency key                           |
| [0005](0005-lot-based-actual-costing.md)         | Green coffee is costed per lot at actual purchase + landed cost                     |
| [0006](0006-auditability.md)                     | Important tables are audited with before/after images and the acting user           |
| [0007](0007-immutable-financial-snapshots.md)    | Historical financial figures are snapshotted, never recalculated                    |
| [0008](0008-members-invitations-and-totp-mfa.md) | Owners invite members in-app; TOTP MFA with database-level membership guards        |
