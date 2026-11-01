-- =============================================================================
-- Phase 3: Roast production
-- roast_profiles, roast_batches, roast_batch_inputs, roast_measurements,
-- roast_events, roast_batch_costs, roast_attachments.
-- Completion atomically consumes green lots and creates roasted bulk stock via
-- the Phase 2 ledger (app.post_movement / cost layers).
-- =============================================================================

create type public.roast_batch_status as enum ('draft', 'in_progress', 'completed', 'voided');
create type public.roast_event_type as enum (
  'charge', 'turning_point', 'dry_end', 'first_crack_start', 'first_crack_end',
  'second_crack_start', 'drop', 'cooling_end', 'gas_change', 'airflow_change', 'drum_change', 'note'
);
alter type public.inventory_movement_type add value if not exists 'roast_void_restore';
alter type public.inventory_movement_type add value if not exists 'roast_void_consume';

-- Roaster operational configuration (no hard-coded machine limits).
alter table public.roasters
  add column capacity_policy text not null default 'warn' check (capacity_policy in ('warn', 'block')),
  add column max_gas_kpa numeric(7, 3) check (max_gas_kpa is null or max_gas_kpa > 0);

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table public.roast_profiles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  roaster_id uuid,
  target_roast_level text check (target_roast_level is null or target_roast_level in ('light', 'medium_light', 'medium', 'medium_dark', 'dark')),
  target_notes text check (target_notes is null or char_length(target_notes) <= 2000),
  description text check (description is null or char_length(description) <= 2000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id),
  foreign key (roaster_id, business_id) references public.roasters (id, business_id) on delete set null (roaster_id)
);
create unique index roast_profiles_business_name_key on public.roast_profiles (business_id, lower(btrim(name)));

create table public.roast_batches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  batch_number text not null,
  roaster_id uuid not null,
  roast_profile_id uuid,
  operator_id uuid references public.user_profiles (id) on delete set null,
  location_id uuid not null,
  status public.roast_batch_status not null default 'draft',
  roast_date date not null default (now() at time zone 'Asia/Manila')::date,
  started_at timestamptz,
  completed_at timestamptz,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text,
  green_weight_g bigint not null default 0 check (green_weight_g >= 0),
  roasted_weight_g bigint check (roasted_weight_g is null or roasted_weight_g > 0),
  roast_loss_pct numeric(6, 2),
  roast_yield_pct numeric(6, 2),
  roast_level text check (roast_level is null or roast_level in ('light', 'medium_light', 'medium', 'medium_dark', 'dark')),
  charge_bt_c numeric(6, 2),
  charge_et_c numeric(6, 2),
  first_crack_seconds integer check (first_crack_seconds is null or first_crack_seconds >= 0),
  first_crack_bt_c numeric(6, 2),
  drop_bt_c numeric(6, 2),
  total_duration_seconds integer check (total_duration_seconds is null or total_duration_seconds > 0),
  development_seconds integer check (development_seconds is null or development_seconds >= 0),
  development_ratio_pct numeric(6, 2),
  green_cost numeric(14, 2),
  production_cost_total numeric(14, 2),
  roasted_cost_per_g numeric(14, 6),
  notes text check (notes is null or char_length(notes) <= 4000),
  idempotency_key text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, batch_number),
  unique (business_id, idempotency_key),
  unique (id, business_id),
  foreign key (roaster_id, business_id) references public.roasters (id, business_id) on delete restrict,
  foreign key (roast_profile_id, business_id) references public.roast_profiles (id, business_id) on delete set null (roast_profile_id),
  foreign key (location_id, business_id) references public.inventory_locations (id, business_id) on delete restrict,
  check (first_crack_seconds is null or total_duration_seconds is null or first_crack_seconds <= total_duration_seconds)
);
create index roast_batches_business_status_idx on public.roast_batches (business_id, status, roast_date desc);
create index roast_batches_business_date_idx on public.roast_batches (business_id, roast_date desc);

