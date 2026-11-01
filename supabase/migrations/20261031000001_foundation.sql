-- =============================================================================
-- Phase 0: Foundation
-- businesses, user_profiles, business_members, business_settings, audit_logs,
-- role-based permission matrix, RLS helpers.
-- =============================================================================

create extension if not exists "pgcrypto";

-- Internal helper schema (not exposed through the API).
create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'roaster', 'inventory_staff', 'sales_staff', 'viewer');

-- -----------------------------------------------------------------------------
-- Generic triggers
-- -----------------------------------------------------------------------------
create or replace function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Core tables
-- -----------------------------------------------------------------------------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  role public.member_role not null default 'viewer',
  is_active boolean not null default true,
  invited_by uuid references public.user_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id)
);
create index business_members_user_idx on public.business_members (user_id);

create table public.business_settings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses (id) on delete cascade,
  currency char(3) not null default 'PHP' check (currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'Asia/Manila',
  inventory_weight_unit text not null default 'g' check (inventory_weight_unit in ('g', 'kg')),
  costing_method text not null default 'lot_actual'
    check (costing_method in ('lot_actual', 'fifo', 'weighted_average')),
  -- default_roaster_id / default_location_id are added in the master-data migration
  updated_by uuid references public.user_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses (id) on delete cascade,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_business_created_idx on public.audit_logs (business_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

-- Permission matrix: single source of truth for RLS. Mirrored in src/lib/permissions/policy.ts
-- and verified by an integration test.
create table public.role_permissions (
  role public.member_role not null,
  permission text not null,
  primary key (role, permission)
);

create trigger set_updated_at before update on public.businesses
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.user_profiles
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.business_members
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.business_settings
  for each row execute function app.set_updated_at();

-- -----------------------------------------------------------------------------
-- Permission matrix contents
-- -----------------------------------------------------------------------------
insert into public.role_permissions (role, permission) values
  -- owner: everything
  ('owner', 'business.settings.read'), ('owner', 'business.settings.update'),
  ('owner', 'members.read'), ('owner', 'members.manage'),
  ('owner', 'audit.read'),
  ('owner', 'master_data.read'),
  ('owner', 'suppliers.manage'), ('owner', 'green_coffees.manage'), ('owner', 'roasters.manage'),
  ('owner', 'locations.manage'), ('owner', 'expense_categories.manage'), ('owner', 'sales_channels.manage'),
  ('owner', 'purchases.read'), ('owner', 'purchases.manage'), ('owner', 'purchases.post'),
  ('owner', 'inventory.read'), ('owner', 'inventory.adjust'),
  ('owner', 'roasting.read'), ('owner', 'roasting.manage'),
  ('owner', 'packaging.read'), ('owner', 'packaging.manage'),
  ('owner', 'products.read'), ('owner', 'products.manage'),
  ('owner', 'sales.read'), ('owner', 'sales.manage'),
  ('owner', 'customers.read'), ('owner', 'customers.manage'),
  ('owner', 'expenses.read'), ('owner', 'expenses.manage'),
  ('owner', 'reports.read'),
  -- roaster
  ('roaster', 'business.settings.read'), ('roaster', 'members.read'),
  ('roaster', 'master_data.read'), ('roaster', 'green_coffees.manage'),
  ('roaster', 'purchases.read'),
  ('roaster', 'inventory.read'),
  ('roaster', 'roasting.read'), ('roaster', 'roasting.manage'),
  ('roaster', 'packaging.read'), ('roaster', 'packaging.manage'),
  ('roaster', 'products.read'),
  ('roaster', 'reports.read'),
  -- inventory_staff
  ('inventory_staff', 'business.settings.read'), ('inventory_staff', 'members.read'),
  ('inventory_staff', 'master_data.read'),
  ('inventory_staff', 'suppliers.manage'), ('inventory_staff', 'green_coffees.manage'), ('inventory_staff', 'locations.manage'),
  ('inventory_staff', 'purchases.read'), ('inventory_staff', 'purchases.manage'), ('inventory_staff', 'purchases.post'),
  ('inventory_staff', 'inventory.read'), ('inventory_staff', 'inventory.adjust'),
  ('inventory_staff', 'roasting.read'),
  ('inventory_staff', 'packaging.read'), ('inventory_staff', 'packaging.manage'),
  ('inventory_staff', 'products.read'),
  ('inventory_staff', 'reports.read'),
  -- sales_staff
  ('sales_staff', 'business.settings.read'), ('sales_staff', 'members.read'),
  ('sales_staff', 'master_data.read'),
  ('sales_staff', 'inventory.read'),
  ('sales_staff', 'products.read'),
  ('sales_staff', 'sales.read'), ('sales_staff', 'sales.manage'),
  ('sales_staff', 'customers.read'), ('sales_staff', 'customers.manage'),
  ('sales_staff', 'reports.read'),
  -- viewer: read-only
  ('viewer', 'business.settings.read'), ('viewer', 'members.read'),
  ('viewer', 'master_data.read'),
  ('viewer', 'purchases.read'), ('viewer', 'inventory.read'),
  ('viewer', 'roasting.read'), ('viewer', 'packaging.read'), ('viewer', 'products.read'),
  ('viewer', 'sales.read'), ('viewer', 'customers.read'), ('viewer', 'expenses.read'),
  ('viewer', 'reports.read');

-- -----------------------------------------------------------------------------
-- RLS helper functions (SECURITY DEFINER to avoid recursive policy evaluation)
-- -----------------------------------------------------------------------------
create or replace function app.is_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_members bm
    where bm.business_id = p_business_id
      and bm.user_id = auth.uid()
      and bm.is_active
  );
$$;

create or replace function app.has_permission(p_business_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members bm
    join public.role_permissions rp on rp.role = bm.role
    where bm.business_id = p_business_id
      and bm.user_id = auth.uid()
      and bm.is_active
      and rp.permission = p_permission
  );
$$;

create or replace function app.member_role(p_business_id uuid)
returns public.member_role
language sql
stable
security definer
set search_path = ''
as $$
  select bm.role from public.business_members bm
  where bm.business_id = p_business_id and bm.user_id = auth.uid() and bm.is_active
  limit 1;
$$;

revoke all on function app.is_member(uuid) from public;
revoke all on function app.has_permission(uuid, text) from public;
revoke all on function app.member_role(uuid) from public;
grant execute on function app.is_member(uuid) to authenticated, service_role;
grant execute on function app.has_permission(uuid, text) to authenticated, service_role;
grant execute on function app.member_role(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Audit trigger: records before/after images with the acting user.
-- -----------------------------------------------------------------------------
create or replace function app.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
  v_entity_id uuid;
  v_before jsonb;
  v_after jsonb;
begin
  if tg_op = 'DELETE' then
    v_before := to_jsonb(old);
    v_entity_id := old.id;
  elsif tg_op = 'INSERT' then
    v_after := to_jsonb(new);
    v_entity_id := new.id;
  else
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
    v_entity_id := new.id;
  end if;

  if tg_table_name = 'businesses' then
    v_business_id := v_entity_id;
  else
    v_business_id := coalesce((v_after ->> 'business_id')::uuid, (v_before ->> 'business_id')::uuid);
  end if;

  insert into public.audit_logs (business_id, actor_id, action, entity_type, entity_id, before_data, after_data)
  values (v_business_id, auth.uid(), lower(tg_op), tg_table_name, v_entity_id, v_before, v_after);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger audit after insert or update or delete on public.businesses
  for each row execute function app.audit_row_change();
create trigger audit after insert or update or delete on public.business_members
  for each row execute function app.audit_row_change();
create trigger audit after insert or update or delete on public.business_settings
  for each row execute function app.audit_row_change();

-- Track who changed settings.
create or replace function app.set_updated_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.updated_by = auth.uid();
  end if;
  return new;
end;
$$;
create trigger set_updated_by before update on public.business_settings
  for each row execute function app.set_updated_by();

-- -----------------------------------------------------------------------------
-- Profile bootstrap: every auth user gets a profile row.
-- -----------------------------------------------------------------------------
create or replace function app.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', null))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_auth_user();

create or replace function app.handle_auth_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.user_profiles set email = new.email where id = new.id;
  return new;
end;
$$;
create trigger on_auth_user_email_updated after update of email on auth.users
  for each row execute function app.handle_auth_user_email_change();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.businesses enable row level security;
alter table public.user_profiles enable row level security;
alter table public.business_members enable row level security;
alter table public.business_settings enable row level security;
alter table public.audit_logs enable row level security;
alter table public.role_permissions enable row level security;

-- businesses
create policy businesses_select on public.businesses
  for select to authenticated using (app.is_member(id));
create policy businesses_update on public.businesses
  for update to authenticated
  using (app.has_permission(id, 'business.settings.update'))
  with check (app.has_permission(id, 'business.settings.update'));

-- user_profiles: self, plus fellow members of a shared business
create policy user_profiles_select on public.user_profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.business_members mine
      join public.business_members theirs on theirs.business_id = mine.business_id
      where mine.user_id = auth.uid() and mine.is_active and theirs.user_id = user_profiles.id
    )
  );
