-- =============================================================================
-- Phase 2: Procurement + transactional inventory ledger
--
-- Design summary (see docs/architecture/INVENTORY_LEDGER.md):
--  * inventory_items        : one row per stock-keeping thing (a green lot, a roasted
--                             bulk batch, a finished product, a packaging material).
--  * inventory_movements    : append-only ledger. Immutable. Every stock change is a row.
--  * inventory_balances     : per item + location running totals, maintained ONLY by
--                             app.post_movement() under a row lock. Never negative.
--  * inventory_cost_layers  : actual cost per receipt (lot-based costing). Historical
--                             costs are never recalculated.
--  * All writes go through SECURITY DEFINER functions with explicit permission checks.
--    Authenticated users have no direct INSERT/UPDATE/DELETE on ledger tables.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.inventory_item_type as enum (
  'green_coffee_lot', 'roasted_bulk', 'finished_product', 'packaging_material'
);
create type public.inventory_movement_type as enum (
  'receipt', 'adjustment', 'adjustment_reversal',
  'roast_consume', 'roast_output', 'pack_consume', 'pack_output',
  'sale', 'sale_return', 'transfer_in', 'transfer_out', 'write_off'
);
create type public.purchase_order_status as enum (
  'draft', 'confirmed', 'partially_received', 'received', 'cancelled'
);
create type public.goods_receipt_status as enum ('draft', 'posted', 'cancelled');
create type public.inventory_adjustment_status as enum ('draft', 'posted', 'reversed');
create type public.inventory_reservation_status as enum ('active', 'released', 'consumed');

-- -----------------------------------------------------------------------------
-- Inventory core
-- -----------------------------------------------------------------------------
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  item_type public.inventory_item_type not null,
  reference_id uuid not null,
  base_unit text not null check (base_unit in ('g', 'unit', 'ml', 'pc')),
  low_stock_threshold bigint check (low_stock_threshold is null or low_stock_threshold >= 0),
  created_at timestamptz not null default now(),
  unique (business_id, item_type, reference_id),
  unique (id, business_id)
);

create table public.inventory_balances (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  inventory_item_id uuid not null,
  location_id uuid not null,
  on_hand_quantity bigint not null default 0 check (on_hand_quantity >= 0),
  reserved_quantity bigint not null default 0 check (reserved_quantity >= 0),
  updated_at timestamptz not null default now(),
  unique (inventory_item_id, location_id),
  foreign key (inventory_item_id, business_id) references public.inventory_items (id, business_id) on delete restrict,
  foreign key (location_id, business_id) references public.inventory_locations (id, business_id) on delete restrict,
  check (reserved_quantity <= on_hand_quantity)
);
create index inventory_balances_business_idx on public.inventory_balances (business_id);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  inventory_item_id uuid not null,
  location_id uuid not null,
  quantity_delta bigint not null check (quantity_delta <> 0),
  movement_type public.inventory_movement_type not null,
  source_type text not null,
  source_id uuid not null,
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 200),
  total_cost numeric(14, 2) not null default 0,
  notes text,
  posted_at timestamptz not null default now(),
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (business_id, idempotency_key),
  foreign key (inventory_item_id, business_id) references public.inventory_items (id, business_id) on delete restrict,
  foreign key (location_id, business_id) references public.inventory_locations (id, business_id) on delete restrict
);
create index inventory_movements_item_idx on public.inventory_movements (inventory_item_id, posted_at desc);
create index inventory_movements_business_posted_idx on public.inventory_movements (business_id, posted_at desc);
create index inventory_movements_source_idx on public.inventory_movements (source_type, source_id);

create table public.inventory_cost_layers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  inventory_item_id uuid not null,
  source_type text not null,
  source_id uuid not null,
  received_quantity bigint not null check (received_quantity > 0),
  remaining_quantity bigint not null check (remaining_quantity >= 0),
  original_cost numeric(14, 2) not null check (original_cost >= 0),
  remaining_cost numeric(14, 2) not null check (remaining_cost >= 0),
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (business_id, source_type, source_id),
  check (remaining_quantity <= received_quantity),
  foreign key (inventory_item_id, business_id) references public.inventory_items (id, business_id) on delete restrict
);
create index inventory_cost_layers_item_idx on public.inventory_cost_layers (inventory_item_id, received_at);

create table public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  inventory_item_id uuid not null,
  location_id uuid not null,
  quantity bigint not null check (quantity > 0),
  status public.inventory_reservation_status not null default 'active',
  source_type text not null,
  source_id uuid not null,
  idempotency_key text not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  unique (business_id, idempotency_key),
  foreign key (inventory_item_id, business_id) references public.inventory_items (id, business_id) on delete restrict,
  foreign key (location_id, business_id) references public.inventory_locations (id, business_id) on delete restrict
);
create index inventory_reservations_item_idx on public.inventory_reservations (inventory_item_id, status);

-- -----------------------------------------------------------------------------
-- Green coffee lots
-- -----------------------------------------------------------------------------
create table public.green_coffee_lots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  green_coffee_id uuid not null,
  supplier_id uuid,
  lot_code text not null check (char_length(btrim(lot_code)) between 1 and 60),
  received_at date,
  moisture_pct numeric(5, 2) check (moisture_pct is null or (moisture_pct >= 0 and moisture_pct <= 100)),
  density_g_per_100ml numeric(6, 2) check (density_g_per_100ml is null or (density_g_per_100ml > 0 and density_g_per_100ml <= 200)),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id),
  foreign key (green_coffee_id, business_id) references public.green_coffees (id, business_id) on delete restrict,
  foreign key (supplier_id, business_id) references public.suppliers (id, business_id) on delete restrict
);
create unique index green_coffee_lots_code_key on public.green_coffee_lots (business_id, lower(btrim(lot_code)));
create index green_coffee_lots_coffee_idx on public.green_coffee_lots (green_coffee_id);

-- -----------------------------------------------------------------------------
-- Purchasing
-- -----------------------------------------------------------------------------
create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  purchase_number text not null,
  supplier_id uuid not null,
  status public.purchase_order_status not null default 'draft',
  ordered_at date not null default (now() at time zone 'Asia/Manila')::date,
  notes text check (notes is null or char_length(notes) <= 2000),
  subtotal numeric(14, 2) not null default 0 check (subtotal >= 0),
  additional_costs numeric(14, 2) not null default 0 check (additional_costs >= 0),
  total numeric(14, 2) not null default 0 check (total >= 0),
  idempotency_key text,
  created_by uuid,
  confirmed_at timestamptz,
  confirmed_by uuid,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, purchase_number),
  unique (business_id, idempotency_key),
  unique (id, business_id),
  foreign key (supplier_id, business_id) references public.suppliers (id, business_id) on delete restrict
);
create index purchase_orders_business_status_idx on public.purchase_orders (business_id, status, ordered_at desc);

