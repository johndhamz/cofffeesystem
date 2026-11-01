-- =============================================================================
-- Phase 4: Products, packaging materials, packaging sessions, finished goods.
-- Completion atomically consumes roasted bulk + packaging materials and creates
-- finished-goods lots (one per output line) through the shared ledger.
-- =============================================================================

create type public.packaging_session_status as enum ('draft', 'completed', 'voided');
alter type public.inventory_movement_type add value if not exists 'pack_void_consume';
alter type public.inventory_movement_type add value if not exists 'pack_void_restore';

-- -----------------------------------------------------------------------------
-- Products
-- -----------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text check (description is null or char_length(description) <= 2000),
  category text check (category is null or category in ('single_origin', 'blend', 'decaf', 'other')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id)
);
create unique index products_business_name_key on public.products (business_id, lower(btrim(name)));

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  product_id uuid not null,
  sku text not null check (char_length(btrim(sku)) between 1 and 60),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  net_weight_g integer not null check (net_weight_g > 0),
  packaging_type text not null default 'bag' check (packaging_type in ('bag', 'jar', 'box', 'sachet', 'drip_bag', 'other')),
  selling_price numeric(14, 2) not null default 0 check (selling_price >= 0),
  wholesale_price numeric(14, 2) check (wholesale_price is null or wholesale_price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id),
  foreign key (product_id, business_id) references public.products (id, business_id) on delete cascade
);
create unique index product_variants_sku_key on public.product_variants (business_id, lower(btrim(sku)));
create index product_variants_product_idx on public.product_variants (product_id);

-- -----------------------------------------------------------------------------
-- Packaging materials (stock tracked in the ledger as packaging_material items)
-- -----------------------------------------------------------------------------
create table public.packaging_materials (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  sku text check (sku is null or char_length(btrim(sku)) <= 60),
  base_unit text not null default 'pc' check (base_unit in ('pc', 'g', 'ml')),
  reorder_level bigint not null default 0 check (reorder_level >= 0),
  -- standard cost per base unit, used when no cost layers exist for the material
  standard_unit_cost numeric(14, 6) not null default 0 check (standard_unit_cost >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id)
);
create unique index packaging_materials_name_key on public.packaging_materials (business_id, lower(btrim(name)));
create unique index packaging_materials_sku_key on public.packaging_materials (business_id, lower(btrim(sku))) where sku is not null;

-- Bill of materials: packaging materials needed per finished unit of a variant.
create table public.variant_materials (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  variant_id uuid not null,
  material_id uuid not null,
  quantity_per_unit bigint not null check (quantity_per_unit > 0),
  created_at timestamptz not null default now(),
  unique (variant_id, material_id),
  foreign key (variant_id, business_id) references public.product_variants (id, business_id) on delete cascade,
  foreign key (material_id, business_id) references public.packaging_materials (id, business_id) on delete restrict
);

-- -----------------------------------------------------------------------------
-- Packaging sessions
-- -----------------------------------------------------------------------------
create table public.packaging_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  session_number text not null,
  status public.packaging_session_status not null default 'draft',
  operator_id uuid references public.user_profiles (id) on delete set null,
  location_id uuid not null,
  packaged_at date not null default (now() at time zone 'Asia/Manila')::date,
  completed_at timestamptz,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text,
  labor_cost numeric(14, 2) not null default 0 check (labor_cost >= 0),
  overhead_cost numeric(14, 2) not null default 0 check (overhead_cost >= 0),
  -- snapshots at completion
  coffee_cost numeric(14, 2),
  material_cost numeric(14, 2),
  total_cost numeric(14, 2),
  required_weight_g bigint,
  input_weight_g bigint,
  notes text check (notes is null or char_length(notes) <= 4000),
  idempotency_key text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, session_number),
  unique (business_id, idempotency_key),
  unique (id, business_id),
  foreign key (location_id, business_id) references public.inventory_locations (id, business_id) on delete restrict
);
create index packaging_sessions_business_idx on public.packaging_sessions (business_id, status, packaged_at desc);

create table public.packaging_inputs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  session_id uuid not null,
  roast_batch_id uuid not null,
  input_weight_g bigint not null check (input_weight_g > 0),
  inherited_cost numeric(14, 2),
  created_at timestamptz not null default now(),
  unique (session_id, roast_batch_id),
  foreign key (session_id, business_id) references public.packaging_sessions (id, business_id) on delete cascade,
  foreign key (roast_batch_id, business_id) references public.roast_batches (id, business_id) on delete restrict
);
create index packaging_inputs_batch_idx on public.packaging_inputs (roast_batch_id);

