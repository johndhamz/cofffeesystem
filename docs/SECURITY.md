# Security

## Authentication

- Supabase Auth with email + password. Public self-signup is disabled (`[auth] enable_signup = false`
  locally; set **Disable new user signups** in the hosted project's Auth settings).
- Sessions are HTTP-only cookies managed by `@supabase/ssr`. `src/proxy.ts` validates the session
  with `auth.getUser()` (not the unverified `getSession()`) on every request and redirects
  anonymous users to `/login`.
- Password reset uses Supabase recovery emails. The link lands on `/auth/confirm`, which verifies
  the token hash server-side and redirects to `/reset-password`. The request form always reports
  success so it cannot be used to enumerate accounts.
- Logout is a server action that clears the session cookies.

## Authorization

- Roles: `owner`, `roaster`, `inventory_staff`, `sales_staff`, `viewer`.
- The permission matrix is defined once in the database (`public.role_permissions`) and mirrored
  in `src/lib/permissions/policy.ts`; an integration test fails if they diverge.
- Server-side: services call `requirePermission(permission)`; pages use `can()` to hide actions.
- Database: RLS policies on every table use the same matrix. Ledger tables accept writes only
  from `SECURITY DEFINER` functions that re-check the permission.
- UI gating is a convenience only; the server and database are the enforcement points.

## Secrets

- `NEXT_PUBLIC_*` values are the only ones available to the browser. The anon key is public by
  design and is limited by RLS.
- `SUPABASE_SERVICE_ROLE_KEY` is imported only through `src/lib/env/server.ts` (marked
  `server-only`), used only by `src/lib/supabase/admin.ts`, scripts and tests. CI greps the client
  bundles for the key and fails if found.
- `.env*` files are git-ignored; `.env.example` documents the variables.

## Provisioning an owner (administrative process)

There is no self-service signup. An administrator with the service-role key runs:

```bash
npm run provision:owner -- --email owner@example.com --name "Juan dela Cruz" --business "Kape Roastery"
```

The script creates the confirmed auth user (or reuses an existing one), creates the business with
default settings (PHP, Asia/Manila, Yoshan DY-2kg, default location, expense categories, sales
channels), adds the user as `owner`, and prints a one-time password if none was given. The owner
should change it via **Forgot password** on first login.

Additional members are added by inserting into `business_members` (owners have `members.manage`;
a members UI is planned). All changes are recorded in `audit_logs` with the acting user.

## Hardening already in place

- Security headers (`X-Frame-Options`, `nosniff`, referrer and permissions policies) in `next.config.ts`.
- All SQL functions set `search_path = ''` and fully qualify objects.
- Redirect targets (`next` parameters) are validated to be same-origin paths.
- Input validation happens on the server with Zod regardless of client validation.
- Immutable ledger: stock history cannot be edited or deleted, even by the service role.

## Known gaps / follow-ups

- No rate limiting beyond Supabase Auth's defaults.
- No MFA. Supabase supports TOTP; enable when owners request it.
- Member invitation UI and role changes are administrative (SQL/script) for now.