create policy user_profiles_update_self on public.user_profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- business_members
create policy business_members_select on public.business_members
  for select to authenticated using (app.is_member(business_id));
create policy business_members_insert on public.business_members
  for insert to authenticated with check (app.has_permission(business_id, 'members.manage'));
create policy business_members_update on public.business_members
  for update to authenticated
  using (app.has_permission(business_id, 'members.manage'))
  with check (app.has_permission(business_id, 'members.manage'));
create policy business_members_delete on public.business_members
  for delete to authenticated using (app.has_permission(business_id, 'members.manage'));

-- business_settings
create policy business_settings_select on public.business_settings
  for select to authenticated using (app.is_member(business_id));
create policy business_settings_update on public.business_settings
  for update to authenticated
  using (app.has_permission(business_id, 'business.settings.update'))
  with check (app.has_permission(business_id, 'business.settings.update'));

-- audit_logs: read for owners; writes only via triggers (security definer) / service role
create policy audit_logs_select on public.audit_logs
  for select to authenticated using (app.has_permission(business_id, 'audit.read'));

-- role_permissions: readable by any authenticated user (it is not secret)
create policy role_permissions_select on public.role_permissions
  for select to authenticated using (true);

-- -----------------------------------------------------------------------------
-- Business provisioning (service role only). Used by the owner-provisioning
-- script and local seeds. Default master data is added by the master-data
-- migration through app.seed_business_defaults().
-- -----------------------------------------------------------------------------
create or replace function app.slugify(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(lower(p_text), '[^a-z0-9]+', '-', 'g'), '-');
$$;