create table public.finished_goods_lots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  variant_id uuid not null,
  packaging_session_id uuid,
  lot_code text not null check (char_length(btrim(lot_code)) between 1 and 60),
  packaged_at date not null,
  best_before_at date,
  quantity integer not null check (quantity > 0),
  unit_cost numeric(14, 6) not null check (unit_cost >= 0),
  total_cost numeric(14, 2) not null check (total_cost >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id),
  foreign key (variant_id, business_id) references public.product_variants (id, business_id) on delete restrict,
  foreign key (packaging_session_id, business_id) references public.packaging_sessions (id, business_id) on delete restrict
);
create unique index finished_goods_lots_code_key on public.finished_goods_lots (business_id, lower(btrim(lot_code)));
create index finished_goods_lots_variant_idx on public.finished_goods_lots (variant_id);

create table public.packaging_outputs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  session_id uuid not null,
  variant_id uuid not null,
  finished_lot_id uuid,
  quantity integer not null check (quantity > 0),
  lot_code text,
  best_before_at date,
  unit_cost numeric(14, 6),
  total_cost numeric(14, 2),
  created_at timestamptz not null default now(),
  unique (id, business_id),
  foreign key (session_id, business_id) references public.packaging_sessions (id, business_id) on delete cascade,
  foreign key (variant_id, business_id) references public.product_variants (id, business_id) on delete restrict,
  foreign key (finished_lot_id, business_id) references public.finished_goods_lots (id, business_id) on delete restrict
);
create index packaging_outputs_session_idx on public.packaging_outputs (session_id);

create table public.packaging_material_usage (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  session_id uuid not null,
  material_id uuid not null,
  quantity bigint not null check (quantity > 0),
  cost numeric(14, 2),
  created_at timestamptz not null default now(),
  unique (session_id, material_id),
  foreign key (session_id, business_id) references public.packaging_sessions (id, business_id) on delete cascade,
  foreign key (material_id, business_id) references public.packaging_materials (id, business_id) on delete restrict
);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
create trigger set_updated_at before update on public.products for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.product_variants for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.packaging_materials for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.packaging_sessions for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.finished_goods_lots for each row execute function app.set_updated_at();
create trigger audit after insert or update or delete on public.products for each row execute function app.audit_row_change();
create trigger audit after insert or update or delete on public.product_variants for each row execute function app.audit_row_change();
create trigger audit after insert or update or delete on public.packaging_materials for each row execute function app.audit_row_change();
create trigger audit after insert or update or delete on public.packaging_sessions for each row execute function app.audit_row_change();
create trigger audit after insert or update or delete on public.finished_goods_lots for each row execute function app.audit_row_change();
create trigger lock_business before update on public.products for each row execute function app.prevent_business_change();
create trigger lock_business before update on public.product_variants for each row execute function app.prevent_business_change();
create trigger lock_business before update on public.packaging_materials for each row execute function app.prevent_business_change();
create trigger lock_business before update on public.packaging_sessions for each row execute function app.prevent_business_change();

-- Every packaging material gets a ledger item on creation so stock can be received via adjustments.
create or replace function app.ensure_material_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.ensure_inventory_item(new.business_id, 'packaging_material', new.id, new.base_unit);
  return new;
end;
$$;
create trigger ensure_item after insert on public.packaging_materials for each row execute function app.ensure_material_item();

-- Completed/voided sessions: stock-affecting fields frozen.
create or replace function app.packaging_session_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_catalog.current_setting('app.posting', true) = 'on' then return new; end if;
  if old.status in ('completed', 'voided') then
    if new.status is distinct from old.status
       or new.labor_cost is distinct from old.labor_cost
       or new.overhead_cost is distinct from old.overhead_cost
       or new.location_id is distinct from old.location_id
       or new.total_cost is distinct from old.total_cost
       or new.coffee_cost is distinct from old.coffee_cost
       or new.material_cost is distinct from old.material_cost then
      raise exception 'INVALID_STATE: packaging session % is % and its stock-affecting fields are immutable', old.session_number, old.status using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;
create trigger guard before update on public.packaging_sessions for each row execute function app.packaging_session_guard();

create or replace function app.packaging_child_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare v_status public.packaging_session_status;
begin
  if pg_catalog.current_setting('app.posting', true) = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  select status into v_status from public.packaging_sessions where id = coalesce(new.session_id, old.session_id);
  if v_status <> 'draft' then
    raise exception 'INVALID_STATE: packaging session is % and cannot be modified', v_status using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger guard before insert or update or delete on public.packaging_inputs for each row execute function app.packaging_child_guard();
create trigger guard before insert or update or delete on public.packaging_outputs for each row execute function app.packaging_child_guard();
create trigger guard before insert or update or delete on public.packaging_material_usage for each row execute function app.packaging_child_guard();