create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  purchase_order_id uuid not null,
  green_coffee_id uuid not null,
  ordered_quantity_g bigint not null check (ordered_quantity_g > 0),
  -- unit_cost is PHP per kilogram (green coffee is priced per kg in the Philippines)
  unit_cost numeric(14, 4) not null check (unit_cost >= 0),
  line_total numeric(14, 2) not null check (line_total >= 0),
  received_quantity_g bigint not null default 0 check (received_quantity_g >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id),
  foreign key (purchase_order_id, business_id) references public.purchase_orders (id, business_id) on delete cascade,
  foreign key (green_coffee_id, business_id) references public.green_coffees (id, business_id) on delete restrict
);
create index purchase_order_items_po_idx on public.purchase_order_items (purchase_order_id);

create table public.goods_receipts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  purchase_order_id uuid not null,
  receipt_number text not null,
  status public.goods_receipt_status not null default 'draft',
  location_id uuid not null,
  received_at date not null default (now() at time zone 'Asia/Manila')::date,
  additional_costs numeric(14, 2) not null default 0 check (additional_costs >= 0),
  notes text check (notes is null or char_length(notes) <= 2000),
  idempotency_key text,
  created_by uuid,
  posted_at timestamptz,
  posted_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, receipt_number),
  unique (business_id, idempotency_key),
  unique (id, business_id),
  foreign key (purchase_order_id, business_id) references public.purchase_orders (id, business_id) on delete restrict,
  foreign key (location_id, business_id) references public.inventory_locations (id, business_id) on delete restrict
);
create index goods_receipts_po_idx on public.goods_receipts (purchase_order_id);

create table public.goods_receipt_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  receipt_id uuid not null,
  purchase_order_item_id uuid not null,
  green_lot_id uuid not null,
  received_quantity_g bigint not null check (received_quantity_g > 0),
  -- receipt-level landed cost allocated to this line (freight, handling, etc.)
  allocated_landed_cost numeric(14, 2) not null default 0 check (allocated_landed_cost >= 0),
  -- snapshots written at posting time; never recalculated
  purchase_cost numeric(14, 2),
  po_cost_share numeric(14, 2),
  total_cost numeric(14, 2),
  created_at timestamptz not null default now(),
  unique (id, business_id),
  foreign key (receipt_id, business_id) references public.goods_receipts (id, business_id) on delete cascade,
  foreign key (purchase_order_item_id, business_id) references public.purchase_order_items (id, business_id) on delete restrict,
  foreign key (green_lot_id, business_id) references public.green_coffee_lots (id, business_id) on delete restrict
);
create index goods_receipt_items_receipt_idx on public.goods_receipt_items (receipt_id);
create index goods_receipt_items_lot_idx on public.goods_receipt_items (green_lot_id);

-- -----------------------------------------------------------------------------
-- Adjustments
-- -----------------------------------------------------------------------------
create table public.inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  adjustment_number text not null,
  status public.inventory_adjustment_status not null default 'draft',
  reason text not null check (reason in ('count_correction', 'damage', 'moisture_loss', 'sample', 'donation', 'reversal', 'other')),
  notes text check (notes is null or char_length(notes) <= 2000),
  reversal_of_adjustment_id uuid references public.inventory_adjustments (id) on delete restrict,
  idempotency_key text,
  created_by uuid,
  posted_at timestamptz,
  posted_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, adjustment_number),
  unique (business_id, idempotency_key),
  unique (id, business_id)
);
create index inventory_adjustments_business_idx on public.inventory_adjustments (business_id, created_at desc);