create or replace function public.create_business_with_owner(
  p_name text,
  p_owner_user_id uuid,
  p_slug text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
  v_slug text;
begin
  if auth.role() <> 'service_role' and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'create_business_with_owner is restricted to administrative use'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.user_profiles where id = p_owner_user_id) then
    raise exception 'owner user % has no profile', p_owner_user_id using errcode = '23503';
  end if;

  v_slug := coalesce(nullif(p_slug, ''), app.slugify(p_name));
  if exists (select 1 from public.businesses where slug = v_slug) then
    v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 8);
  end if;

  insert into public.businesses (name, slug) values (p_name, v_slug) returning id into v_business_id;
  insert into public.business_settings (business_id) values (v_business_id);
  insert into public.business_members (business_id, user_id, role)
  values (v_business_id, p_owner_user_id, 'owner');

  -- Master-data defaults (defined in a later migration, resolved at call time).
  perform app.seed_business_defaults(v_business_id);

  return v_business_id;
end;
$$;

revoke all on function public.create_business_with_owner(text, uuid, text) from public, anon, authenticated;
grant execute on function public.create_business_with_owner(text, uuid, text) to service_role;

-- Placeholder; replaced in the master-data migration.
create or replace function app.seed_business_defaults(p_business_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  -- no-op until master data exists
  return;
end;
$$;

-- -----------------------------------------------------------------------------
-- Convenience RPC for the app: current user's memberships
-- -----------------------------------------------------------------------------
create or replace function public.my_memberships()
returns table (
  business_id uuid,
  business_name text,
  business_slug text,
  role public.member_role
)
language sql
stable
security invoker
set search_path = ''
as $$
  select b.id, b.name, b.slug, bm.role
  from public.business_members bm
  join public.businesses b on b.id = bm.business_id
  where bm.user_id = auth.uid() and bm.is_active
  order by b.created_at;
$$;
grant execute on function public.my_memberships() to authenticated;