create trigger forbid_delete_posted before delete on public.packaging_sessions for each row execute function app.forbid_delete_when_posted();

-- -----------------------------------------------------------------------------
-- Functions
-- -----------------------------------------------------------------------------
-- p_inputs:    [{ "roast_batch_id": uuid, "input_weight_g": int }]
-- p_outputs:   [{ "variant_id": uuid, "quantity": int, "lot_code": text|null, "best_before_at": date|null }]
-- p_materials: [{ "material_id": uuid, "quantity": int }] | null  (null = derive from the variants' bill of materials)
create or replace function app.replace_packaging_lines(p_session_id uuid, p_business_id uuid, p_inputs jsonb, p_outputs jsonb, p_materials jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_line jsonb;
  v_required bigint := 0;
  v_input bigint := 0;
  v_qty bigint;
  v_weight bigint;
  v_variant public.product_variants%rowtype;
begin
  if p_inputs is null or jsonb_array_length(p_inputs) = 0 then
    raise exception 'VALIDATION: select at least one roast batch' using errcode = '22023';
  end if;
  if p_outputs is null or jsonb_array_length(p_outputs) = 0 then
    raise exception 'VALIDATION: add at least one product output' using errcode = '22023';
  end if;

  delete from public.packaging_inputs where session_id = p_session_id;
  delete from public.packaging_outputs where session_id = p_session_id;
  delete from public.packaging_material_usage where session_id = p_session_id;

  for v_line in select * from jsonb_array_elements(p_inputs) loop
    v_weight := (v_line ->> 'input_weight_g')::bigint;
    if v_weight is null or v_weight <= 0 then
      raise exception 'VALIDATION: input weight must be greater than zero' using errcode = '22023';
    end if;
    if not exists (select 1 from public.roast_batches where id = (v_line ->> 'roast_batch_id')::uuid and business_id = p_business_id and status = 'completed') then
      raise exception 'VALIDATION: roast batch is not a completed batch of this business' using errcode = '23503';
    end if;
    insert into public.packaging_inputs (business_id, session_id, roast_batch_id, input_weight_g)
    values (p_business_id, p_session_id, (v_line ->> 'roast_batch_id')::uuid, v_weight);
    v_input := v_input + v_weight;
  end loop;

  for v_line in select * from jsonb_array_elements(p_outputs) loop
    v_qty := (v_line ->> 'quantity')::bigint;
    if v_qty is null or v_qty <= 0 then
      raise exception 'VALIDATION: quantity must be a positive integer' using errcode = '22023';
    end if;
    select * into v_variant from public.product_variants where id = (v_line ->> 'variant_id')::uuid and business_id = p_business_id and is_active;
    if v_variant.id is null then
      raise exception 'VALIDATION: product variant is not active in this business' using errcode = '23503';
    end if;
    insert into public.packaging_outputs (business_id, session_id, variant_id, quantity, lot_code, best_before_at)
    values (p_business_id, p_session_id, v_variant.id, v_qty, nullif(btrim(coalesce(v_line ->> 'lot_code', '')), ''), nullif(v_line ->> 'best_before_at', '')::date);
    v_required := v_required + v_qty * v_variant.net_weight_g;
  end loop;

  if v_input < v_required then
    raise exception 'VALIDATION: roasted input (% g) is less than the coffee required for the outputs (% g)', v_input, v_required using errcode = '22023';
  end if;

  if p_materials is null then
    -- derive from bill of materials
    insert into public.packaging_material_usage (business_id, session_id, material_id, quantity)
    select p_business_id, p_session_id, vm.material_id, sum(vm.quantity_per_unit * o.quantity)
    from public.packaging_outputs o
    join public.variant_materials vm on vm.variant_id = o.variant_id
    where o.session_id = p_session_id
    group by vm.material_id;
  else
    for v_line in select * from jsonb_array_elements(p_materials) loop
      v_qty := (v_line ->> 'quantity')::bigint;
      if v_qty is null or v_qty < 0 then
        raise exception 'VALIDATION: material quantity cannot be negative' using errcode = '22023';
      end if;
      if v_qty = 0 then continue; end if;
      if not exists (select 1 from public.packaging_materials where id = (v_line ->> 'material_id')::uuid and business_id = p_business_id and is_active) then
        raise exception 'VALIDATION: packaging material is not active in this business' using errcode = '23503';
      end if;
      insert into public.packaging_material_usage (business_id, session_id, material_id, quantity)
      values (p_business_id, p_session_id, (v_line ->> 'material_id')::uuid, v_qty)
      on conflict (session_id, material_id) do update set quantity = public.packaging_material_usage.quantity + excluded.quantity;
    end loop;
  end if;

  perform set_config('app.posting', 'on', true);
  update public.packaging_sessions set required_weight_g = v_required, input_weight_g = v_input where id = p_session_id;
  perform set_config('app.posting', 'off', true);
end;
$$;

create or replace function public.create_packaging_session(
  p_business_id uuid,
  p_location_id uuid,
  p_packaged_at date,
  p_operator_id uuid,
  p_inputs jsonb,
  p_outputs jsonb,
  p_materials jsonb,
  p_labor_cost numeric,
  p_overhead_cost numeric,
  p_notes text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  perform app.require_permission(p_business_id, 'packaging.manage');
  select id into v_id from public.packaging_sessions where business_id = p_business_id and idempotency_key = p_idempotency_key;
  if v_id is not null then return v_id; end if;
  if not exists (select 1 from public.inventory_locations where id = p_location_id and business_id = p_business_id and is_active) then
    raise exception 'VALIDATION: location is not active in this business' using errcode = '23503';
  end if;
  insert into public.packaging_sessions (business_id, session_number, operator_id, location_id, packaged_at, labor_cost, overhead_cost, notes, idempotency_key, created_by)
  values (p_business_id, app.next_document_number(p_business_id, 'packaging_session', 'PK'), coalesce(p_operator_id, auth.uid()), p_location_id,
          coalesce(p_packaged_at, (now() at time zone 'Asia/Manila')::date), coalesce(round(p_labor_cost, 2), 0), coalesce(round(p_overhead_cost, 2), 0),
          p_notes, p_idempotency_key, auth.uid())
  returning id into v_id;
  perform app.replace_packaging_lines(v_id, p_business_id, p_inputs, p_outputs, p_materials);
  return v_id;
end;
$$;

create or replace function public.update_packaging_session_draft(
  p_session_id uuid,
  p_location_id uuid,
  p_packaged_at date,
  p_operator_id uuid,
  p_inputs jsonb,
  p_outputs jsonb,
  p_materials jsonb,
  p_labor_cost numeric,
  p_overhead_cost numeric,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_s public.packaging_sessions%rowtype;
begin
  select * into v_s from public.packaging_sessions where id = p_session_id for update;
  if v_s.id is null then raise exception 'NOT_FOUND: packaging session' using errcode = 'P0002'; end if;
  perform app.require_permission(v_s.business_id, 'packaging.manage');
  if v_s.status <> 'draft' then
    raise exception 'INVALID_STATE: packaging session is % and cannot be edited', v_s.status using errcode = '55000';
  end if;
  update public.packaging_sessions
  set location_id = p_location_id, packaged_at = coalesce(p_packaged_at, packaged_at), operator_id = coalesce(p_operator_id, operator_id),
      labor_cost = coalesce(round(p_labor_cost, 2), 0), overhead_cost = coalesce(round(p_overhead_cost, 2), 0), notes = p_notes
  where id = v_s.id;
  perform app.replace_packaging_lines(v_s.id, v_s.business_id, p_inputs, p_outputs, p_materials);
  return v_s.id;
end;
$$;

-- Completion: consume roasted bulk + materials, create finished lots. Atomic + idempotent.
create or replace function public.complete_packaging_session(p_session_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.packaging_sessions%rowtype;
  v_in record;
  v_mat record;
  v_out record;
  v_item uuid;
  v_cost numeric;
  v_coffee_cost numeric := 0;
  v_material_cost numeric := 0;
  v_total numeric;
  v_total_c bigint;        -- total cost in centavos for exact allocation
  v_alloc_c bigint;
  v_allocated_c bigint := 0;
  v_weight_total bigint := 0;
  v_out_count integer;
  v_i integer := 0;
  v_lot_id uuid;
  v_lot_code text;
  v_std numeric;
begin
  select * into v_s from public.packaging_sessions where id = p_session_id for update;
  if v_s.id is null then raise exception 'NOT_FOUND: packaging session' using errcode = 'P0002'; end if;
  perform app.require_permission(v_s.business_id, 'packaging.manage');
  if v_s.status = 'completed' then return v_s.id; end if;
  if v_s.status <> 'draft' then
    raise exception 'INVALID_STATE: packaging session is %', v_s.status using errcode = '55000';
  end if;
  if not exists (select 1 from public.packaging_inputs where session_id = v_s.id) or not exists (select 1 from public.packaging_outputs where session_id = v_s.id) then
    raise exception 'VALIDATION: a session needs inputs and outputs' using errcode = '22023';
  end if;

  perform set_config('app.posting', 'on', true);

  -- 1. Consume roasted bulk per batch (lineage preserved on packaging_inputs).
  for v_in in select * from public.packaging_inputs where session_id = v_s.id order by created_at, id loop
    select id into v_item from public.inventory_items where business_id = v_s.business_id and item_type = 'roasted_bulk' and reference_id = v_in.roast_batch_id;
    if v_item is null then
      raise exception 'INSUFFICIENT_STOCK: roast batch has no roasted stock' using errcode = 'P0001', hint = 'insufficient_stock';
    end if;
    perform app.post_movement(v_s.business_id, v_item, v_s.location_id, -v_in.input_weight_g, 'pack_consume', 'packaging_input', v_in.id,
      'pack:' || v_s.id || ':in:' || v_in.id, 0, 'Packaging ' || v_s.session_number, auth.uid());
    v_cost := app.consume_cost_layers(v_item, v_in.input_weight_g);
    update public.packaging_inputs set inherited_cost = round(v_cost, 2) where id = v_in.id;
    v_coffee_cost := v_coffee_cost + round(v_cost, 2);
  end loop;

  -- 2. Consume packaging materials.
  for v_mat in
    select u.*, m.standard_unit_cost from public.packaging_material_usage u join public.packaging_materials m on m.id = u.material_id
    where u.session_id = v_s.id order by u.created_at, u.id
  loop
    v_item := app.ensure_inventory_item(v_s.business_id, 'packaging_material', v_mat.material_id, (select base_unit from public.packaging_materials where id = v_mat.material_id));
    perform app.post_movement(v_s.business_id, v_item, v_s.location_id, -v_mat.quantity, 'pack_consume', 'packaging_material_usage', v_mat.id,
      'pack:' || v_s.id || ':mat:' || v_mat.id, 0, 'Packaging ' || v_s.session_number, auth.uid());
    v_cost := app.consume_cost_layers(v_item, v_mat.quantity);
    if v_cost = 0 then
      v_cost := round(v_mat.standard_unit_cost * v_mat.quantity, 2);
    end if;
    update public.packaging_material_usage set cost = round(v_cost, 2) where id = v_mat.id;
    v_material_cost := v_material_cost + round(v_cost, 2);
  end loop;

  v_total := round(v_coffee_cost + v_material_cost + v_s.labor_cost + v_s.overhead_cost, 2);
  v_total_c := round(v_total * 100)::bigint;

  -- 3. Create finished lots; allocate total cost by coffee weight with exact centavo remainder on the last line.
  select coalesce(sum(o.quantity * pv.net_weight_g), 0), count(*) into v_weight_total, v_out_count
  from public.packaging_outputs o join public.product_variants pv on pv.id = o.variant_id where o.session_id = v_s.id;

  for v_out in
    select o.*, pv.net_weight_g, pv.sku from public.packaging_outputs o join public.product_variants pv on pv.id = o.variant_id
    where o.session_id = v_s.id order by o.created_at, o.id
  loop
    v_i := v_i + 1;
    if v_i = v_out_count then
      v_alloc_c := v_total_c - v_allocated_c;
    else
      v_alloc_c := round(v_total_c::numeric * (v_out.quantity * v_out.net_weight_g) / v_weight_total)::bigint;
    end if;
    v_allocated_c := v_allocated_c + v_alloc_c;

    v_lot_code := coalesce(v_out.lot_code, app.next_document_number(v_s.business_id, 'finished_lot', 'FG'));
    insert into public.finished_goods_lots (business_id, variant_id, packaging_session_id, lot_code, packaged_at, best_before_at, quantity, unit_cost, total_cost)
    values (v_s.business_id, v_out.variant_id, v_s.id, v_lot_code, v_s.packaged_at, v_out.best_before_at, v_out.quantity,
            round(v_alloc_c::numeric / 100 / v_out.quantity, 6), v_alloc_c::numeric / 100)
    returning id into v_lot_id;

    update public.packaging_outputs set finished_lot_id = v_lot_id, lot_code = v_lot_code, unit_cost = round(v_alloc_c::numeric / 100 / v_out.quantity, 6), total_cost = v_alloc_c::numeric / 100
    where id = v_out.id;

    v_item := app.ensure_inventory_item(v_s.business_id, 'finished_product', v_lot_id, 'unit');
    perform app.post_movement(v_s.business_id, v_item, v_s.location_id, v_out.quantity, 'pack_output', 'packaging_output', v_out.id,
      'pack:' || v_s.id || ':out:' || v_out.id, v_alloc_c::numeric / 100, 'Packaging ' || v_s.session_number, auth.uid());
    perform app.add_cost_layer(v_s.business_id, v_item, 'packaging_output', v_out.id, v_out.quantity, v_alloc_c::numeric / 100, now());
  end loop;

  update public.packaging_sessions
  set status = 'completed', completed_at = now(), coffee_cost = round(v_coffee_cost, 2), material_cost = round(v_material_cost, 2), total_cost = v_total
  where id = v_s.id;
  return v_s.id;
end;
$$;

create or replace function public.void_packaging_session(p_session_id uuid, p_reason text, p_idempotency_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.packaging_sessions%rowtype;
  v_out record;
  v_in record;
  v_mat record;
  v_item uuid;
  v_on_hand bigint;
begin
  select * into v_s from public.packaging_sessions where id = p_session_id for update;
  if v_s.id is null then raise exception 'NOT_FOUND: packaging session' using errcode = 'P0002'; end if;
  perform app.require_permission(v_s.business_id, 'packaging.manage');
  if v_s.status = 'voided' then return; end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'VALIDATION: a reason is required to void a packaging session' using errcode = '22023';
  end if;
  perform set_config('app.posting', 'on', true);

  if v_s.status = 'completed' then
    -- every finished lot must be fully on hand
    for v_out in select * from public.packaging_outputs where session_id = v_s.id loop
      select id into v_item from public.inventory_items where item_type = 'finished_product' and reference_id = v_out.finished_lot_id;
      select coalesce(sum(on_hand_quantity), 0) into v_on_hand from public.inventory_balances where inventory_item_id = v_item;
      if v_on_hand <> v_out.quantity then
        raise exception 'INVALID_STATE: finished lot % has been sold or moved (% of % units remain); the session cannot be voided', v_out.lot_code, v_on_hand, v_out.quantity using errcode = '55000';
      end if;
      perform app.post_movement(v_s.business_id, v_item, v_s.location_id, -v_out.quantity, 'pack_void_consume', 'packaging_output', v_out.id,
        'pack:' || v_s.id || ':void:out:' || v_out.id || ':' || p_idempotency_key, 0, 'Void ' || v_s.session_number || ': ' || p_reason, auth.uid());
      perform app.consume_cost_layers(v_item, v_out.quantity);
    end loop;
    for v_in in select * from public.packaging_inputs where session_id = v_s.id loop
      select id into v_item from public.inventory_items where item_type = 'roasted_bulk' and reference_id = v_in.roast_batch_id;
      perform app.post_movement(v_s.business_id, v_item, v_s.location_id, v_in.input_weight_g, 'pack_void_restore', 'packaging_input', v_in.id,
        'pack:' || v_s.id || ':void:in:' || v_in.id || ':' || p_idempotency_key, coalesce(v_in.inherited_cost, 0), 'Void ' || v_s.session_number, auth.uid());
      insert into public.inventory_cost_layers (business_id, inventory_item_id, source_type, source_id, received_quantity, remaining_quantity, original_cost, remaining_cost, received_at)
      values (v_s.business_id, v_item, 'packaging_input_void', v_in.id, v_in.input_weight_g, v_in.input_weight_g, coalesce(v_in.inherited_cost, 0), coalesce(v_in.inherited_cost, 0), now())
      on conflict (business_id, source_type, source_id) do nothing;
    end loop;
    for v_mat in select * from public.packaging_material_usage where session_id = v_s.id loop
      select id into v_item from public.inventory_items where item_type = 'packaging_material' and reference_id = v_mat.material_id;
      perform app.post_movement(v_s.business_id, v_item, v_s.location_id, v_mat.quantity, 'pack_void_restore', 'packaging_material_usage', v_mat.id,
        'pack:' || v_s.id || ':void:mat:' || v_mat.id || ':' || p_idempotency_key, coalesce(v_mat.cost, 0), 'Void ' || v_s.session_number, auth.uid());
      insert into public.inventory_cost_layers (business_id, inventory_item_id, source_type, source_id, received_quantity, remaining_quantity, original_cost, remaining_cost, received_at)
      values (v_s.business_id, v_item, 'packaging_material_void', v_mat.id, v_mat.quantity, v_mat.quantity, coalesce(v_mat.cost, 0), coalesce(v_mat.cost, 0), now())
      on conflict (business_id, source_type, source_id) do nothing;
    end loop;
  end if;

  update public.packaging_sessions set status = 'voided', voided_at = now(), voided_by = auth.uid(), void_reason = p_reason where id = v_s.id;
end;
$$;

revoke all on function public.create_packaging_session(uuid, uuid, date, uuid, jsonb, jsonb, jsonb, numeric, numeric, text, text) from public, anon;
revoke all on function public.update_packaging_session_draft(uuid, uuid, date, uuid, jsonb, jsonb, jsonb, numeric, numeric, text) from public, anon;
revoke all on function public.complete_packaging_session(uuid) from public, anon;
revoke all on function public.void_packaging_session(uuid, text, text) from public, anon;
grant execute on function public.create_packaging_session(uuid, uuid, date, uuid, jsonb, jsonb, jsonb, numeric, numeric, text, text) to authenticated, service_role;
grant execute on function public.update_packaging_session_draft(uuid, uuid, date, uuid, jsonb, jsonb, jsonb, numeric, numeric, text) to authenticated, service_role;
grant execute on function public.complete_packaging_session(uuid) to authenticated, service_role;
grant execute on function public.void_packaging_session(uuid, text, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
do $$
declare t record;
begin
  for t in select * from (values
      ('products', 'products.read', 'products.manage'),
      ('product_variants', 'products.read', 'products.manage'),
      ('packaging_materials', 'packaging.read', 'packaging.manage'),
      ('variant_materials', 'products.read', 'products.manage')
    ) as v(tbl, rperm, wperm)
  loop
    execute format('alter table public.%I enable row level security', t.tbl);
    execute format('create policy %I_select on public.%I for select to authenticated using (app.has_permission(business_id, %L))', t.tbl, t.tbl, t.rperm);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (app.has_permission(business_id, %L))', t.tbl, t.tbl, t.wperm);
    execute format('create policy %I_update on public.%I for update to authenticated using (app.has_permission(business_id, %L)) with check (app.has_permission(business_id, %L))', t.tbl, t.tbl, t.wperm, t.wperm);
    execute format('create policy %I_delete on public.%I for delete to authenticated using (app.has_permission(business_id, %L))', t.tbl, t.tbl, t.wperm);
  end loop;
  for t in select * from (values
      ('packaging_sessions', 'packaging.read'), ('packaging_inputs', 'packaging.read'), ('packaging_outputs', 'packaging.read'),
      ('packaging_material_usage', 'packaging.read'), ('finished_goods_lots', 'inventory.read')
    ) as v(tbl, rperm)
  loop
    execute format('alter table public.%I enable row level security', t.tbl);
    execute format('create policy %I_select on public.%I for select to authenticated using (app.has_permission(business_id, %L))', t.tbl, t.tbl, t.rperm);
  end loop;
end;
$$;
create policy packaging_sessions_update on public.packaging_sessions for update to authenticated
  using (app.has_permission(business_id, 'packaging.manage')) with check (app.has_permission(business_id, 'packaging.manage'));
create policy packaging_sessions_delete on public.packaging_sessions for delete to authenticated
  using (app.has_permission(business_id, 'packaging.manage') and status = 'draft');
create policy finished_goods_lots_update on public.finished_goods_lots for update to authenticated
  using (app.has_permission(business_id, 'packaging.manage')) with check (app.has_permission(business_id, 'packaging.manage'));

-- -----------------------------------------------------------------------------
-- Views
-- -----------------------------------------------------------------------------
create view public.packaging_material_inventory_view
with (security_invoker = true)
as
select
  m.id as material_id, m.business_id, m.name, m.sku, m.base_unit, m.reorder_level, m.standard_unit_cost, m.is_active,
  ii.id as inventory_item_id,
  coalesce(b.on_hand, 0)::bigint as on_hand,
  coalesce(b.reserved, 0)::bigint as reserved,
  (coalesce(b.on_hand, 0) - coalesce(b.reserved, 0))::bigint as available,
  coalesce(cl.remaining_cost, 0)::numeric(14, 2) as stock_value,
  case when coalesce(b.on_hand, 0) <= 0 then 'out_of_stock'
       when m.reorder_level > 0 and coalesce(b.on_hand, 0) - coalesce(b.reserved, 0) <= m.reorder_level then 'low_stock'
       else 'in_stock' end as stock_status
from public.packaging_materials m
left join public.inventory_items ii on ii.item_type = 'packaging_material' and ii.reference_id = m.id
left join lateral (select sum(on_hand_quantity) as on_hand, sum(reserved_quantity) as reserved from public.inventory_balances ib where ib.inventory_item_id = ii.id) b on true
left join lateral (select sum(remaining_cost) as remaining_cost from public.inventory_cost_layers c where c.inventory_item_id = ii.id) cl on true;

create view public.finished_goods_inventory_view
with (security_invoker = true)
as
select
  fl.id as lot_id, fl.business_id, fl.lot_code, fl.packaged_at, fl.best_before_at, fl.quantity as packaged_quantity, fl.unit_cost, fl.total_cost,
  fl.packaging_session_id, ps.session_number,
  pv.id as variant_id, pv.sku, pv.name as variant_name, pv.net_weight_g, pv.selling_price, pv.wholesale_price,
  p.id as product_id, p.name as product_name, p.category,
  ii.id as inventory_item_id,
  coalesce(b.on_hand, 0)::bigint as on_hand,
  coalesce(b.reserved, 0)::bigint as reserved,
  (coalesce(b.on_hand, 0) - coalesce(b.reserved, 0))::bigint as available,
  coalesce(cl.remaining_cost, 0)::numeric(14, 2) as stock_value,
  lin.roast_batch_numbers, lin.green_lot_codes, lin.coffee_names,
  case when coalesce(b.on_hand, 0) - coalesce(b.reserved, 0) <= 0 then 'out_of_stock' else 'in_stock' end as stock_status
from public.finished_goods_lots fl
join public.product_variants pv on pv.id = fl.variant_id
join public.products p on p.id = pv.product_id
left join public.packaging_sessions ps on ps.id = fl.packaging_session_id
left join public.inventory_items ii on ii.item_type = 'finished_product' and ii.reference_id = fl.id
left join lateral (select sum(on_hand_quantity) as on_hand, sum(reserved_quantity) as reserved from public.inventory_balances ib where ib.inventory_item_id = ii.id) b on true
left join lateral (select sum(remaining_cost) as remaining_cost from public.inventory_cost_layers c where c.inventory_item_id = ii.id) cl on true
left join lateral (
  select string_agg(distinct rb.batch_number, ', ' order by rb.batch_number) as roast_batch_numbers,
         string_agg(distinct gl.lot_code, ', ' order by gl.lot_code) as green_lot_codes,
         string_agg(distinct gc.name, ', ' order by gc.name) as coffee_names
  from public.packaging_inputs pi
  join public.roast_batches rb on rb.id = pi.roast_batch_id
  join public.roast_batch_inputs rbi on rbi.roast_batch_id = rb.id
  join public.green_coffee_lots gl on gl.id = rbi.green_lot_id
  join public.green_coffees gc on gc.id = gl.green_coffee_id
  where pi.session_id = fl.packaging_session_id
) lin on true;

create view public.packaging_session_summary_view
with (security_invoker = true)
as
select
  s.id, s.business_id, s.session_number, s.status, s.packaged_at, s.completed_at, s.location_id, loc.name as location_name,
  s.operator_id, op.full_name as operator_name, s.required_weight_g, s.input_weight_g, s.labor_cost, s.overhead_cost,
  s.coffee_cost, s.material_cost, s.total_cost, s.notes, s.created_at,
  o.output_units, o.product_names, i.batch_numbers
from public.packaging_sessions s
join public.inventory_locations loc on loc.id = s.location_id
left join public.user_profiles op on op.id = s.operator_id
left join lateral (
  select sum(po.quantity) as output_units, string_agg(distinct p.name || ' ' || pv.name, ', ') as product_names
  from public.packaging_outputs po join public.product_variants pv on pv.id = po.variant_id join public.products p on p.id = pv.product_id
  where po.session_id = s.id
) o on true
left join lateral (
  select string_agg(rb.batch_number, ', ' order by rb.batch_number) as batch_numbers
  from public.packaging_inputs pi join public.roast_batches rb on rb.id = pi.roast_batch_id where pi.session_id = s.id
) i on true;

grant select on public.packaging_material_inventory_view to authenticated, service_role;
grant select on public.finished_goods_inventory_view to authenticated, service_role;
grant select on public.packaging_session_summary_view to authenticated, service_role;

-- Default packaging materials for new businesses (names only; no stock or prices).
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
  on conflict do nothing returning id into v_roaster_id;
  insert into public.inventory_locations (business_id, name, location_type)
  values (p_business_id, 'Main Roastery', 'roastery')
  on conflict do nothing returning id into v_location_id;
  insert into public.expense_categories (business_id, name, classification) values
    (p_business_id, 'Green Coffee', 'cogs'), (p_business_id, 'Packaging Materials', 'cogs'), (p_business_id, 'Fuel & Gas', 'operating'),
    (p_business_id, 'Electricity', 'operating'), (p_business_id, 'Labor', 'operating'), (p_business_id, 'Delivery & Logistics', 'operating'),
    (p_business_id, 'Rent', 'operating'), (p_business_id, 'Equipment', 'capital'), (p_business_id, 'Miscellaneous', 'other')
  on conflict do nothing;
  insert into public.sales_channels (business_id, name, channel_type) values
    (p_business_id, 'Walk-in', 'walk_in'), (p_business_id, 'Online', 'online'), (p_business_id, 'Wholesale', 'wholesale')
  on conflict do nothing;
  insert into public.packaging_materials (business_id, name, base_unit, reorder_level) values
    (p_business_id, '250 g coffee bag', 'pc', 50), (p_business_id, '500 g coffee bag', 'pc', 25), (p_business_id, 'Label sticker', 'pc', 100)
  on conflict do nothing;
  update public.business_settings
  set default_roaster_id = coalesce(default_roaster_id, v_roaster_id), default_location_id = coalesce(default_location_id, v_location_id),
      currency = 'PHP', timezone = 'Asia/Manila'
  where business_id = p_business_id;
end;
$$;
