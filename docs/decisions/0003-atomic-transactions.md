# ADR 0003: Atomic database transactions with row locks

**Status:** accepted

## Context

A receipt posts several movements, cost layers and status updates; concurrent users must not
oversell or double-post.

## Decision

Multi-step stock operations are PL/pgSQL functions executed as one transaction. They lock the
document (`FOR UPDATE`) and the balance row before changing anything. Failures roll back fully.

## Consequences

- Partial posts are impossible; concurrency is serialised per item + location.
- Business logic for posting lives in SQL; it is covered by integration tests rather than unit tests.
