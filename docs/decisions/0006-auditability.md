# ADR 0006: Auditability

**Status:** accepted

## Context

Owners need to know who changed settings, master data and documents, and when.

## Decision

A generic `app.audit_row_change()` trigger writes `audit_logs` rows (action, entity, before/after
JSON, `auth.uid()`) for businesses, members, settings, all master-data tables, purchase orders,
receipts, adjustments and lots. `business_settings.updated_by` and document `created_by` /
`posted_by` columns record actors directly. Audit logs are readable by owners (`audit.read`).

## Consequences

- Slight write overhead; full change history without application code.
