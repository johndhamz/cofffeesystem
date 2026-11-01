# ADR 0008: Team member invitations and TOTP multi-factor authentication

Date: 2026-11-01 · Status: accepted

## Context

Phase 0 ruled out public self-signup; members were added by an administrator with the service-role
key. Phase 7 needs owners to manage their own team from the app and an optional second factor,
without exposing the service-role key to the browser or weakening row-level security.

## Decision

- **Invitations**: `members.service.ts` (server only) uses the service-role client for exactly one
  thing: `auth.admin.inviteUserByEmail` (or looking an existing user up by email). The membership
  row is inserted with the owner's own session, so RLS, the audit trigger and the new
  `app.business_members_guard` apply. Invitation and recovery emails use token-hash links to the
  existing `/auth/confirm` route (custom templates in `supabase/templates/`), because the default
  `ConfirmationURL` flow puts tokens in the URL fragment where a server route cannot read them.
- **Guard in the database**: a business can never lose its last active owner; memberships cannot be
  moved to another business or user. `accepted_at` is stamped by a trigger on `auth.users`
  (`last_sign_in_at`) so "invited" vs "active" never depends on application code.
- **MFA**: Supabase TOTP factors, enrolled/verified by server actions on the user's cookie session.
  Enforcement has three layers: the login/set-password actions compute the destination (`/mfa` or
  Settings → Security) so the browser URL is right after a server-action redirect; `src/proxy.ts`
  redirects any `aal1` request of an enrolled account to `/mfa`; the dashboard layout redirects
  members without a factor to Security when `business_settings.require_mfa` is on.
- **No recovery codes**: a lost authenticator is removed by an owner through the documented
  administrative process (`docs/SECURITY.md`).

## Consequences

- The hosted project must enable TOTP and copy the two email templates (see
  `docs/PRODUCTION_DEPLOYMENT.md`).
- Database error messages must stay ASCII-only: PostgREST returned empty 500s for messages with an
  em dash (found while testing this phase; a unit test now enforces it).
- E2E tests read invitation links from Mailpit and generate TOTP codes with `otpauth`; they use
  throwaway accounts so the seeded roles are never enrolled.
