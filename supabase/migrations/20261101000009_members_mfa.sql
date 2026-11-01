-- =============================================================================
-- Phase 7: team members (invitations, role changes, deactivation) and MFA policy.
-- =============================================================================

alter table public.business_members
  add column invited_at timestamptz,
  add column accepted_at timestamptz;

alter table public.business_settings
  add column require_mfa boolean not null default false;

-- A business must always keep at least one active owner; nobody can remove their own owner role
-- by accident, and the last owner cannot be deactivated or demoted.
create or replace function app.business_members_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare v_other_owners integer;
begin
  if tg_op = 'UPDATE' and new.business_id <> old.business_id then
    raise exception 'business_id cannot be changed' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.user_id <> old.user_id then
    raise exception 'INVALID_STATE: a membership cannot be reassigned to another user' using errcode = '55000';
  end if;
  if (tg_op = 'DELETE' and old.role = 'owner' and old.is_active)
     or (tg_op = 'UPDATE' and old.role = 'owner' and old.is_active and (new.role <> 'owner' or not new.is_active)) then
    select count(*) into v_other_owners from public.business_members
    where business_id = old.business_id and role = 'owner' and is_active and id <> old.id;
    if v_other_owners = 0 then
      raise exception 'INVALID_STATE: a business must keep at least one active owner' using errcode = '55000';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger guard before update or delete on public.business_members
  for each row execute function app.business_members_guard();

-- Mark memberships accepted the first time the invited user signs in.
create or replace function app.handle_auth_user_sign_in()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.last_sign_in_at is not null and old.last_sign_in_at is null then
    update public.business_members set accepted_at = coalesce(accepted_at, new.last_sign_in_at) where user_id = new.id;
  end if;
  return new;
end;
$$;
create trigger on_auth_user_first_sign_in after update of last_sign_in_at on auth.users
  for each row execute function app.handle_auth_user_sign_in();

-- Existing members are considered accepted.
update public.business_members set accepted_at = created_at where accepted_at is null;

-- Member directory for the settings page (RLS: members.read via business_members policy).
create view public.business_member_directory_view
with (security_invoker = true)
as
select bm.id, bm.business_id, bm.user_id, bm.role, bm.is_active, bm.invited_by, bm.invited_at, bm.accepted_at, bm.created_at, bm.updated_at,
       up.email, up.full_name,
       inv.full_name as invited_by_name
from public.business_members bm
join public.user_profiles up on up.id = bm.user_id
left join public.user_profiles inv on inv.id = bm.invited_by;
grant select on public.business_member_directory_view to authenticated, service_role;
