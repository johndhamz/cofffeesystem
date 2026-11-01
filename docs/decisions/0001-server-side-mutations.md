# ADR 0001: Server-side business mutations

**Status:** accepted

## Context

The browser can be tampered with; stock and money must be correct regardless of the client.

## Decision

Clients never write to business tables directly. Every mutation is a Next.js server action that
calls an application service, which validates input (Zod), checks the role against the central
policy and calls a repository. Stock-changing operations are PostgreSQL functions. RLS mirrors the
same rules so even a direct API call with a user JWT cannot bypass them.

## Consequences

- Validation and permission logic exists in exactly two places (service + database), tested to match.
- Client forms are purely UX; server errors are returned as `ActionResult`, never thrown.
