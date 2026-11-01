-- =============================================================================
-- Phase 1: Master data
-- suppliers, green_coffees, roasters, inventory_locations, expense_categories,
-- sales_channels, business_settings defaults, document sequences.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  contact_person text check (contact_person is null or char_length(contact_person) <= 120),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (phone is null or char_length(phone) <= 40),
  address text check (address is null or char_length(address) <= 500),
  notes text check (notes is null or char_length(notes) <= 2000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id)
);
create unique index suppliers_business_name_key on public.suppliers (business_id, lower(btrim(name)));
create index suppliers_business_active_idx on public.suppliers (business_id, is_active);

create table public.green_coffees (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  country text check (country is null or char_length(country) <= 80),
  region text check (region is null or char_length(region) <= 120),
  farm text check (farm is null or char_length(farm) <= 120),
  producer text check (producer is null or char_length(producer) <= 120),
  variety text check (variety is null or char_length(variety) <= 120),
  processing_method text check (processing_method is null or char_length(processing_method) <= 80),
  altitude_masl integer check (altitude_masl is null or (altitude_masl between 0 and 6000)),
  description text check (description is null or char_length(description) <= 2000),
  low_stock_threshold_g bigint check (low_stock_threshold_g is null or low_stock_threshold_g >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id)
);
create unique index green_coffees_business_name_key on public.green_coffees (business_id, lower(btrim(name)));
create index green_coffees_business_active_idx on public.green_coffees (business_id, is_active);

create table public.roasters (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  manufacturer text check (manufacturer is null or char_length(manufacturer) <= 120),
  model text check (model is null or char_length(model) <= 120),
  capacity_g integer not null check (capacity_g between 1 and 1000000),
  notes text check (notes is null or char_length(notes) <= 2000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id)
);
create unique index roasters_business_name_key on public.roasters (business_id, lower(btrim(name)));

create table public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  location_type text not null default 'warehouse'
    check (location_type in ('warehouse', 'roastery', 'retail', 'consignment', 'other')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id)
);
create unique index inventory_locations_business_name_key on public.inventory_locations (business_id, lower(btrim(name)));

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  classification text not null default 'operating'
    check (classification in ('cogs', 'operating', 'capital', 'other')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id)
);
create unique index expense_categories_business_name_key on public.expense_categories (business_id, lower(btrim(name)));

create table public.sales_channels (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  channel_type text not null default 'other'
    check (channel_type in ('walk_in', 'online', 'wholesale', 'cafe', 'consignment', 'event', 'other')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id)
);
create unique index sales_channels_business_name_key on public.sales_channels (business_id, lower(btrim(name)));

-- Per-business document numbering (PO-2026-0001 etc.)
create table public.document_sequences (
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind text not null,
  period text not null,
  next_value integer not null default 1 check (next_value > 0),
  primary key (business_id, kind, period)
);

-- -----------------------------------------------------------------------------
-- business_settings: default references (composite FK prevents cross-business refs)
-- -----------------------------------------------------------------------------
alter table public.business_settings
  add column default_roaster_id uuid,
  add column default_location_id uuid,
  add constraint business_settings_default_roaster_fk
    foreign key (default_roaster_id, business_id) references public.roasters (id, business_id)
    on delete set null (default_roaster_id),
  add constraint business_settings_default_location_fk
    foreign key (default_location_id, business_id) references public.inventory_locations (id, business_id)
    on delete set null (default_location_id);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
create trigger set_updated_at before update on public.suppliers for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.green_coffees for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.roasters for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.inventory_locations for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.expense_categories for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.sales_channels for each row execute function app.set_updated_at();

create trigger audit after insert or update or delete on public.suppliers for each row execute function app.audit_row_change();
create trigger audit after insert or update or delete on public.green_coffees for each row execute function app.audit_row_change();
create trigger audit after insert or update or delete on public.roasters for each row execute function app.audit_row_change();
create trigger audit after insert or update or delete on public.inventory_locations for each row execute function app.audit_row_change();
create trigger audit after insert or update or delete on public.expense_categories for each row execute function app.audit_row_change();
create trigger audit after insert or update or delete on public.sales_channels for each row execute function app.audit_row_change();

-- business_id is immutable on master records
create or replace function app.prevent_business_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.business_id <> old.business_id then
    raise exception 'business_id cannot be changed' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger lock_business before update on public.suppliers for each row execute function app.prevent_business_change();
create trigger lock_business before update on public.green_coffees for each row execute function app.prevent_business_change();
create trigger lock_business before update on public.roasters for each row execute function app.prevent_business_change();
create trigger lock_business before update on public.inventory_locations for each row execute function app.prevent_business_change();
create trigger lock_business before update on public.expense_categories for each row execute function app.prevent_business_change();
create trigger lock_business before update on public.sales_channels for each row execute function app.prevent_business_change();