create table public.roast_batch_inputs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  roast_batch_id uuid not null,
  green_lot_id uuid not null,
  input_weight_g bigint not null check (input_weight_g > 0),
  allocated_green_cost numeric(14, 2),
  created_at timestamptz not null default now(),
  unique (id, business_id),
  unique (roast_batch_id, green_lot_id),
  foreign key (roast_batch_id, business_id) references public.roast_batches (id, business_id) on delete cascade,
  foreign key (green_lot_id, business_id) references public.green_coffee_lots (id, business_id) on delete restrict
);
create index roast_batch_inputs_lot_idx on public.roast_batch_inputs (green_lot_id);

create table public.roast_measurements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  roast_batch_id uuid not null,
  elapsed_seconds integer not null check (elapsed_seconds >= 0),
  bt_c numeric(6, 2) check (bt_c is null or bt_c between -50 and 400),
  et_c numeric(6, 2) check (et_c is null or et_c between -50 and 500),
  ror_c_per_min numeric(7, 3),
  gas_kpa numeric(7, 3) check (gas_kpa is null or gas_kpa >= 0),
  airflow_pct numeric(5, 2) check (airflow_pct is null or airflow_pct between 0 and 100),
  drum_speed_pct numeric(5, 2) check (drum_speed_pct is null or drum_speed_pct between 0 and 100),
  created_at timestamptz not null default now(),
  unique (roast_batch_id, elapsed_seconds),
  foreign key (roast_batch_id, business_id) references public.roast_batches (id, business_id) on delete cascade
);

create table public.roast_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  roast_batch_id uuid not null,
  event_type public.roast_event_type not null,
  elapsed_seconds integer not null check (elapsed_seconds >= 0),
  temperature_c numeric(6, 2),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  foreign key (roast_batch_id, business_id) references public.roast_batches (id, business_id) on delete cascade
);
create index roast_events_batch_idx on public.roast_events (roast_batch_id, elapsed_seconds);

create table public.roast_batch_costs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  roast_batch_id uuid not null,
  cost_type text not null check (cost_type in ('lpg', 'labor', 'overhead', 'other')),
  amount numeric(14, 2) not null check (amount >= 0),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  foreign key (roast_batch_id, business_id) references public.roast_batches (id, business_id) on delete cascade
);
create index roast_batch_costs_batch_idx on public.roast_batch_costs (roast_batch_id);

create table public.roast_attachments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  roast_batch_id uuid not null,
  storage_path text not null,
  file_name text not null,
  file_type text not null check (file_type in ('artisan_alog', 'artisan_csv', 'image', 'other')),
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  uploaded_by uuid,
  created_at timestamptz not null default now(),
  foreign key (roast_batch_id, business_id) references public.roast_batches (id, business_id) on delete cascade
);
create index roast_attachments_batch_idx on public.roast_attachments (roast_batch_id);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
create trigger set_updated_at before update on public.roast_profiles for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.roast_batches for each row execute function app.set_updated_at();
create trigger audit after insert or update or delete on public.roast_profiles for each row execute function app.audit_row_change();
create trigger audit after insert or update or delete on public.roast_batches for each row execute function app.audit_row_change();
create trigger lock_business before update on public.roast_profiles for each row execute function app.prevent_business_change();
create trigger lock_business before update on public.roast_batches for each row execute function app.prevent_business_change();

-- Completed/voided batches: stock-affecting fields are frozen (only functions may change them with app.posting on).
create or replace function app.roast_batch_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_catalog.current_setting('app.posting', true) = 'on' then
    return new;
  end if;
  if old.status in ('completed', 'voided') then
    if new.status is distinct from old.status
       or new.green_weight_g is distinct from old.green_weight_g
       or new.roasted_weight_g is distinct from old.roasted_weight_g
       or new.roaster_id is distinct from old.roaster_id
       or new.location_id is distinct from old.location_id
       or new.green_cost is distinct from old.green_cost
       or new.production_cost_total is distinct from old.production_cost_total
       or new.roasted_cost_per_g is distinct from old.roasted_cost_per_g
       or new.roast_loss_pct is distinct from old.roast_loss_pct
       or new.roast_yield_pct is distinct from old.roast_yield_pct then
      raise exception 'INVALID_STATE: roast batch % is % and its stock-affecting fields are immutable', old.batch_number, old.status
        using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;
create trigger guard before update on public.roast_batches for each row execute function app.roast_batch_guard();