create table public.inventory_adjustment_lines (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  adjustment_id uuid not null,
  inventory_item_id uuid not null,
  location_id uuid not null,
  quantity_delta bigint not null check (quantity_delta <> 0),
  -- cost per base unit for positive adjustments (optional; defaults to the item's current average)
  unit_cost numeric(14, 6) check (unit_cost is null or unit_cost >= 0),
  total_cost numeric(14, 2),
  notes text,
  created_at timestamptz not null default now(),
  unique (id, business_id),
  foreign key (adjustment_id, business_id) references public.inventory_adjustments (id, business_id) on delete cascade,
  foreign key (inventory_item_id, business_id) references public.inventory_items (id, business_id) on delete restrict,
  foreign key (location_id, business_id) references public.inventory_locations (id, business_id) on delete restrict
);
create index inventory_adjustment_lines_adj_idx on public.inventory_adjustment_lines (adjustment_id);

-- -----------------------------------------------------------------------------
-- Triggers: updated_at, audit, immutability
-- -----------------------------------------------------------------------------
create trigger set_updated_at before update on public.green_coffee_lots for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.purchase_orders for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.purchase_order_items for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.goods_receipts for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.inventory_adjustments for each row execute function app.set_updated_at();

create trigger audit after insert or update or delete on public.purchase_orders for each row execute function app.audit_row_change();
create trigger audit after insert or update or delete on public.goods_receipts for each row execute function app.audit_row_change();
create trigger audit after insert or update or delete on public.inventory_adjustments for each row execute function app.audit_row_change();
create trigger audit after insert or update or delete on public.green_coffee_lots for each row execute function app.audit_row_change();

create trigger lock_business before update on public.green_coffee_lots for each row execute function app.prevent_business_change();
create trigger lock_business before update on public.purchase_orders for each row execute function app.prevent_business_change();
create trigger lock_business before update on public.goods_receipts for each row execute function app.prevent_business_change();
create trigger lock_business before update on public.inventory_adjustments for each row execute function app.prevent_business_change();

create or replace function app.forbid_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% rows are immutable (%)', tg_table_name, tg_op using errcode = '55000';
end;
$$;
create trigger immutable_movements before update or delete on public.inventory_movements
  for each row execute function app.forbid_change();

-- Posted documents cannot be deleted; items of non-draft documents cannot change.
create or replace function app.forbid_delete_when_posted()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status::text <> 'draft' then
    raise exception '% % is not a draft and cannot be deleted', tg_table_name, old.id using errcode = '55000';
  end if;
  return old;
end;
$$;
create trigger forbid_delete_posted before delete on public.purchase_orders for each row execute function app.forbid_delete_when_posted();
create trigger forbid_delete_posted before delete on public.goods_receipts for each row execute function app.forbid_delete_when_posted();
create trigger forbid_delete_posted before delete on public.inventory_adjustments for each row execute function app.forbid_delete_when_posted();

create or replace function app.purchase_order_item_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status public.purchase_order_status;
  v_po_id uuid := coalesce(new.purchase_order_id, old.purchase_order_id);
begin
  select status into v_status from public.purchase_orders where id = v_po_id;
  if v_status <> 'draft' then
    -- only received_quantity_g may change after confirmation (done by posting function)
    if tg_op = 'UPDATE'
       and new.green_coffee_id = old.green_coffee_id
       and new.ordered_quantity_g = old.ordered_quantity_g
       and new.unit_cost = old.unit_cost
       and new.line_total = old.line_total then
      return new;
    end if;
    raise exception 'purchase order % is % and its items cannot be modified', v_po_id, v_status using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
create trigger guard before insert or update or delete on public.purchase_order_items
  for each row execute function app.purchase_order_item_guard();

create or replace function app.recalc_purchase_order_totals()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_po_id uuid := coalesce(new.purchase_order_id, old.purchase_order_id);
begin
  update public.purchase_orders po
  set subtotal = coalesce((select sum(line_total) from public.purchase_order_items i where i.purchase_order_id = po.id), 0),
      total = coalesce((select sum(line_total) from public.purchase_order_items i where i.purchase_order_id = po.id), 0) + po.additional_costs
  where po.id = v_po_id;
  return null;
end;
$$;
create trigger recalc_totals after insert or update or delete on public.purchase_order_items
  for each row execute function app.recalc_purchase_order_totals();

create or replace function app.purchase_order_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.total := new.subtotal + new.additional_costs;
  return new;
end;
$$;
create trigger before_update before update on public.purchase_orders
  for each row execute function app.purchase_order_before_update();

create or replace function app.goods_receipt_item_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status public.goods_receipt_status;
begin
  select status into v_status from public.goods_receipts where id = coalesce(new.receipt_id, old.receipt_id);
  if v_status <> 'draft' and not pg_catalog.current_setting('app.posting', true) = 'on' then
    raise exception 'goods receipt is % and its items cannot be modified', v_status using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger guard before insert or update or delete on public.goods_receipt_items
  for each row execute function app.goods_receipt_item_guard();

-- -----------------------------------------------------------------------------
-- Internal ledger primitives
-- -----------------------------------------------------------------------------
create or replace function app.ensure_inventory_item(
  p_business_id uuid,
  p_item_type public.inventory_item_type,
  p_reference_id uuid,
  p_base_unit text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.inventory_items (business_id, item_type, reference_id, base_unit)
  values (p_business_id, p_item_type, p_reference_id, p_base_unit)
  on conflict (business_id, item_type, reference_id) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.inventory_items
    where business_id = p_business_id and item_type = p_item_type and reference_id = p_reference_id;
  end if;
  return v_id;
end;
$$;

-- The single choke point for stock changes. Idempotent on (business_id, idempotency_key).
-- Locks the balance row, enforces non-negative on_hand and on_hand >= reserved.
create or replace function app.post_movement(
  p_business_id uuid,
  p_inventory_item_id uuid,
  p_location_id uuid,
  p_quantity_delta bigint,
  p_movement_type public.inventory_movement_type,
  p_source_type text,
  p_source_id uuid,
  p_idempotency_key text,
  p_total_cost numeric default 0,
  p_notes text default null,
  p_actor uuid default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_existing uuid;
  v_movement_id uuid;
  v_on_hand bigint;
  v_reserved bigint;
begin
  if p_quantity_delta = 0 then
    raise exception 'quantity_delta must be non-zero' using errcode = '22023';
  end if;

  -- Ensure a balance row exists, then lock it (serialises concurrent posts per item+location).
  insert into public.inventory_balances (business_id, inventory_item_id, location_id)
  values (p_business_id, p_inventory_item_id, p_location_id)
  on conflict (inventory_item_id, location_id) do nothing;

  select on_hand_quantity, reserved_quantity into v_on_hand, v_reserved
  from public.inventory_balances
  where inventory_item_id = p_inventory_item_id and location_id = p_location_id
  for update;

  -- Idempotency: if this key was already posted, return the existing movement without changing stock.
  select id into v_existing from public.inventory_movements
  where business_id = p_business_id and idempotency_key = p_idempotency_key;
  if v_existing is not null then
    return v_existing;
  end if;

  if v_on_hand + p_quantity_delta < 0 then
    raise exception 'INSUFFICIENT_STOCK: on hand % , requested change %', v_on_hand, p_quantity_delta
      using errcode = 'P0001', hint = 'insufficient_stock';
  end if;
  if v_on_hand + p_quantity_delta < v_reserved then
    raise exception 'INSUFFICIENT_STOCK: % reserved, only % would remain', v_reserved, v_on_hand + p_quantity_delta
      using errcode = 'P0001', hint = 'insufficient_stock';
  end if;

  insert into public.inventory_movements (
    business_id, inventory_item_id, location_id, quantity_delta, movement_type,
    source_type, source_id, idempotency_key, total_cost, notes, created_by
  ) values (
    p_business_id, p_inventory_item_id, p_location_id, p_quantity_delta, p_movement_type,
    p_source_type, p_source_id, p_idempotency_key, coalesce(p_total_cost, 0), p_notes, p_actor
  ) returning id into v_movement_id;

  update public.inventory_balances
  set on_hand_quantity = on_hand_quantity + p_quantity_delta, updated_at = now()
  where inventory_item_id = p_inventory_item_id and location_id = p_location_id;

  return v_movement_id;
end;
$$;

create or replace function app.add_cost_layer(
  p_business_id uuid,
  p_inventory_item_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_quantity bigint,
  p_cost numeric,
  p_received_at timestamptz default now()
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.inventory_cost_layers (
    business_id, inventory_item_id, source_type, source_id,
    received_quantity, remaining_quantity, original_cost, remaining_cost, received_at
  ) values (
    p_business_id, p_inventory_item_id, p_source_type, p_source_id,
    p_quantity, p_quantity, round(p_cost, 2), round(p_cost, 2), p_received_at
  )
  on conflict (business_id, source_type, source_id) do nothing
  returning id into v_id;
  return v_id;
end;
$$;

-- Consume quantity from cost layers (oldest first). Returns the cost consumed.
create or replace function app.consume_cost_layers(
  p_inventory_item_id uuid,
  p_quantity bigint
)
returns numeric
language plpgsql
set search_path = ''
as $$
declare
  v_remaining bigint := p_quantity;
  v_layer record;
  v_take bigint;
  v_cost numeric := 0;
  v_layer_cost numeric;
begin
  for v_layer in
    select id, remaining_quantity, remaining_cost
    from public.inventory_cost_layers
    where inventory_item_id = p_inventory_item_id and remaining_quantity > 0
    order by received_at, created_at
    for update
  loop
    exit when v_remaining <= 0;
    v_take := least(v_layer.remaining_quantity, v_remaining);
    if v_take = v_layer.remaining_quantity then
      v_layer_cost := v_layer.remaining_cost;
    else
      v_layer_cost := round(v_layer.remaining_cost * v_take / v_layer.remaining_quantity, 2);
    end if;
    update public.inventory_cost_layers
    set remaining_quantity = remaining_quantity - v_take,
        remaining_cost = remaining_cost - v_layer_cost
    where id = v_layer.id;
    v_cost := v_cost + v_layer_cost;
    v_remaining := v_remaining - v_take;
  end loop;
  -- If layers are exhausted (e.g. stock without cost history), the remainder costs 0.
  return v_cost;
end;
$$;

create or replace function app.require_permission(p_business_id uuid, p_permission text)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if auth.role() = 'service_role' then
    return;
  end if;
  if not app.has_permission(p_business_id, p_permission) then
    raise exception 'FORBIDDEN: missing permission %', p_permission using errcode = '42501';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Purchase orders
-- -----------------------------------------------------------------------------
-- p_items: [{ "green_coffee_id": uuid, "ordered_quantity_g": int, "unit_cost": numeric }]
create or replace function public.create_purchase_order(
  p_business_id uuid,
  p_supplier_id uuid,
  p_ordered_at date,
  p_notes text,
  p_additional_costs numeric,
  p_items jsonb,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_po_id uuid;
  v_item jsonb;
  v_qty bigint;
  v_cost numeric;
begin
  perform app.require_permission(p_business_id, 'purchases.manage');

  select id into v_po_id from public.purchase_orders
  where business_id = p_business_id and idempotency_key = p_idempotency_key;
  if v_po_id is not null then
    return v_po_id;
  end if;

  if not exists (select 1 from public.suppliers where id = p_supplier_id and business_id = p_business_id and is_active) then
    raise exception 'VALIDATION: supplier is not active in this business' using errcode = '23503';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'VALIDATION: a purchase order needs at least one item' using errcode = '22023';
  end if;

  insert into public.purchase_orders (
    business_id, purchase_number, supplier_id, ordered_at, notes, additional_costs, idempotency_key, created_by
  ) values (
    p_business_id, app.next_document_number(p_business_id, 'purchase_order', 'PO'),
    p_supplier_id, coalesce(p_ordered_at, (now() at time zone 'Asia/Manila')::date),
    p_notes, coalesce(round(p_additional_costs, 2), 0), p_idempotency_key, auth.uid()
  ) returning id into v_po_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'ordered_quantity_g')::bigint;
    v_cost := round((v_item ->> 'unit_cost')::numeric, 4);
    if v_qty is null or v_qty <= 0 then
      raise exception 'VALIDATION: ordered_quantity_g must be a positive integer' using errcode = '22023';
    end if;
    if v_cost is null or v_cost < 0 then
      raise exception 'VALIDATION: unit_cost must be >= 0' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.green_coffees where id = (v_item ->> 'green_coffee_id')::uuid and business_id = p_business_id and is_active
    ) then
      raise exception 'VALIDATION: green coffee is not active in this business' using errcode = '23503';
    end if;
    insert into public.purchase_order_items (
      business_id, purchase_order_id, green_coffee_id, ordered_quantity_g, unit_cost, line_total
    ) values (
      p_business_id, v_po_id, (v_item ->> 'green_coffee_id')::uuid, v_qty, v_cost,
      round(v_qty * v_cost / 1000.0, 2)
    );
  end loop;

  return v_po_id;
end;
$$;

create or replace function public.update_purchase_order_draft(
  p_purchase_order_id uuid,
  p_supplier_id uuid,
  p_ordered_at date,
  p_notes text,
  p_additional_costs numeric,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_po public.purchase_orders%rowtype;
  v_item jsonb;
  v_qty bigint;
  v_cost numeric;
begin
  select * into v_po from public.purchase_orders where id = p_purchase_order_id for update;
  if v_po.id is null then
    raise exception 'NOT_FOUND: purchase order' using errcode = 'P0002';
  end if;
  perform app.require_permission(v_po.business_id, 'purchases.manage');
  if v_po.status <> 'draft' then
    raise exception 'INVALID_STATE: only draft purchase orders can be edited' using errcode = '55000';
  end if;
  if not exists (select 1 from public.suppliers where id = p_supplier_id and business_id = v_po.business_id and is_active) then
    raise exception 'VALIDATION: supplier is not active in this business' using errcode = '23503';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'VALIDATION: a purchase order needs at least one item' using errcode = '22023';
  end if;

  delete from public.purchase_order_items where purchase_order_id = v_po.id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'ordered_quantity_g')::bigint;
    v_cost := round((v_item ->> 'unit_cost')::numeric, 4);
    if v_qty is null or v_qty <= 0 then
      raise exception 'VALIDATION: ordered_quantity_g must be a positive integer' using errcode = '22023';
    end if;
    if v_cost is null or v_cost < 0 then
      raise exception 'VALIDATION: unit_cost must be >= 0' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.green_coffees where id = (v_item ->> 'green_coffee_id')::uuid and business_id = v_po.business_id and is_active
    ) then
      raise exception 'VALIDATION: green coffee is not active in this business' using errcode = '23503';
    end if;
    insert into public.purchase_order_items (
      business_id, purchase_order_id, green_coffee_id, ordered_quantity_g, unit_cost, line_total
    ) values (
      v_po.business_id, v_po.id, (v_item ->> 'green_coffee_id')::uuid, v_qty, v_cost,
      round(v_qty * v_cost / 1000.0, 2)
    );
  end loop;

  update public.purchase_orders
  set supplier_id = p_supplier_id,
      ordered_at = coalesce(p_ordered_at, ordered_at),
      notes = p_notes,
      additional_costs = coalesce(round(p_additional_costs, 2), 0)
  where id = v_po.id;

  return v_po.id;
end;
$$;

create or replace function public.confirm_purchase_order(p_purchase_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_po public.purchase_orders%rowtype;
begin
  select * into v_po from public.purchase_orders where id = p_purchase_order_id for update;
  if v_po.id is null then
    raise exception 'NOT_FOUND: purchase order' using errcode = 'P0002';
  end if;
  perform app.require_permission(v_po.business_id, 'purchases.manage');
  if v_po.status = 'confirmed' then
    return; -- idempotent
  end if;
  if v_po.status <> 'draft' then
    raise exception 'INVALID_STATE: purchase order is %', v_po.status using errcode = '55000';
  end if;
  if not exists (select 1 from public.purchase_order_items where purchase_order_id = v_po.id) then
    raise exception 'VALIDATION: cannot confirm a purchase order without items' using errcode = '22023';
  end if;
  update public.purchase_orders
  set status = 'confirmed', confirmed_at = now(), confirmed_by = auth.uid()
  where id = v_po.id;
end;
$$;

create or replace function public.cancel_purchase_order(p_purchase_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_po public.purchase_orders%rowtype;
begin
  select * into v_po from public.purchase_orders where id = p_purchase_order_id for update;
  if v_po.id is null then
    raise exception 'NOT_FOUND: purchase order' using errcode = 'P0002';
  end if;
  perform app.require_permission(v_po.business_id, 'purchases.manage');
  if v_po.status = 'cancelled' then
    return;
  end if;
  if v_po.status not in ('draft', 'confirmed') then
    raise exception 'INVALID_STATE: cannot cancel a purchase order that has receipts' using errcode = '55000';
  end if;
  if exists (select 1 from public.goods_receipts where purchase_order_id = v_po.id and status = 'posted') then
    raise exception 'INVALID_STATE: cannot cancel a purchase order with posted receipts' using errcode = '55000';
  end if;
  update public.purchase_orders set status = 'cancelled', cancelled_at = now() where id = v_po.id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Goods receipts
-- -----------------------------------------------------------------------------
-- p_items: [{
--   "purchase_order_item_id": uuid,
--   "received_quantity_g": int,
--   "allocated_landed_cost": numeric,
--   "green_lot_id": uuid | null,
--   "new_lot": { "lot_code": text|null, "moisture_pct": numeric|null, "density_g_per_100ml": numeric|null, "notes": text|null } | null
-- }]
create or replace function public.create_goods_receipt(
  p_purchase_order_id uuid,
  p_location_id uuid,
  p_received_at date,
  p_additional_costs numeric,
  p_notes text,
  p_items jsonb,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_po public.purchase_orders%rowtype;
  v_receipt_id uuid;
  v_item jsonb;
  v_po_item public.purchase_order_items%rowtype;
  v_lot_id uuid;
  v_lot_code text;
  v_qty bigint;
  v_landed numeric;
  v_sum_landed numeric := 0;
begin
  select * into v_po from public.purchase_orders where id = p_purchase_order_id for update;
  if v_po.id is null then
    raise exception 'NOT_FOUND: purchase order' using errcode = 'P0002';
  end if;
  perform app.require_permission(v_po.business_id, 'purchases.post');

  select id into v_receipt_id from public.goods_receipts
  where business_id = v_po.business_id and idempotency_key = p_idempotency_key;
  if v_receipt_id is not null then
    return v_receipt_id;
  end if;

  if v_po.status not in ('confirmed', 'partially_received') then
    raise exception 'INVALID_STATE: purchase order must be confirmed before receiving (status: %)', v_po.status
      using errcode = '55000';
  end if;
  if not exists (select 1 from public.inventory_locations where id = p_location_id and business_id = v_po.business_id and is_active) then
    raise exception 'VALIDATION: location is not active in this business' using errcode = '23503';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'VALIDATION: a receipt needs at least one item' using errcode = '22023';
  end if;

  insert into public.goods_receipts (
    business_id, purchase_order_id, receipt_number, location_id, received_at, additional_costs, notes, idempotency_key, created_by
  ) values (
    v_po.business_id, v_po.id, app.next_document_number(v_po.business_id, 'goods_receipt', 'GRN'),
    p_location_id, coalesce(p_received_at, (now() at time zone 'Asia/Manila')::date),
    coalesce(round(p_additional_costs, 2), 0), p_notes, p_idempotency_key, auth.uid()
  ) returning id into v_receipt_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_po_item from public.purchase_order_items
    where id = (v_item ->> 'purchase_order_item_id')::uuid and purchase_order_id = v_po.id;
    if v_po_item.id is null then
      raise exception 'VALIDATION: purchase order item does not belong to this purchase order' using errcode = '23503';
    end if;

    v_qty := (v_item ->> 'received_quantity_g')::bigint;
    if v_qty is null or v_qty <= 0 then
      raise exception 'VALIDATION: received_quantity_g must be a positive integer' using errcode = '22023';
    end if;
    v_landed := coalesce(round((v_item ->> 'allocated_landed_cost')::numeric, 2), 0);
    if v_landed < 0 then
      raise exception 'VALIDATION: allocated_landed_cost must be >= 0' using errcode = '22023';
    end if;
    v_sum_landed := v_sum_landed + v_landed;

    v_lot_id := nullif(v_item ->> 'green_lot_id', '')::uuid;
    if v_lot_id is null then
      v_lot_code := nullif(btrim(coalesce(v_item #>> '{new_lot,lot_code}', '')), '');
      if v_lot_code is null then
        v_lot_code := app.next_document_number(v_po.business_id, 'green_lot', 'LOT');
      end if;
      insert into public.green_coffee_lots (
        business_id, green_coffee_id, supplier_id, lot_code, received_at,
        moisture_pct, density_g_per_100ml, notes, created_by
      ) values (
        v_po.business_id, v_po_item.green_coffee_id, v_po.supplier_id, v_lot_code,
        coalesce(p_received_at, (now() at time zone 'Asia/Manila')::date),
        nullif(v_item #>> '{new_lot,moisture_pct}', '')::numeric,
        nullif(v_item #>> '{new_lot,density_g_per_100ml}', '')::numeric,
        nullif(v_item #>> '{new_lot,notes}', ''),
        auth.uid()
      ) returning id into v_lot_id;
    else
      if not exists (
        select 1 from public.green_coffee_lots
        where id = v_lot_id and business_id = v_po.business_id and green_coffee_id = v_po_item.green_coffee_id
      ) then
        raise exception 'VALIDATION: lot does not belong to this business/green coffee' using errcode = '23503';
      end if;
    end if;

    insert into public.goods_receipt_items (
      business_id, receipt_id, purchase_order_item_id, green_lot_id, received_quantity_g, allocated_landed_cost
    ) values (
      v_po.business_id, v_receipt_id, v_po_item.id, v_lot_id, v_qty, v_landed
    );
  end loop;

  if abs(v_sum_landed - coalesce(round(p_additional_costs, 2), 0)) > 0.005 then
    raise exception 'VALIDATION: allocated landed costs (%) must equal receipt additional costs (%)',
      v_sum_landed, coalesce(round(p_additional_costs, 2), 0) using errcode = '22023';
  end if;

  return v_receipt_id;
end;
$$;

-- Posting: the only path that increases green stock from a purchase. Idempotent.
create or replace function public.post_goods_receipt(p_receipt_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receipt public.goods_receipts%rowtype;
  v_po public.purchase_orders%rowtype;
  v_item record;
  v_total_ordered_g bigint;
  v_purchase_cost numeric;
  v_po_share numeric;
  v_total_cost numeric;
  v_inv_item_id uuid;
  v_all_received boolean;
begin
  select * into v_receipt from public.goods_receipts where id = p_receipt_id for update;
  if v_receipt.id is null then
    raise exception 'NOT_FOUND: goods receipt' using errcode = 'P0002';
  end if;
  perform app.require_permission(v_receipt.business_id, 'purchases.post');

  if v_receipt.status = 'posted' then
    return v_receipt.id; -- idempotent: already posted
  end if;
  if v_receipt.status <> 'draft' then
    raise exception 'INVALID_STATE: receipt is %', v_receipt.status using errcode = '55000';
  end if;

  select * into v_po from public.purchase_orders where id = v_receipt.purchase_order_id for update;
  if v_po.status not in ('confirmed', 'partially_received') then
    raise exception 'INVALID_STATE: purchase order is % and cannot receive stock', v_po.status using errcode = '55000';
  end if;

  select coalesce(sum(ordered_quantity_g), 0) into v_total_ordered_g
  from public.purchase_order_items where purchase_order_id = v_po.id;

  perform set_config('app.posting', 'on', true);

  for v_item in
    select gri.id, gri.purchase_order_item_id, gri.green_lot_id, gri.received_quantity_g, gri.allocated_landed_cost,
           poi.unit_cost, poi.ordered_quantity_g, poi.received_quantity_g as already_received_g
    from public.goods_receipt_items gri
    join public.purchase_order_items poi on poi.id = gri.purchase_order_item_id
    where gri.receipt_id = v_receipt.id
    order by gri.created_at, gri.id
  loop
    if v_item.already_received_g + v_item.received_quantity_g > v_item.ordered_quantity_g then
      raise exception 'OVER_RECEIPT: receiving % g would exceed ordered % g (already received % g)',
        v_item.received_quantity_g, v_item.ordered_quantity_g, v_item.already_received_g
        using errcode = '22023', hint = 'over_receipt';
    end if;

    -- Actual purchase cost for the received weight (unit_cost is per kg).
    v_purchase_cost := round(v_item.received_quantity_g * v_item.unit_cost / 1000.0, 2);
    -- Share of PO-level additional costs, proportional to received weight over total ordered weight.
    v_po_share := case when v_total_ordered_g > 0
      then round(v_po.additional_costs * v_item.received_quantity_g / v_total_ordered_g, 2) else 0 end;
    v_total_cost := v_purchase_cost + v_po_share + v_item.allocated_landed_cost;

    update public.goods_receipt_items
    set purchase_cost = v_purchase_cost, po_cost_share = v_po_share, total_cost = v_total_cost
    where id = v_item.id;

    v_inv_item_id := app.ensure_inventory_item(v_receipt.business_id, 'green_coffee_lot', v_item.green_lot_id, 'g');

    perform app.post_movement(
      v_receipt.business_id, v_inv_item_id, v_receipt.location_id, v_item.received_quantity_g,
      'receipt', 'goods_receipt_item', v_item.id,
      'grn:' || v_receipt.id || ':' || v_item.id,
      v_total_cost, null, auth.uid()
    );

    perform app.add_cost_layer(
      v_receipt.business_id, v_inv_item_id, 'goods_receipt_item', v_item.id,
      v_item.received_quantity_g, v_total_cost, v_receipt.received_at::timestamptz
    );

    update public.purchase_order_items
    set received_quantity_g = received_quantity_g + v_item.received_quantity_g
    where id = v_item.purchase_order_item_id;

    update public.green_coffee_lots
    set received_at = coalesce(received_at, v_receipt.received_at)
    where id = v_item.green_lot_id;
  end loop;

  update public.goods_receipts
  set status = 'posted', posted_at = now(), posted_by = auth.uid()
  where id = v_receipt.id;

  select bool_and(received_quantity_g >= ordered_quantity_g) into v_all_received
  from public.purchase_order_items where purchase_order_id = v_po.id;

  update public.purchase_orders
  set status = case when v_all_received then 'received'::public.purchase_order_status
                    else 'partially_received'::public.purchase_order_status end
  where id = v_po.id;

  return v_receipt.id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Inventory adjustments (create + optionally post atomically)
-- -----------------------------------------------------------------------------
-- p_lines: [{ "inventory_item_id": uuid, "location_id": uuid, "quantity_delta": int, "unit_cost": numeric|null, "notes": text|null }]
create or replace function public.create_inventory_adjustment(
  p_business_id uuid,
  p_reason text,
  p_notes text,
  p_lines jsonb,
  p_idempotency_key text,
  p_post boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_adj_id uuid;
  v_line jsonb;
  v_delta bigint;
begin
  perform app.require_permission(p_business_id, 'inventory.adjust');

  select id into v_adj_id from public.inventory_adjustments
  where business_id = p_business_id and idempotency_key = p_idempotency_key;
  if v_adj_id is not null then
    if p_post then
      perform public.post_inventory_adjustment(v_adj_id);
    end if;
    return v_adj_id;
  end if;

  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'VALIDATION: an adjustment needs at least one line' using errcode = '22023';
  end if;

  insert into public.inventory_adjustments (business_id, adjustment_number, reason, notes, idempotency_key, created_by)
  values (p_business_id, app.next_document_number(p_business_id, 'inventory_adjustment', 'ADJ'), p_reason, p_notes, p_idempotency_key, auth.uid())
  returning id into v_adj_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_delta := (v_line ->> 'quantity_delta')::bigint;
    if v_delta is null or v_delta = 0 then
      raise exception 'VALIDATION: quantity_delta must be a non-zero integer' using errcode = '22023';
    end if;
    if not exists (select 1 from public.inventory_items where id = (v_line ->> 'inventory_item_id')::uuid and business_id = p_business_id) then
      raise exception 'VALIDATION: inventory item does not belong to this business' using errcode = '23503';
    end if;
    if not exists (select 1 from public.inventory_locations where id = (v_line ->> 'location_id')::uuid and business_id = p_business_id and is_active) then
      raise exception 'VALIDATION: location is not active in this business' using errcode = '23503';
    end if;
    insert into public.inventory_adjustment_lines (
      business_id, adjustment_id, inventory_item_id, location_id, quantity_delta, unit_cost, notes
    ) values (
      p_business_id, v_adj_id, (v_line ->> 'inventory_item_id')::uuid, (v_line ->> 'location_id')::uuid,
      v_delta, nullif(v_line ->> 'unit_cost', '')::numeric, nullif(v_line ->> 'notes', '')
    );
  end loop;

  if p_post then
    perform public.post_inventory_adjustment(v_adj_id);
  end if;
  return v_adj_id;
end;
$$;

create or replace function public.post_inventory_adjustment(p_adjustment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_adj public.inventory_adjustments%rowtype;
  v_line record;
  v_cost numeric;
  v_unit_cost numeric;
  v_type public.inventory_movement_type;
begin
  select * into v_adj from public.inventory_adjustments where id = p_adjustment_id for update;
  if v_adj.id is null then
    raise exception 'NOT_FOUND: inventory adjustment' using errcode = 'P0002';
  end if;
  perform app.require_permission(v_adj.business_id, 'inventory.adjust');
  if v_adj.status = 'posted' or v_adj.status = 'reversed' then
    return v_adj.id;
  end if;

  v_type := case when v_adj.reversal_of_adjustment_id is not null
    then 'adjustment_reversal'::public.inventory_movement_type else 'adjustment'::public.inventory_movement_type end;

  for v_line in
    select * from public.inventory_adjustment_lines where adjustment_id = v_adj.id order by created_at, id
  loop
    if v_line.quantity_delta > 0 then
      -- Positive adjustment: cost at the provided unit cost, else the item's current average cost.
      v_unit_cost := v_line.unit_cost;
      if v_unit_cost is null then
        select case when sum(remaining_quantity) > 0 then sum(remaining_cost) / sum(remaining_quantity) else 0 end
        into v_unit_cost
        from public.inventory_cost_layers where inventory_item_id = v_line.inventory_item_id;
        v_unit_cost := coalesce(v_unit_cost, 0);
      end if;
      v_cost := round(v_line.quantity_delta * v_unit_cost, 2);
      perform app.post_movement(
        v_adj.business_id, v_line.inventory_item_id, v_line.location_id, v_line.quantity_delta,
        v_type, 'inventory_adjustment_line', v_line.id, 'adj:' || v_adj.id || ':' || v_line.id,
        v_cost, v_line.notes, auth.uid()
      );
      perform app.add_cost_layer(
        v_adj.business_id, v_line.inventory_item_id, 'inventory_adjustment_line', v_line.id,
        v_line.quantity_delta, v_cost, now()
      );
    else
      perform app.post_movement(
        v_adj.business_id, v_line.inventory_item_id, v_line.location_id, v_line.quantity_delta,
        v_type, 'inventory_adjustment_line', v_line.id, 'adj:' || v_adj.id || ':' || v_line.id,
        0, v_line.notes, auth.uid()
      );
      v_cost := app.consume_cost_layers(v_line.inventory_item_id, -v_line.quantity_delta);
      -- record the cost released by this negative movement on the movement row
      update public.inventory_adjustment_lines set total_cost = -v_cost where id = v_line.id;
      continue;
    end if;
    update public.inventory_adjustment_lines set total_cost = v_cost where id = v_line.id;
  end loop;

  update public.inventory_adjustments
  set status = 'posted', posted_at = now(), posted_by = auth.uid()
  where id = v_adj.id;

  return v_adj.id;
end;
$$;

-- Corrections never edit history: a reversal posts opposite movements in a new adjustment.
create or replace function public.reverse_inventory_adjustment(p_adjustment_id uuid, p_idempotency_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_adj public.inventory_adjustments%rowtype;
  v_new_id uuid;
  v_line record;
begin
  select * into v_adj from public.inventory_adjustments where id = p_adjustment_id for update;
  if v_adj.id is null then
    raise exception 'NOT_FOUND: inventory adjustment' using errcode = 'P0002';
  end if;
  perform app.require_permission(v_adj.business_id, 'inventory.adjust');

  select id into v_new_id from public.inventory_adjustments
  where business_id = v_adj.business_id and idempotency_key = p_idempotency_key;
  if v_new_id is not null then
    return v_new_id;
  end if;

  if v_adj.status <> 'posted' then
    raise exception 'INVALID_STATE: only posted adjustments can be reversed (status: %)', v_adj.status using errcode = '55000';
  end if;

  insert into public.inventory_adjustments (business_id, adjustment_number, reason, notes, reversal_of_adjustment_id, idempotency_key, created_by)
  values (v_adj.business_id, app.next_document_number(v_adj.business_id, 'inventory_adjustment', 'ADJ'), 'reversal',
          'Reversal of ' || v_adj.adjustment_number, v_adj.id, p_idempotency_key, auth.uid())
  returning id into v_new_id;

  for v_line in select * from public.inventory_adjustment_lines where adjustment_id = v_adj.id loop
    insert into public.inventory_adjustment_lines (
      business_id, adjustment_id, inventory_item_id, location_id, quantity_delta, unit_cost, notes
    ) values (
      v_adj.business_id, v_new_id, v_line.inventory_item_id, v_line.location_id, -v_line.quantity_delta,
      case when v_line.quantity_delta < 0 and v_line.total_cost is not null and v_line.quantity_delta <> 0
           then abs(v_line.total_cost) / abs(v_line.quantity_delta) else null end,
      'Reversal of line ' || v_line.id
    );
  end loop;

  perform public.post_inventory_adjustment(v_new_id);
  update public.inventory_adjustments set status = 'reversed' where id = v_adj.id;
  return v_new_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Reservations (used by sales/roasting in later phases; exposed now for completeness)
-- -----------------------------------------------------------------------------
create or replace function public.reserve_inventory(
  p_inventory_item_id uuid,
  p_location_id uuid,
  p_quantity bigint,
  p_source_type text,
  p_source_id uuid,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
  v_existing uuid;
  v_id uuid;
  v_on_hand bigint;
  v_reserved bigint;
begin
  select business_id into v_business_id from public.inventory_items where id = p_inventory_item_id;
  if v_business_id is null then
    raise exception 'NOT_FOUND: inventory item' using errcode = 'P0002';
  end if;
  perform app.require_permission(v_business_id, 'inventory.read');
  if p_quantity <= 0 then
    raise exception 'VALIDATION: quantity must be positive' using errcode = '22023';
  end if;

  select id into v_existing from public.inventory_reservations
  where business_id = v_business_id and idempotency_key = p_idempotency_key;
  if v_existing is not null then return v_existing; end if;

  insert into public.inventory_balances (business_id, inventory_item_id, location_id)
  values (v_business_id, p_inventory_item_id, p_location_id)
  on conflict (inventory_item_id, location_id) do nothing;

  select on_hand_quantity, reserved_quantity into v_on_hand, v_reserved
  from public.inventory_balances
  where inventory_item_id = p_inventory_item_id and location_id = p_location_id for update;

  if v_on_hand - v_reserved < p_quantity then
    raise exception 'INSUFFICIENT_STOCK: available % < requested %', v_on_hand - v_reserved, p_quantity
      using errcode = 'P0001', hint = 'insufficient_stock';
  end if;

  insert into public.inventory_reservations (business_id, inventory_item_id, location_id, quantity, source_type, source_id, idempotency_key, created_by)
  values (v_business_id, p_inventory_item_id, p_location_id, p_quantity, p_source_type, p_source_id, p_idempotency_key, auth.uid())
  returning id into v_id;

  update public.inventory_balances set reserved_quantity = reserved_quantity + p_quantity, updated_at = now()
  where inventory_item_id = p_inventory_item_id and location_id = p_location_id;

  return v_id;
end;
$$;

create or replace function public.release_inventory_reservation(p_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_res public.inventory_reservations%rowtype;
begin
  select * into v_res from public.inventory_reservations where id = p_reservation_id for update;
  if v_res.id is null then
    raise exception 'NOT_FOUND: reservation' using errcode = 'P0002';
  end if;
  perform app.require_permission(v_res.business_id, 'inventory.read');
  if v_res.status <> 'active' then return; end if;

  perform 1 from public.inventory_balances
  where inventory_item_id = v_res.inventory_item_id and location_id = v_res.location_id for update;

  update public.inventory_balances set reserved_quantity = reserved_quantity - v_res.quantity, updated_at = now()
  where inventory_item_id = v_res.inventory_item_id and location_id = v_res.location_id;

  update public.inventory_reservations set status = 'released', released_at = now() where id = v_res.id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants: RPCs callable by authenticated users (permission checks inside)
-- -----------------------------------------------------------------------------
revoke all on function public.create_purchase_order(uuid, uuid, date, text, numeric, jsonb, text) from public, anon;
revoke all on function public.update_purchase_order_draft(uuid, uuid, date, text, numeric, jsonb) from public, anon;
revoke all on function public.confirm_purchase_order(uuid) from public, anon;
revoke all on function public.cancel_purchase_order(uuid) from public, anon;
revoke all on function public.create_goods_receipt(uuid, uuid, date, numeric, text, jsonb, text) from public, anon;
revoke all on function public.post_goods_receipt(uuid) from public, anon;
revoke all on function public.create_inventory_adjustment(uuid, text, text, jsonb, text, boolean) from public, anon;
revoke all on function public.post_inventory_adjustment(uuid) from public, anon;
revoke all on function public.reverse_inventory_adjustment(uuid, text) from public, anon;
revoke all on function public.reserve_inventory(uuid, uuid, bigint, text, uuid, text) from public, anon;
revoke all on function public.release_inventory_reservation(uuid) from public, anon;

grant execute on function public.create_purchase_order(uuid, uuid, date, text, numeric, jsonb, text) to authenticated, service_role;
grant execute on function public.update_purchase_order_draft(uuid, uuid, date, text, numeric, jsonb) to authenticated, service_role;
grant execute on function public.confirm_purchase_order(uuid) to authenticated, service_role;
grant execute on function public.cancel_purchase_order(uuid) to authenticated, service_role;
grant execute on function public.create_goods_receipt(uuid, uuid, date, numeric, text, jsonb, text) to authenticated, service_role;
grant execute on function public.post_goods_receipt(uuid) to authenticated, service_role;
grant execute on function public.create_inventory_adjustment(uuid, text, text, jsonb, text, boolean) to authenticated, service_role;
grant execute on function public.post_inventory_adjustment(uuid) to authenticated, service_role;
grant execute on function public.reverse_inventory_adjustment(uuid, text) to authenticated, service_role;
grant execute on function public.reserve_inventory(uuid, uuid, bigint, text, uuid, text) to authenticated, service_role;
grant execute on function public.release_inventory_reservation(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- RLS: members can read; writes only through the functions above
-- (SECURITY DEFINER bypasses RLS; no INSERT/UPDATE/DELETE policies exist for
-- authenticated users on ledger tables, so direct writes are rejected).
-- -----------------------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('inventory_items', 'inventory.read'),
      ('inventory_balances', 'inventory.read'),
      ('inventory_movements', 'inventory.read'),
      ('inventory_cost_layers', 'inventory.read'),
      ('inventory_reservations', 'inventory.read'),
      ('inventory_adjustments', 'inventory.read'),
      ('inventory_adjustment_lines', 'inventory.read'),
      ('green_coffee_lots', 'inventory.read'),
      ('purchase_orders', 'purchases.read'),
      ('purchase_order_items', 'purchases.read'),
      ('goods_receipts', 'purchases.read'),
      ('goods_receipt_items', 'purchases.read')
    ) as v(tbl, perm)
  loop
    execute format('alter table public.%I enable row level security', t.tbl);
    execute format(
      'create policy %I_select on public.%I for select to authenticated using (app.has_permission(business_id, %L))',
      t.tbl, t.tbl, t.perm);
  end loop;
end;
$$;

-- Lot metadata (moisture, density, notes) may be edited by inventory staff; identity fields are guarded.
create policy green_coffee_lots_update on public.green_coffee_lots
  for update to authenticated
  using (app.has_permission(business_id, 'inventory.adjust'))
  with check (app.has_permission(business_id, 'inventory.adjust'));
create policy green_coffee_lots_insert on public.green_coffee_lots
  for insert to authenticated
  with check (app.has_permission(business_id, 'inventory.adjust'));

create or replace function app.green_lot_identity_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role'
     and (new.green_coffee_id <> old.green_coffee_id or new.supplier_id is distinct from old.supplier_id) then
    if exists (select 1 from public.inventory_items where item_type = 'green_coffee_lot' and reference_id = old.id) then
      raise exception 'INVALID_STATE: lot identity cannot change once stock has been received' using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;
create trigger identity_guard before update on public.green_coffee_lots
  for each row execute function app.green_lot_identity_guard();

-- Drafts: purchase orders / receipts / adjustments may be deleted while draft by managers.
create policy purchase_orders_delete on public.purchase_orders
  for delete to authenticated using (app.has_permission(business_id, 'purchases.manage') and status = 'draft');
create policy goods_receipts_delete on public.goods_receipts
  for delete to authenticated using (app.has_permission(business_id, 'purchases.post') and status = 'draft');
create policy inventory_adjustments_delete on public.inventory_adjustments
  for delete to authenticated using (app.has_permission(business_id, 'inventory.adjust') and status = 'draft');
-- Low-stock threshold is a plain setting on inventory_items.
create policy inventory_items_update on public.inventory_items
  for update to authenticated
  using (app.has_permission(business_id, 'inventory.adjust'))
  with check (app.has_permission(business_id, 'inventory.adjust'));

-- -----------------------------------------------------------------------------
-- Views (security_invoker: RLS of the underlying tables applies)
-- -----------------------------------------------------------------------------
create view public.green_lot_inventory_view
with (security_invoker = true)
as
select
  l.id as lot_id,
  l.business_id,
  l.lot_code,
  l.received_at,
  l.moisture_pct,
  l.density_g_per_100ml,
  gc.id as green_coffee_id,
  gc.name as coffee_name,
  gc.country,
  gc.region,
  gc.processing_method,
  gc.low_stock_threshold_g,
  s.id as supplier_id,
  s.name as supplier_name,
  ii.id as inventory_item_id,
  ii.low_stock_threshold,
  coalesce(cl.received_quantity, 0)::bigint as received_quantity_g,
  coalesce(b.on_hand, 0)::bigint as on_hand_g,
  coalesce(b.reserved, 0)::bigint as reserved_g,
  (coalesce(b.on_hand, 0) - coalesce(b.reserved, 0))::bigint as available_g,
  coalesce(cl.original_cost, 0)::numeric(14, 2) as total_received_cost,
  coalesce(cl.remaining_cost, 0)::numeric(14, 2) as stock_value,
  case when coalesce(cl.received_quantity, 0) > 0
       then round(cl.original_cost / cl.received_quantity * 1000, 2) else null end::numeric(14, 2) as cost_per_kg,
  mv.last_received_at,
  case
    when coalesce(b.on_hand, 0) - coalesce(b.reserved, 0) <= 0 then 'out_of_stock'
    when coalesce(ii.low_stock_threshold, gc.low_stock_threshold_g) is not null
         and coalesce(b.on_hand, 0) - coalesce(b.reserved, 0) <= coalesce(ii.low_stock_threshold, gc.low_stock_threshold_g) then 'low_stock'
    else 'in_stock'
  end as stock_status
from public.green_coffee_lots l
join public.green_coffees gc on gc.id = l.green_coffee_id
left join public.suppliers s on s.id = l.supplier_id
left join public.inventory_items ii on ii.item_type = 'green_coffee_lot' and ii.reference_id = l.id
left join lateral (
  select sum(on_hand_quantity) as on_hand, sum(reserved_quantity) as reserved
  from public.inventory_balances ib where ib.inventory_item_id = ii.id
) b on true
left join lateral (
  select sum(received_quantity) as received_quantity, sum(original_cost) as original_cost, sum(remaining_cost) as remaining_cost
  from public.inventory_cost_layers c where c.inventory_item_id = ii.id
) cl on true
left join lateral (
  select max(posted_at) as last_received_at
  from public.inventory_movements m where m.inventory_item_id = ii.id and m.movement_type = 'receipt'
) mv on true;

create view public.inventory_reconciliation_view
with (security_invoker = true)
as
select
  b.business_id,
  b.inventory_item_id,
  b.location_id,
  b.on_hand_quantity,
  coalesce(m.sum_delta, 0)::bigint as ledger_quantity,
  (b.on_hand_quantity - coalesce(m.sum_delta, 0))::bigint as difference
from public.inventory_balances b
left join lateral (
  select sum(quantity_delta) as sum_delta
  from public.inventory_movements im
  where im.inventory_item_id = b.inventory_item_id and im.location_id = b.location_id
) m on true;

create view public.inventory_movement_history_view
with (security_invoker = true)
as
select
  m.id,
  m.business_id,
  m.inventory_item_id,
  ii.item_type,
  ii.base_unit,
  m.location_id,
  loc.name as location_name,
  m.quantity_delta,
  m.movement_type,
  m.source_type,
  m.source_id,
  m.total_cost,
  m.notes,
  m.posted_at,
  m.created_by,
  up.full_name as created_by_name,
  l.id as lot_id,
  l.lot_code,
  gc.name as coffee_name
from public.inventory_movements m
join public.inventory_items ii on ii.id = m.inventory_item_id
join public.inventory_locations loc on loc.id = m.location_id
left join public.user_profiles up on up.id = m.created_by
left join public.green_coffee_lots l on ii.item_type = 'green_coffee_lot' and l.id = ii.reference_id
left join public.green_coffees gc on gc.id = l.green_coffee_id;

grant select on public.green_lot_inventory_view to authenticated, service_role;
grant select on public.inventory_reconciliation_view to authenticated, service_role;
grant select on public.inventory_movement_history_view to authenticated, service_role;