-- -----------------------------------------------------------------------------
-- Document numbering helper (row-locked, per business + kind + year)
-- -----------------------------------------------------------------------------
create or replace function app.next_document_number(p_business_id uuid, p_kind text, p_prefix text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_period text := to_char((now() at time zone 'Asia/Manila'), 'YYYY');
  v_next integer;
begin
  insert into public.document_sequences (business_id, kind, period, next_value)
  values (p_business_id, p_kind, v_period, 1)
  on conflict (business_id, kind, period) do nothing;

  update public.document_sequences
  set next_value = next_value + 1
  where business_id = p_business_id and kind = p_kind and period = v_period
  returning next_value - 1 into v_next;

  return format('%s-%s-%s', p_prefix, v_period, lpad(v_next::text, 4, '0'));
end;
$$;

-- -----------------------------------------------------------------------------
-- Business defaults (replaces the Phase 0 placeholder)
-- -----------------------------------------------------------------------------
create or replace function app.seed_business_defaults(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_roaster_id uuid;
  v_location_id uuid;
begin
  insert into public.roasters (business_id, name, manufacturer, model, capacity_g, notes)
  values (p_business_id, 'Yoshan DY-2kg', 'Yoshan', 'DY-2kg', 2000, 'Initial drum roaster')
  on conflict do nothing
  returning id into v_roaster_id;

  insert into public.inventory_locations (business_id, name, location_type)
  values (p_business_id, 'Main Roastery', 'roastery')
  on conflict do nothing
  returning id into v_location_id;

  insert into public.expense_categories (business_id, name, classification) values
    (p_business_id, 'Green Coffee', 'cogs'),
    (p_business_id, 'Packaging Materials', 'cogs'),
    (p_business_id, 'Fuel & Gas', 'operating'),
    (p_business_id, 'Electricity', 'operating'),
    (p_business_id, 'Labor', 'operating'),
    (p_business_id, 'Delivery & Logistics', 'operating'),
    (p_business_id, 'Rent', 'operating'),
    (p_business_id, 'Equipment', 'capital'),
    (p_business_id, 'Miscellaneous', 'other')
  on conflict do nothing;

  insert into public.sales_channels (business_id, name, channel_type) values
    (p_business_id, 'Walk-in', 'walk_in'),
    (p_business_id, 'Online', 'online'),
    (p_business_id, 'Wholesale', 'wholesale')
  on conflict do nothing;

  update public.business_settings
  set default_roaster_id = coalesce(default_roaster_id, v_roaster_id),
      default_location_id = coalesce(default_location_id, v_location_id),
      currency = 'PHP',
      timezone = 'Asia/Manila'
  where business_id = p_business_id;
end;
$$;

-- Reference example green coffees (names only; no prices, moisture or stock).
create or replace function app.seed_example_green_coffees(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.green_coffees (business_id, name, country, region, variety, processing_method) values
    (p_business_id, 'Atok Benguet Arabica Washed', 'Philippines', 'Atok, Benguet', 'Arabica', 'Washed'),
    (p_business_id, 'Atok Benguet Arabica Honey', 'Philippines', 'Atok, Benguet', 'Arabica', 'Honey'),
    (p_business_id, 'Sultan Kudarat Robusta Natural', 'Philippines', 'Sultan Kudarat', 'Robusta', 'Natural'),
    (p_business_id, 'Son La Vietnam Arabica', 'Vietnam', 'Son La', 'Arabica', null),
    (p_business_id, 'Brazil Cerrado Arabica', 'Brazil', 'Cerrado', 'Arabica', null),
    (p_business_id, 'Lanao del Sur Liberica', 'Philippines', 'Lanao del Sur', 'Liberica', null)
  on conflict do nothing;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.suppliers enable row level security;
alter table public.green_coffees enable row level security;
alter table public.roasters enable row level security;
alter table public.inventory_locations enable row level security;
alter table public.expense_categories enable row level security;
alter table public.sales_channels enable row level security;
alter table public.document_sequences enable row level security;

-- Helper macro-like policy creation
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('suppliers', 'suppliers.manage'),
      ('green_coffees', 'green_coffees.manage'),
      ('roasters', 'roasters.manage'),
      ('inventory_locations', 'locations.manage'),
      ('expense_categories', 'expense_categories.manage'),
      ('sales_channels', 'sales_channels.manage')
    ) as v(tbl, perm)
  loop
    execute format(
      'create policy %I_select on public.%I for select to authenticated using (app.has_permission(business_id, %L))',
      t.tbl, t.tbl, 'master_data.read');
    execute format(
      'create policy %I_insert on public.%I for insert to authenticated with check (app.has_permission(business_id, %L))',
      t.tbl, t.tbl, t.perm);
    execute format(
      'create policy %I_update on public.%I for update to authenticated using (app.has_permission(business_id, %L)) with check (app.has_permission(business_id, %L))',
      t.tbl, t.tbl, t.perm, t.perm);
    -- Hard delete is owner-only; FKs from transactional tables use ON DELETE RESTRICT.
    execute format(
      'create policy %I_delete on public.%I for delete to authenticated using (app.member_role(business_id) = %L)',
      t.tbl, t.tbl, 'owner');
  end loop;
end;
$$;

create policy document_sequences_select on public.document_sequences
  for select to authenticated using (app.is_member(business_id));