-- Inputs and costs are editable only while the batch is draft / in progress.
create or replace function app.roast_child_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status public.roast_batch_status;
begin
  if pg_catalog.current_setting('app.posting', true) = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  select status into v_status from public.roast_batches where id = coalesce(new.roast_batch_id, old.roast_batch_id);
  if tg_table_name in ('roast_batch_inputs', 'roast_batch_costs') and v_status not in ('draft', 'in_progress') then
    raise exception 'INVALID_STATE: roast batch is % and cannot be modified', v_status using errcode = '55000';
  end if;
  if tg_table_name in ('roast_measurements', 'roast_events', 'roast_attachments') and v_status = 'voided' then
    raise exception 'INVALID_STATE: roast batch is voided' using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger guard before insert or update or delete on public.roast_batch_inputs for each row execute function app.roast_child_guard();
create trigger guard before insert or update or delete on public.roast_batch_costs for each row execute function app.roast_child_guard();
create trigger guard before insert or update or delete on public.roast_measurements for each row execute function app.roast_child_guard();
create trigger guard before insert or update or delete on public.roast_events for each row execute function app.roast_child_guard();
create trigger guard before insert or update or delete on public.roast_attachments for each row execute function app.roast_child_guard();

-- Keep green_weight_g in sync with inputs while editable.
create or replace function app.recalc_roast_green_weight()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_batch_id uuid := coalesce(new.roast_batch_id, old.roast_batch_id);
begin
  perform set_config('app.posting', 'on', true);
  update public.roast_batches b
  set green_weight_g = coalesce((select sum(input_weight_g) from public.roast_batch_inputs i where i.roast_batch_id = b.id), 0)
  where b.id = v_batch_id;
  perform set_config('app.posting', 'off', true);
  return null;
end;
$$;
create trigger recalc_green after insert or update or delete on public.roast_batch_inputs
  for each row execute function app.recalc_roast_green_weight();

-- -----------------------------------------------------------------------------
-- Functions
-- -----------------------------------------------------------------------------
-- p_inputs: [{ "green_lot_id": uuid, "input_weight_g": int }]
create or replace function app.replace_roast_inputs(p_batch_id uuid, p_business_id uuid, p_inputs jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_input jsonb;
  v_weight bigint;
  v_lot_id uuid;
begin
  if p_inputs is null or jsonb_array_length(p_inputs) = 0 then
    raise exception 'VALIDATION: select at least one green coffee lot' using errcode = '22023';
  end if;
  delete from public.roast_batch_inputs where roast_batch_id = p_batch_id;
  for v_input in select * from jsonb_array_elements(p_inputs) loop
    v_lot_id := (v_input ->> 'green_lot_id')::uuid;
    v_weight := (v_input ->> 'input_weight_g')::bigint;
    if v_weight is null or v_weight <= 0 then
      raise exception 'VALIDATION: input weight must be greater than zero' using errcode = '22023';
    end if;
    if not exists (select 1 from public.green_coffee_lots where id = v_lot_id and business_id = p_business_id) then
      raise exception 'VALIDATION: green lot does not belong to this business' using errcode = '23503';
    end if;
    insert into public.roast_batch_inputs (business_id, roast_batch_id, green_lot_id, input_weight_g)
    values (p_business_id, p_batch_id, v_lot_id, v_weight);
  end loop;
end;
$$;

create or replace function public.create_roast_batch(
  p_business_id uuid,
  p_roaster_id uuid,
  p_roast_profile_id uuid,
  p_location_id uuid,
  p_roast_date date,
  p_operator_id uuid,
  p_inputs jsonb,
  p_notes text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform app.require_permission(p_business_id, 'roasting.manage');
  select id into v_id from public.roast_batches where business_id = p_business_id and idempotency_key = p_idempotency_key;
  if v_id is not null then return v_id; end if;

  if not exists (select 1 from public.roasters where id = p_roaster_id and business_id = p_business_id and is_active) then
    raise exception 'VALIDATION: roaster is not active in this business' using errcode = '23503';
  end if;
  if not exists (select 1 from public.inventory_locations where id = p_location_id and business_id = p_business_id and is_active) then
    raise exception 'VALIDATION: location is not active in this business' using errcode = '23503';
  end if;
  if p_roast_profile_id is not null and not exists (
    select 1 from public.roast_profiles where id = p_roast_profile_id and business_id = p_business_id
  ) then
    raise exception 'VALIDATION: roast profile does not belong to this business' using errcode = '23503';
  end if;

  insert into public.roast_batches (
    business_id, batch_number, roaster_id, roast_profile_id, operator_id, location_id, roast_date, notes, idempotency_key, created_by
  ) values (
    p_business_id, app.next_document_number(p_business_id, 'roast_batch', 'RB'), p_roaster_id, p_roast_profile_id,
    coalesce(p_operator_id, auth.uid()), p_location_id, coalesce(p_roast_date, (now() at time zone 'Asia/Manila')::date),
    p_notes, p_idempotency_key, auth.uid()
  ) returning id into v_id;

  perform app.replace_roast_inputs(v_id, p_business_id, p_inputs);
  return v_id;
end;
$$;

create or replace function public.update_roast_batch_draft(
  p_batch_id uuid,
  p_roaster_id uuid,
  p_roast_profile_id uuid,
  p_location_id uuid,
  p_roast_date date,
  p_operator_id uuid,
  p_inputs jsonb,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.roast_batches%rowtype;
begin
  select * into v_batch from public.roast_batches where id = p_batch_id for update;
  if v_batch.id is null then raise exception 'NOT_FOUND: roast batch' using errcode = 'P0002'; end if;
  perform app.require_permission(v_batch.business_id, 'roasting.manage');
  if v_batch.status not in ('draft', 'in_progress') then
    raise exception 'INVALID_STATE: roast batch is % and cannot be edited', v_batch.status using errcode = '55000';
  end if;
  if not exists (select 1 from public.roasters where id = p_roaster_id and business_id = v_batch.business_id and is_active) then
    raise exception 'VALIDATION: roaster is not active in this business' using errcode = '23503';
  end if;
  if not exists (select 1 from public.inventory_locations where id = p_location_id and business_id = v_batch.business_id and is_active) then
    raise exception 'VALIDATION: location is not active in this business' using errcode = '23503';
  end if;
  update public.roast_batches
  set roaster_id = p_roaster_id, roast_profile_id = p_roast_profile_id, location_id = p_location_id,
      roast_date = coalesce(p_roast_date, roast_date), operator_id = coalesce(p_operator_id, operator_id), notes = p_notes
  where id = v_batch.id;
  perform app.replace_roast_inputs(v_batch.id, v_batch.business_id, p_inputs);
  return v_batch.id;
end;
$$;

create or replace function public.start_roast_batch(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.roast_batches%rowtype;
begin
  select * into v_batch from public.roast_batches where id = p_batch_id for update;
  if v_batch.id is null then raise exception 'NOT_FOUND: roast batch' using errcode = 'P0002'; end if;
  perform app.require_permission(v_batch.business_id, 'roasting.manage');
  if v_batch.status = 'in_progress' then return; end if;
  if v_batch.status <> 'draft' then
    raise exception 'INVALID_STATE: roast batch is %', v_batch.status using errcode = '55000';
  end if;
  if v_batch.green_weight_g <= 0 then
    raise exception 'VALIDATION: add green coffee inputs before starting' using errcode = '22023';
  end if;
  update public.roast_batches set status = 'in_progress', started_at = now() where id = v_batch.id;
end;
$$;

-- Completion: the ONLY path that converts green stock into roasted bulk stock. Atomic + idempotent.
-- p_costs: [{ "cost_type": "lpg"|"labor"|"overhead"|"other", "amount": numeric, "notes": text|null }]
create or replace function public.complete_roast_batch(
  p_batch_id uuid,
  p_roasted_weight_g bigint,
  p_roast_level text,
  p_total_duration_seconds integer,
  p_first_crack_seconds integer,
  p_charge_bt_c numeric,
  p_charge_et_c numeric,
  p_first_crack_bt_c numeric,
  p_drop_bt_c numeric,
  p_costs jsonb,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.roast_batches%rowtype;
  v_roaster public.roasters%rowtype;
  v_input record;
  v_lot_item_id uuid;
  v_roasted_item_id uuid;
  v_green_cost numeric := 0;
  v_line_cost numeric;
  v_other_cost numeric := 0;
  v_cost jsonb;
  v_total numeric;
  v_dev integer;
  v_dev_ratio numeric;
begin
  select * into v_batch from public.roast_batches where id = p_batch_id for update;
  if v_batch.id is null then raise exception 'NOT_FOUND: roast batch' using errcode = 'P0002'; end if;
  perform app.require_permission(v_batch.business_id, 'roasting.manage');

  if v_batch.status = 'completed' then
    return v_batch.id; -- idempotent: already completed, stock untouched
  end if;
  if v_batch.status not in ('draft', 'in_progress') then
    raise exception 'INVALID_STATE: roast batch is % and cannot be completed', v_batch.status using errcode = '55000';
  end if;

  -- Validation
  if v_batch.green_weight_g <= 0 then
    raise exception 'VALIDATION: green weight must be greater than zero' using errcode = '22023';
  end if;
  if p_roasted_weight_g is null or p_roasted_weight_g <= 0 then
    raise exception 'VALIDATION: roasted output must be greater than zero' using errcode = '22023';
  end if;
  if p_roasted_weight_g > v_batch.green_weight_g then
    raise exception 'VALIDATION: roasted output (% g) cannot exceed green input (% g)', p_roasted_weight_g, v_batch.green_weight_g
      using errcode = '22023';
  end if;
  if p_total_duration_seconds is null or p_total_duration_seconds <= 0 then
    raise exception 'VALIDATION: roast duration must be greater than zero' using errcode = '22023';
  end if;
  if p_first_crack_seconds is not null and (p_first_crack_seconds < 0 or p_first_crack_seconds > p_total_duration_seconds) then
    raise exception 'VALIDATION: first crack cannot occur after the roast ends' using errcode = '22023';
  end if;
  if p_roast_level is not null and p_roast_level not in ('light', 'medium_light', 'medium', 'medium_dark', 'dark') then
    raise exception 'VALIDATION: unknown roast level' using errcode = '22023';
  end if;

  select * into v_roaster from public.roasters where id = v_batch.roaster_id;
  if v_roaster.capacity_policy = 'block' and v_batch.green_weight_g > v_roaster.capacity_g then
    raise exception 'VALIDATION: green input (% g) exceeds roaster capacity (% g) and the roaster policy blocks over-capacity batches',
      v_batch.green_weight_g, v_roaster.capacity_g using errcode = '22023';
  end if;

  perform set_config('app.posting', 'on', true);

  -- Replace production costs with the submitted snapshot.
  delete from public.roast_batch_costs where roast_batch_id = v_batch.id;
  if p_costs is not null then
    for v_cost in select * from jsonb_array_elements(p_costs) loop
      if coalesce((v_cost ->> 'amount')::numeric, 0) < 0 then
        raise exception 'VALIDATION: cost amounts cannot be negative' using errcode = '22023';
      end if;
      if coalesce((v_cost ->> 'amount')::numeric, 0) > 0 then
        insert into public.roast_batch_costs (business_id, roast_batch_id, cost_type, amount, notes)
        values (v_batch.business_id, v_batch.id, v_cost ->> 'cost_type', round((v_cost ->> 'amount')::numeric, 2), nullif(v_cost ->> 'notes', ''));
        v_other_cost := v_other_cost + round((v_cost ->> 'amount')::numeric, 2);
      end if;
    end loop;
  end if;

  -- Consume green stock lot by lot (row-locked, non-negative, idempotent keys).
  for v_input in
    select i.id, i.green_lot_id, i.input_weight_g
    from public.roast_batch_inputs i where i.roast_batch_id = v_batch.id order by i.created_at, i.id
  loop
    select id into v_lot_item_id from public.inventory_items
    where business_id = v_batch.business_id and item_type = 'green_coffee_lot' and reference_id = v_input.green_lot_id;
    if v_lot_item_id is null then
      raise exception 'INSUFFICIENT_STOCK: lot has never been received into inventory' using errcode = 'P0001', hint = 'insufficient_stock';
    end if;
    perform app.post_movement(
      v_batch.business_id, v_lot_item_id, v_batch.location_id, -v_input.input_weight_g,
      'roast_consume', 'roast_batch_input', v_input.id, 'roast:' || v_batch.id || ':in:' || v_input.id,
      0, 'Roast ' || v_batch.batch_number, auth.uid()
    );
    v_line_cost := app.consume_cost_layers(v_lot_item_id, v_input.input_weight_g);
    update public.roast_batch_inputs set allocated_green_cost = v_line_cost where id = v_input.id;
    v_green_cost := v_green_cost + v_line_cost;
  end loop;

  v_total := round(v_green_cost + v_other_cost, 2);

  -- Create roasted bulk stock carrying the full production cost.
  v_roasted_item_id := app.ensure_inventory_item(v_batch.business_id, 'roasted_bulk', v_batch.id, 'g');
  perform app.post_movement(
    v_batch.business_id, v_roasted_item_id, v_batch.location_id, p_roasted_weight_g,
    'roast_output', 'roast_batch', v_batch.id, 'roast:' || v_batch.id || ':out',
    v_total, 'Roast ' || v_batch.batch_number, auth.uid()
  );
  perform app.add_cost_layer(v_batch.business_id, v_roasted_item_id, 'roast_batch', v_batch.id, p_roasted_weight_g, v_total, now());

  if p_first_crack_seconds is not null then
    v_dev := p_total_duration_seconds - p_first_crack_seconds;
    v_dev_ratio := round(v_dev::numeric * 100 / p_total_duration_seconds, 2);
  end if;

  update public.roast_batches
  set status = 'completed',
      completed_at = now(),
      started_at = coalesce(started_at, now()),
      roasted_weight_g = p_roasted_weight_g,
      roast_loss_pct = round((green_weight_g - p_roasted_weight_g)::numeric * 100 / green_weight_g, 2),
      roast_yield_pct = round(p_roasted_weight_g::numeric * 100 / green_weight_g, 2),
      roast_level = p_roast_level,
      total_duration_seconds = p_total_duration_seconds,
      first_crack_seconds = p_first_crack_seconds,
      development_seconds = v_dev,
      development_ratio_pct = v_dev_ratio,
      charge_bt_c = p_charge_bt_c,
      charge_et_c = p_charge_et_c,
      first_crack_bt_c = p_first_crack_bt_c,
      drop_bt_c = p_drop_bt_c,
      green_cost = round(v_green_cost, 2),
      production_cost_total = v_total,
      roasted_cost_per_g = round(v_total / p_roasted_weight_g, 6),
      notes = coalesce(p_notes, notes)
  where id = v_batch.id;

  return v_batch.id;
end;
$$;

-- Void: drafts/in-progress just close; completed batches are reversed (roasted stock must be untouched).
create or replace function public.void_roast_batch(p_batch_id uuid, p_reason text, p_idempotency_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.roast_batches%rowtype;
  v_roasted_item_id uuid;
  v_on_hand bigint;
  v_input record;
  v_lot_item_id uuid;
begin
  select * into v_batch from public.roast_batches where id = p_batch_id for update;
  if v_batch.id is null then raise exception 'NOT_FOUND: roast batch' using errcode = 'P0002'; end if;
  perform app.require_permission(v_batch.business_id, 'roasting.manage');
  if v_batch.status = 'voided' then return; end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'VALIDATION: a reason is required to void a roast' using errcode = '22023';
  end if;

  perform set_config('app.posting', 'on', true);

  if v_batch.status = 'completed' then
    select id into v_roasted_item_id from public.inventory_items
    where business_id = v_batch.business_id and item_type = 'roasted_bulk' and reference_id = v_batch.id;
    select coalesce(sum(on_hand_quantity), 0) into v_on_hand from public.inventory_balances where inventory_item_id = v_roasted_item_id;
    if v_on_hand <> v_batch.roasted_weight_g then
      raise exception 'INVALID_STATE: roasted stock from this batch has already been used (% g of % g remain); it cannot be voided',
        v_on_hand, v_batch.roasted_weight_g using errcode = '55000';
    end if;

    -- Remove roasted bulk stock.
    perform app.post_movement(
      v_batch.business_id, v_roasted_item_id, v_batch.location_id, -v_batch.roasted_weight_g,
      'roast_void_consume', 'roast_batch', v_batch.id, 'roast:' || v_batch.id || ':void:out:' || p_idempotency_key,
      0, 'Void ' || v_batch.batch_number || ': ' || p_reason, auth.uid()
    );
    perform app.consume_cost_layers(v_roasted_item_id, v_batch.roasted_weight_g);

    -- Restore green stock with its original allocated cost.
    for v_input in select * from public.roast_batch_inputs where roast_batch_id = v_batch.id loop
      select id into v_lot_item_id from public.inventory_items
      where business_id = v_batch.business_id and item_type = 'green_coffee_lot' and reference_id = v_input.green_lot_id;
      perform app.post_movement(
        v_batch.business_id, v_lot_item_id, v_batch.location_id, v_input.input_weight_g,
        'roast_void_restore', 'roast_batch_input', v_input.id, 'roast:' || v_batch.id || ':void:in:' || v_input.id || ':' || p_idempotency_key,
        coalesce(v_input.allocated_green_cost, 0), 'Void ' || v_batch.batch_number, auth.uid()
      );
      insert into public.inventory_cost_layers (
        business_id, inventory_item_id, source_type, source_id, received_quantity, remaining_quantity, original_cost, remaining_cost, received_at
      ) values (
        v_batch.business_id, v_lot_item_id, 'roast_batch_input_void', v_input.id, v_input.input_weight_g, v_input.input_weight_g,
        coalesce(v_input.allocated_green_cost, 0), coalesce(v_input.allocated_green_cost, 0), now()
      ) on conflict (business_id, source_type, source_id) do nothing;
    end loop;
  end if;

  update public.roast_batches
  set status = 'voided', voided_at = now(), voided_by = auth.uid(), void_reason = p_reason
  where id = v_batch.id;
end;
$$;

revoke all on function public.create_roast_batch(uuid, uuid, uuid, uuid, date, uuid, jsonb, text, text) from public, anon;
revoke all on function public.update_roast_batch_draft(uuid, uuid, uuid, uuid, date, uuid, jsonb, text) from public, anon;
revoke all on function public.start_roast_batch(uuid) from public, anon;
revoke all on function public.complete_roast_batch(uuid, bigint, text, integer, integer, numeric, numeric, numeric, numeric, jsonb, text) from public, anon;
revoke all on function public.void_roast_batch(uuid, text, text) from public, anon;
grant execute on function public.create_roast_batch(uuid, uuid, uuid, uuid, date, uuid, jsonb, text, text) to authenticated, service_role;
grant execute on function public.update_roast_batch_draft(uuid, uuid, uuid, uuid, date, uuid, jsonb, text) to authenticated, service_role;
grant execute on function public.start_roast_batch(uuid) to authenticated, service_role;
grant execute on function public.complete_roast_batch(uuid, bigint, text, integer, integer, numeric, numeric, numeric, numeric, jsonb, text) to authenticated, service_role;
grant execute on function public.void_roast_batch(uuid, text, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.roast_profiles enable row level security;
alter table public.roast_batches enable row level security;
alter table public.roast_batch_inputs enable row level security;
alter table public.roast_measurements enable row level security;
alter table public.roast_events enable row level security;
alter table public.roast_batch_costs enable row level security;
alter table public.roast_attachments enable row level security;

create policy roast_profiles_select on public.roast_profiles for select to authenticated using (app.has_permission(business_id, 'roasting.read'));
create policy roast_profiles_insert on public.roast_profiles for insert to authenticated with check (app.has_permission(business_id, 'roasting.manage'));
create policy roast_profiles_update on public.roast_profiles for update to authenticated using (app.has_permission(business_id, 'roasting.manage')) with check (app.has_permission(business_id, 'roasting.manage'));
create policy roast_profiles_delete on public.roast_profiles for delete to authenticated using (app.member_role(business_id) = 'owner');

create policy roast_batches_select on public.roast_batches for select to authenticated using (app.has_permission(business_id, 'roasting.read'));
-- notes/profile/operator on non-final batches may be edited directly; status & stock fields are guarded by trigger + functions.
create policy roast_batches_update on public.roast_batches for update to authenticated
  using (app.has_permission(business_id, 'roasting.manage')) with check (app.has_permission(business_id, 'roasting.manage'));
create policy roast_batches_delete on public.roast_batches for delete to authenticated
  using (app.has_permission(business_id, 'roasting.manage') and status = 'draft');

create policy roast_batch_inputs_select on public.roast_batch_inputs for select to authenticated using (app.has_permission(business_id, 'roasting.read'));

do $$
declare t text;
begin
  foreach t in array array['roast_measurements', 'roast_events', 'roast_batch_costs', 'roast_attachments'] loop
    execute format('create policy %I_select on public.%I for select to authenticated using (app.has_permission(business_id, %L))', t, t, 'roasting.read');
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (app.has_permission(business_id, %L))', t, t, 'roasting.manage');
    execute format('create policy %I_update on public.%I for update to authenticated using (app.has_permission(business_id, %L)) with check (app.has_permission(business_id, %L))', t, t, 'roasting.manage', 'roasting.manage');
    execute format('create policy %I_delete on public.%I for delete to authenticated using (app.has_permission(business_id, %L))', t, t, 'roasting.manage');
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Storage bucket for roast attachments (Artisan logs, screenshots)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('roast-attachments', 'roast-attachments', false, 10485760,
        array['image/png', 'image/jpeg', 'image/webp', 'text/csv', 'text/plain', 'application/octet-stream', 'application/json'])
on conflict (id) do nothing;

-- Objects are stored under <business_id>/<batch_id>/<file>. Access follows roasting permissions.
create policy roast_attachments_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'roast-attachments' and app.has_permission((storage.foldername(name))[1]::uuid, 'roasting.read'));
create policy roast_attachments_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'roast-attachments' and app.has_permission((storage.foldername(name))[1]::uuid, 'roasting.manage'));
create policy roast_attachments_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'roast-attachments' and app.has_permission((storage.foldername(name))[1]::uuid, 'roasting.manage'));

-- -----------------------------------------------------------------------------
-- Views
-- -----------------------------------------------------------------------------
create view public.roast_batch_summary_view
with (security_invoker = true)
as
select
  b.id,
  b.business_id,
  b.batch_number,
  b.status,
  b.roast_date,
  b.started_at,
  b.completed_at,
  b.roaster_id,
  r.name as roaster_name,
  r.capacity_g as roaster_capacity_g,
  b.roast_profile_id,
  p.name as profile_name,
  b.operator_id,
  op.full_name as operator_name,
  b.location_id,
  loc.name as location_name,
  b.green_weight_g,
  b.roasted_weight_g,
  b.roast_loss_pct,
  b.roast_yield_pct,
  b.roast_level,
  b.total_duration_seconds,
  b.first_crack_seconds,
  b.development_seconds,
  b.development_ratio_pct,
  b.green_cost,
  b.production_cost_total,
  b.roasted_cost_per_g,
  case when b.roasted_cost_per_g is not null then round(b.roasted_cost_per_g * 1000, 2) end::numeric(14, 2) as roasted_cost_per_kg,
  inp.lot_count,
  inp.coffee_names,
  inp.lot_codes,
  ii.id as roasted_item_id,
  coalesce(rb.on_hand, 0)::bigint as roasted_on_hand_g,
  coalesce(rb.reserved, 0)::bigint as roasted_reserved_g,
  (coalesce(rb.on_hand, 0) - coalesce(rb.reserved, 0))::bigint as roasted_available_g,
  coalesce(cl.remaining_cost, 0)::numeric(14, 2) as roasted_stock_value
from public.roast_batches b
join public.roasters r on r.id = b.roaster_id
left join public.roast_profiles p on p.id = b.roast_profile_id
left join public.user_profiles op on op.id = b.operator_id
join public.inventory_locations loc on loc.id = b.location_id
left join lateral (
  select count(*) as lot_count,
         string_agg(distinct gc.name, ', ' order by gc.name) as coffee_names,
         string_agg(l.lot_code, ', ' order by l.lot_code) as lot_codes
  from public.roast_batch_inputs i
  join public.green_coffee_lots l on l.id = i.green_lot_id
  join public.green_coffees gc on gc.id = l.green_coffee_id
  where i.roast_batch_id = b.id
) inp on true
left join public.inventory_items ii on ii.item_type = 'roasted_bulk' and ii.reference_id = b.id
left join lateral (
  select sum(on_hand_quantity) as on_hand, sum(reserved_quantity) as reserved
  from public.inventory_balances ib where ib.inventory_item_id = ii.id
) rb on true
left join lateral (
  select sum(remaining_cost) as remaining_cost from public.inventory_cost_layers c where c.inventory_item_id = ii.id
) cl on true;

grant select on public.roast_batch_summary_view to authenticated, service_role;
