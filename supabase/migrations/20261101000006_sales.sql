-- =============================================================================
-- Phase 5: Sales - customers, orders, reservations, fulfillment, payments,
-- refunds, returns. Stock moves only when a fulfillment is posted; payments
-- are tracked independently of order status.
-- =============================================================================

create type public.sales_order_status as enum (
  'draft', 'confirmed', 'reserved', 'partially_fulfilled', 'fulfilled', 'completed', 'cancelled', 'returned'
);
create type public.payment_status as enum ('unpaid', 'partially_paid', 'paid', 'partially_refunded', 'refunded');
create type public.sales_fulfillment_status as enum ('draft', 'posted', 'cancelled');
create type public.sales_return_status as enum ('draft', 'posted', 'cancelled');
create type public.payment_method as enum ('cash', 'bank_transfer', 'gcash', 'maya', 'other');

-- Sales channel types requested for Phase 5.
alter table public.sales_channels drop constraint sales_channels_channel_type_check;
alter table public.sales_channels add constraint sales_channels_channel_type_check
  check (channel_type in ('direct', 'walk_in', 'facebook', 'instagram', 'shopee', 'lazada', 'wholesale', 'online', 'cafe', 'consignment', 'event', 'other'));

-- Add the standard channels to every existing business (names are unique per business).
insert into public.sales_channels (business_id, name, channel_type)
select b.id, v.name, v.channel_type
from public.businesses b
cross join (values ('Direct', 'direct'), ('Facebook', 'facebook'), ('Instagram', 'instagram'), ('Shopee', 'shopee'), ('Lazada', 'lazada')) as v(name, channel_type)
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Customers
-- -----------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  customer_type text not null default 'retail' check (customer_type in ('retail', 'wholesale')),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (phone is null or char_length(phone) <= 40),
  address text check (address is null or char_length(address) <= 500),
  payment_terms_days integer not null default 0 check (payment_terms_days between 0 and 365),
  notes text check (notes is null or char_length(notes) <= 2000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id)
);
create unique index customers_business_name_key on public.customers (business_id, lower(btrim(name)));
create unique index customers_business_email_key on public.customers (business_id, lower(email)) where email is not null;

-- -----------------------------------------------------------------------------
-- Orders
-- -----------------------------------------------------------------------------
create table public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  order_number text not null,
  customer_id uuid,
  sales_channel_id uuid not null,
  status public.sales_order_status not null default 'draft',
  payment_status public.payment_status not null default 'unpaid',
  price_tier text not null default 'retail' check (price_tier in ('retail', 'wholesale')),
  ordered_at date not null default (now() at time zone 'Asia/Manila')::date,
  due_at date,
  subtotal numeric(14, 2) not null default 0 check (subtotal >= 0),
  discount_amount numeric(14, 2) not null default 0 check (discount_amount >= 0),
  total_amount numeric(14, 2) not null default 0 check (total_amount >= 0),
  amount_paid numeric(14, 2) not null default 0 check (amount_paid >= 0),
  amount_refunded numeric(14, 2) not null default 0 check (amount_refunded >= 0),
  notes text check (notes is null or char_length(notes) <= 4000),
  idempotency_key text,
  created_by uuid,
  confirmed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, order_number),
  unique (business_id, idempotency_key),
  unique (id, business_id),
  foreign key (customer_id, business_id) references public.customers (id, business_id) on delete restrict,
  foreign key (sales_channel_id, business_id) references public.sales_channels (id, business_id) on delete restrict
);
create index sales_orders_business_status_idx on public.sales_orders (business_id, status, ordered_at desc);
create index sales_orders_customer_idx on public.sales_orders (customer_id);

create table public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  order_id uuid not null,
  product_variant_id uuid not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  discount_amount numeric(14, 2) not null default 0 check (discount_amount >= 0),
  line_total numeric(14, 2) not null check (line_total >= 0),
  fulfilled_quantity integer not null default 0 check (fulfilled_quantity >= 0),
  returned_quantity integer not null default 0 check (returned_quantity >= 0),
  created_at timestamptz not null default now(),
  unique (id, business_id),
  foreign key (order_id, business_id) references public.sales_orders (id, business_id) on delete cascade,
  foreign key (product_variant_id, business_id) references public.product_variants (id, business_id) on delete restrict,
  check (fulfilled_quantity <= quantity)
);
create index sales_order_items_order_idx on public.sales_order_items (order_id);

-- Which finished lots are reserved for which order line (FIFO allocation at confirmation).
create table public.sales_order_allocations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  order_item_id uuid not null,
  finished_goods_lot_id uuid not null,
  location_id uuid not null,
  reservation_id uuid references public.inventory_reservations (id) on delete set null,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (order_item_id, finished_goods_lot_id, location_id),
  foreign key (order_item_id, business_id) references public.sales_order_items (id, business_id) on delete cascade,
  foreign key (finished_goods_lot_id, business_id) references public.finished_goods_lots (id, business_id) on delete restrict,
  foreign key (location_id, business_id) references public.inventory_locations (id, business_id) on delete restrict
);

-- -----------------------------------------------------------------------------
-- Fulfillment
-- -----------------------------------------------------------------------------
create table public.sales_fulfillments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  order_id uuid not null,
  fulfillment_number text not null,
  status public.sales_fulfillment_status not null default 'draft',
  location_id uuid not null,
  fulfilled_at date not null default (now() at time zone 'Asia/Manila')::date,
  posted_at timestamptz,
  posted_by uuid,
  notes text check (notes is null or char_length(notes) <= 2000),
  idempotency_key text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, fulfillment_number),
  unique (business_id, idempotency_key),
  unique (id, business_id),
  foreign key (order_id, business_id) references public.sales_orders (id, business_id) on delete restrict,
  foreign key (location_id, business_id) references public.inventory_locations (id, business_id) on delete restrict
);
create index sales_fulfillments_order_idx on public.sales_fulfillments (order_id);

create table public.sales_fulfillment_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  fulfillment_id uuid not null,
  order_item_id uuid not null,
  finished_goods_lot_id uuid not null,
  quantity integer not null check (quantity > 0),
  unit_cost_snapshot numeric(14, 6),
  total_cost numeric(14, 2),
  unit_price_snapshot numeric(14, 2),
  returned_quantity integer not null default 0 check (returned_quantity >= 0),
  created_at timestamptz not null default now(),
  unique (id, business_id),
  foreign key (fulfillment_id, business_id) references public.sales_fulfillments (id, business_id) on delete cascade,
  foreign key (order_item_id, business_id) references public.sales_order_items (id, business_id) on delete restrict,
  foreign key (finished_goods_lot_id, business_id) references public.finished_goods_lots (id, business_id) on delete restrict,
  check (returned_quantity <= quantity)
);
create index sales_fulfillment_items_fulfillment_idx on public.sales_fulfillment_items (fulfillment_id);
create index sales_fulfillment_items_lot_idx on public.sales_fulfillment_items (finished_goods_lot_id);

-- -----------------------------------------------------------------------------
-- Payments & refunds (independent of order status)
-- -----------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  order_id uuid not null,
  amount numeric(14, 2) not null check (amount > 0),
  payment_method public.payment_method not null,
  payment_reference text check (payment_reference is null or char_length(payment_reference) <= 120),
  status text not null default 'received' check (status in ('received', 'voided')),
  received_at date not null default (now() at time zone 'Asia/Manila')::date,
  notes text check (notes is null or char_length(notes) <= 1000),
  idempotency_key text not null,
  recorded_by uuid,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  unique (business_id, idempotency_key),
  unique (id, business_id),
  foreign key (order_id, business_id) references public.sales_orders (id, business_id) on delete restrict
);
create index payments_order_idx on public.payments (order_id);
-- the same reference cannot be recorded twice for one order (duplicate submission guard)
create unique index payments_order_reference_key on public.payments (order_id, lower(payment_reference)) where payment_reference is not null and status = 'received';

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  payment_id uuid not null,
  order_id uuid not null,
  amount numeric(14, 2) not null check (amount > 0),
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  refund_method public.payment_method not null,
  status text not null default 'issued' check (status in ('issued', 'voided')),
  refunded_at date not null default (now() at time zone 'Asia/Manila')::date,
  idempotency_key text not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (business_id, idempotency_key),
  foreign key (payment_id, business_id) references public.payments (id, business_id) on delete restrict,
  foreign key (order_id, business_id) references public.sales_orders (id, business_id) on delete restrict
);
create index refunds_order_idx on public.refunds (order_id);

-- -----------------------------------------------------------------------------
-- Returns
-- -----------------------------------------------------------------------------
create table public.sales_returns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  order_id uuid not null,
  return_number text not null,
  status public.sales_return_status not null default 'draft',
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  location_id uuid not null,
  received_at date not null default (now() at time zone 'Asia/Manila')::date,
  posted_at timestamptz,
  posted_by uuid,
  notes text check (notes is null or char_length(notes) <= 2000),
  idempotency_key text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, return_number),
  unique (business_id, idempotency_key),
  unique (id, business_id),
  foreign key (order_id, business_id) references public.sales_orders (id, business_id) on delete restrict,
  foreign key (location_id, business_id) references public.inventory_locations (id, business_id) on delete restrict
);
create index sales_returns_order_idx on public.sales_returns (order_id);

create table public.sales_return_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  return_id uuid not null,
  fulfillment_item_id uuid not null,
  quantity integer not null check (quantity > 0),
  condition text not null check (condition in ('sealed', 'opened', 'damaged')),
  disposition text not null check (disposition in ('restock', 'quarantine', 'waste')),
  unit_cost_snapshot numeric(14, 6),
  created_at timestamptz not null default now(),
  unique (id, business_id),
  foreign key (return_id, business_id) references public.sales_returns (id, business_id) on delete cascade,
  foreign key (fulfillment_item_id, business_id) references public.sales_fulfillment_items (id, business_id) on delete restrict
);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
create trigger set_updated_at before update on public.customers for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.sales_orders for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.sales_fulfillments for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.sales_returns for each row execute function app.set_updated_at();
create trigger audit after insert or update or delete on public.customers for each row execute function app.audit_row_change();
create trigger audit after insert or update or delete on public.sales_orders for each row execute function app.audit_row_change();
create trigger audit after insert or update or delete on public.sales_fulfillments for each row execute function app.audit_row_change();
create trigger audit after insert or update or delete on public.payments for each row execute function app.audit_row_change();
create trigger audit after insert or update or delete on public.refunds for each row execute function app.audit_row_change();
create trigger audit after insert or update or delete on public.sales_returns for each row execute function app.audit_row_change();
create trigger lock_business before update on public.customers for each row execute function app.prevent_business_change();
create trigger lock_business before update on public.sales_orders for each row execute function app.prevent_business_change();
create trigger forbid_delete_posted before delete on public.sales_orders for each row execute function app.forbid_delete_when_posted();

-- Financial snapshots on posted documents are immutable (functions set app.posting).
create or replace function app.sales_order_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_catalog.current_setting('app.posting', true) = 'on' then return new; end if;
  if old.status <> 'draft' and (
       new.subtotal is distinct from old.subtotal or new.discount_amount is distinct from old.discount_amount
    or new.total_amount is distinct from old.total_amount or new.status is distinct from old.status
    or new.amount_paid is distinct from old.amount_paid or new.amount_refunded is distinct from old.amount_refunded
    or new.payment_status is distinct from old.payment_status or new.customer_id is distinct from old.customer_id
    or new.sales_channel_id is distinct from old.sales_channel_id) then
    raise exception 'INVALID_STATE: order % is % - status, totals and payments change only through sales functions', old.order_number, old.status using errcode = '55000';
  end if;
  return new;
end;
$$;
create trigger guard before update on public.sales_orders for each row execute function app.sales_order_guard();

create or replace function app.sales_child_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare v_status text;
begin
  if pg_catalog.current_setting('app.posting', true) = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_table_name = 'sales_order_items' then
    select status::text into v_status from public.sales_orders where id = coalesce(new.order_id, old.order_id);
  elsif tg_table_name = 'sales_fulfillment_items' then
    select status::text into v_status from public.sales_fulfillments where id = coalesce(new.fulfillment_id, old.fulfillment_id);
  else
    select status::text into v_status from public.sales_returns where id = coalesce(new.return_id, old.return_id);
  end if;
  if v_status <> 'draft' then
    raise exception 'INVALID_STATE: document is % and its lines cannot be modified', v_status using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger guard before insert or update or delete on public.sales_order_items for each row execute function app.sales_child_guard();
create trigger guard before insert or update or delete on public.sales_fulfillment_items for each row execute function app.sales_child_guard();
create trigger guard before insert or update or delete on public.sales_return_items for each row execute function app.sales_child_guard();

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function app.recalc_sales_order(p_order_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('app.posting', 'on', true);
  update public.sales_orders o
  set subtotal = coalesce((select sum(i.quantity * i.unit_price) from public.sales_order_items i where i.order_id = o.id), 0),
      total_amount = greatest(0, coalesce((select sum(i.line_total) from public.sales_order_items i where i.order_id = o.id), 0) - o.discount_amount)
  where o.id = p_order_id;
end;
$$;

-- Payment status from received payments and issued refunds; never changes revenue.
create or replace function app.refresh_payment_status(p_order_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_paid numeric;
  v_refunded numeric;
  v_total numeric;
  v_status public.payment_status;
  v_order public.sales_orders%rowtype;
begin
  select * into v_order from public.sales_orders where id = p_order_id;
  select coalesce(sum(amount), 0) into v_paid from public.payments where order_id = p_order_id and status = 'received';
  select coalesce(sum(amount), 0) into v_refunded from public.refunds where order_id = p_order_id and status = 'issued';
  v_total := v_order.total_amount;
  if v_refunded > 0 and v_paid - v_refunded <= 0 then v_status := 'refunded';
  elsif v_refunded > 0 then v_status := 'partially_refunded';
  elsif v_total > 0 and v_paid >= v_total then v_status := 'paid';
  elsif v_paid > 0 then v_status := 'partially_paid';
  elsif v_total = 0 and v_order.status in ('fulfilled', 'completed') then v_status := 'paid';
  else v_status := 'unpaid';
  end if;
  perform set_config('app.posting', 'on', true);
  update public.sales_orders set amount_paid = v_paid, amount_refunded = v_refunded, payment_status = v_status where id = p_order_id;
  -- auto-complete: fully fulfilled and fully paid
  update public.sales_orders set status = 'completed', completed_at = now()
  where id = p_order_id and status = 'fulfilled' and v_status = 'paid';
end;
$$;

-- Release the reservations held for an order (cancellation) or for a specific line quantity (fulfillment).
create or replace function app.release_order_reservations(p_order_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare v_alloc record;
begin
  for v_alloc in
    select a.*, r.quantity as reserved_qty, r.status as res_status
    from public.sales_order_allocations a
    join public.sales_order_items i on i.id = a.order_item_id
    left join public.inventory_reservations r on r.id = a.reservation_id
    where i.order_id = p_order_id
  loop
    if v_alloc.reservation_id is not null and v_alloc.res_status = 'active' then
      perform 1 from public.inventory_balances where inventory_item_id = (select inventory_item_id from public.inventory_reservations where id = v_alloc.reservation_id) and location_id = v_alloc.location_id for update;
      update public.inventory_balances b set reserved_quantity = reserved_quantity - v_alloc.reserved_qty, updated_at = now()
      from public.inventory_reservations r where r.id = v_alloc.reservation_id and b.inventory_item_id = r.inventory_item_id and b.location_id = r.location_id;
      update public.inventory_reservations set status = 'released', released_at = now() where id = v_alloc.reservation_id;
    end if;
  end loop;
  delete from public.sales_order_allocations a using public.sales_order_items i where i.id = a.order_item_id and i.order_id = p_order_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Orders
-- -----------------------------------------------------------------------------
-- p_items: [{ "product_variant_id": uuid, "quantity": int, "unit_price": numeric, "discount_amount": numeric }]
create or replace function app.replace_order_items(p_order_id uuid, p_business_id uuid, p_items jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_item jsonb;
  v_qty integer;
  v_price numeric;
  v_disc numeric;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'VALIDATION: an order needs at least one item' using errcode = '22023';
  end if;
  delete from public.sales_order_items where order_id = p_order_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'quantity')::integer;
    v_price := round(coalesce((v_item ->> 'unit_price')::numeric, 0), 2);
    v_disc := round(coalesce((v_item ->> 'discount_amount')::numeric, 0), 2);
    if v_qty is null or v_qty <= 0 then raise exception 'VALIDATION: quantity must be a positive integer' using errcode = '22023'; end if;
    if v_price < 0 or v_disc < 0 then raise exception 'VALIDATION: prices and discounts cannot be negative' using errcode = '22023'; end if;
    if v_disc > v_qty * v_price then raise exception 'VALIDATION: line discount exceeds the line amount' using errcode = '22023'; end if;
    if not exists (select 1 from public.product_variants where id = (v_item ->> 'product_variant_id')::uuid and business_id = p_business_id and is_active) then
      raise exception 'VALIDATION: product variant is not active in this business' using errcode = '23503';
    end if;
    insert into public.sales_order_items (business_id, order_id, product_variant_id, quantity, unit_price, discount_amount, line_total)
    values (p_business_id, p_order_id, (v_item ->> 'product_variant_id')::uuid, v_qty, v_price, v_disc, v_qty * v_price - v_disc);
  end loop;
  perform app.recalc_sales_order(p_order_id);
end;
$$;

create or replace function public.create_sales_order(
  p_business_id uuid,
  p_customer_id uuid,
  p_sales_channel_id uuid,
  p_price_tier text,
  p_ordered_at date,
  p_due_at date,
  p_discount_amount numeric,
  p_notes text,
  p_items jsonb,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  perform app.require_permission(p_business_id, 'sales.manage');
  select id into v_id from public.sales_orders where business_id = p_business_id and idempotency_key = p_idempotency_key;
  if v_id is not null then return v_id; end if;
  if p_customer_id is not null and not exists (select 1 from public.customers where id = p_customer_id and business_id = p_business_id and is_active) then
    raise exception 'VALIDATION: customer is not active in this business' using errcode = '23503';
  end if;
  if not exists (select 1 from public.sales_channels where id = p_sales_channel_id and business_id = p_business_id and is_active) then
    raise exception 'VALIDATION: sales channel is not active in this business' using errcode = '23503';
  end if;
  insert into public.sales_orders (business_id, order_number, customer_id, sales_channel_id, price_tier, ordered_at, due_at, discount_amount, notes, idempotency_key, created_by)
  values (p_business_id, app.next_document_number(p_business_id, 'sales_order', 'SO'), p_customer_id, p_sales_channel_id, coalesce(p_price_tier, 'retail'),
          coalesce(p_ordered_at, (now() at time zone 'Asia/Manila')::date), p_due_at, coalesce(round(p_discount_amount, 2), 0), p_notes, p_idempotency_key, auth.uid())
  returning id into v_id;
  perform app.replace_order_items(v_id, p_business_id, p_items);
  return v_id;
end;
$$;

create or replace function public.update_sales_order_draft(
  p_order_id uuid, p_customer_id uuid, p_sales_channel_id uuid, p_price_tier text, p_ordered_at date, p_due_at date,
  p_discount_amount numeric, p_notes text, p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_o public.sales_orders%rowtype;
begin
  select * into v_o from public.sales_orders where id = p_order_id for update;
  if v_o.id is null then raise exception 'NOT_FOUND: sales order' using errcode = 'P0002'; end if;
  perform app.require_permission(v_o.business_id, 'sales.manage');
  if v_o.status <> 'draft' then raise exception 'INVALID_STATE: only draft orders can be edited' using errcode = '55000'; end if;
  update public.sales_orders set customer_id = p_customer_id, sales_channel_id = p_sales_channel_id, price_tier = coalesce(p_price_tier, price_tier),
    ordered_at = coalesce(p_ordered_at, ordered_at), due_at = p_due_at, discount_amount = coalesce(round(p_discount_amount, 2), 0), notes = p_notes
  where id = v_o.id;
  perform app.replace_order_items(v_o.id, v_o.business_id, p_items);
  return v_o.id;
end;
$$;

-- Confirm: validates availability per variant and reserves finished lots FIFO (oldest packaged first).
create or replace function public.confirm_sales_order(p_order_id uuid, p_reserve boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_o public.sales_orders%rowtype;
  v_item record;
  v_lot record;
  v_remaining integer;
  v_take integer;
  v_res_id uuid;
  v_avail integer;
begin
  select * into v_o from public.sales_orders where id = p_order_id for update;
  if v_o.id is null then raise exception 'NOT_FOUND: sales order' using errcode = 'P0002'; end if;
  perform app.require_permission(v_o.business_id, 'sales.manage');
  if v_o.status in ('confirmed', 'reserved') then return; end if;
  if v_o.status <> 'draft' then raise exception 'INVALID_STATE: order is %', v_o.status using errcode = '55000'; end if;
  if not exists (select 1 from public.sales_order_items where order_id = v_o.id) then
    raise exception 'VALIDATION: cannot confirm an order without items' using errcode = '22023';
  end if;
  perform set_config('app.posting', 'on', true);

  if p_reserve then
    for v_item in select * from public.sales_order_items where order_id = v_o.id order by created_at, id loop
      v_remaining := v_item.quantity;
      for v_lot in
        select fl.id as lot_id, ii.id as item_id, b.location_id, b.on_hand_quantity - b.reserved_quantity as available
        from public.finished_goods_lots fl
        join public.inventory_items ii on ii.item_type = 'finished_product' and ii.reference_id = fl.id
        join public.inventory_balances b on b.inventory_item_id = ii.id
        where fl.variant_id = v_item.product_variant_id and fl.business_id = v_o.business_id and b.on_hand_quantity - b.reserved_quantity > 0
        order by fl.packaged_at, fl.best_before_at nulls last, fl.lot_code
        for update of b
      loop
        exit when v_remaining <= 0;
        v_take := least(v_lot.available, v_remaining);
        v_res_id := public.reserve_inventory(v_lot.item_id, v_lot.location_id, v_take, 'sales_order_item', v_item.id, 'so:' || v_o.id || ':' || v_item.id || ':' || v_lot.lot_id);
        insert into public.sales_order_allocations (business_id, order_item_id, finished_goods_lot_id, location_id, reservation_id, quantity)
        values (v_o.business_id, v_item.id, v_lot.lot_id, v_lot.location_id, v_res_id, v_take);
        v_remaining := v_remaining - v_take;
      end loop;
      if v_remaining > 0 then
        select coalesce(sum(b.on_hand_quantity - b.reserved_quantity), 0) into v_avail
        from public.finished_goods_lots fl join public.inventory_items ii on ii.item_type = 'finished_product' and ii.reference_id = fl.id
        join public.inventory_balances b on b.inventory_item_id = ii.id where fl.variant_id = v_item.product_variant_id;
        raise exception 'INSUFFICIENT_STOCK: only % unit(s) available for % (ordered %)', v_avail + (v_item.quantity - v_remaining), (select sku from public.product_variants where id = v_item.product_variant_id), v_item.quantity
          using errcode = 'P0001', hint = 'insufficient_stock';
      end if;
    end loop;
    update public.sales_orders set status = 'reserved', confirmed_at = now() where id = v_o.id;
  else
    update public.sales_orders set status = 'confirmed', confirmed_at = now() where id = v_o.id;
  end if;
end;
$$;

create or replace function public.cancel_sales_order(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_o public.sales_orders%rowtype;
begin
  select * into v_o from public.sales_orders where id = p_order_id for update;
  if v_o.id is null then raise exception 'NOT_FOUND: sales order' using errcode = 'P0002'; end if;
  perform app.require_permission(v_o.business_id, 'sales.manage');
  if v_o.status = 'cancelled' then return; end if;
  if v_o.status not in ('draft', 'confirmed', 'reserved') then
    raise exception 'INVALID_STATE: orders with posted fulfillments cannot be cancelled; use a return' using errcode = '55000';
  end if;
  if v_o.amount_paid - v_o.amount_refunded > 0 then
    raise exception 'INVALID_STATE: refund the payments before cancelling this order' using errcode = '55000';
  end if;
  perform set_config('app.posting', 'on', true);
  perform app.release_order_reservations(v_o.id);
  update public.sales_orders set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason where id = v_o.id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Fulfillment: create + post atomically. p_items: [{ "order_item_id": uuid, "finished_goods_lot_id": uuid, "quantity": int }]
-- Omitted/empty items = fulfil everything outstanding from the reserved allocations.
-- -----------------------------------------------------------------------------
create or replace function public.fulfill_sales_order(
  p_order_id uuid,
  p_location_id uuid,
  p_fulfilled_at date,
  p_items jsonb,
  p_notes text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_o public.sales_orders%rowtype;
  v_f_id uuid;
  v_line jsonb;
  v_items jsonb := p_items;
  v_oi public.sales_order_items%rowtype;
  v_lot_id uuid;
  v_qty integer;
  v_item_id uuid;
  v_loc uuid;
  v_alloc record;
  v_release integer;
  v_cost numeric;
  v_fi_id uuid;
  v_all boolean;
begin
  select * into v_o from public.sales_orders where id = p_order_id for update;
  if v_o.id is null then raise exception 'NOT_FOUND: sales order' using errcode = 'P0002'; end if;
  perform app.require_permission(v_o.business_id, 'sales.manage');
  select id into v_f_id from public.sales_fulfillments where business_id = v_o.business_id and idempotency_key = p_idempotency_key;
  if v_f_id is not null then return v_f_id; end if;
  if v_o.status not in ('confirmed', 'reserved', 'partially_fulfilled') then
    raise exception 'INVALID_STATE: order is % and cannot be fulfilled', v_o.status using errcode = '55000';
  end if;
  v_loc := coalesce(p_location_id, (select default_location_id from public.business_settings where business_id = v_o.business_id));
  perform set_config('app.posting', 'on', true);

  -- Default: everything outstanding, from the reserved allocations.
  if v_items is null or jsonb_array_length(v_items) = 0 then
    select coalesce(jsonb_agg(jsonb_build_object('order_item_id', a.order_item_id, 'finished_goods_lot_id', a.finished_goods_lot_id, 'quantity', a.quantity)), '[]'::jsonb)
    into v_items
    from public.sales_order_allocations a join public.sales_order_items i on i.id = a.order_item_id where i.order_id = v_o.id;
    if jsonb_array_length(v_items) = 0 then
      raise exception 'VALIDATION: nothing is reserved for this order; choose the finished lots to ship' using errcode = '22023';
    end if;
  end if;

  insert into public.sales_fulfillments (business_id, order_id, fulfillment_number, location_id, fulfilled_at, notes, idempotency_key, created_by)
  values (v_o.business_id, v_o.id, app.next_document_number(v_o.business_id, 'sales_fulfillment', 'SF'), v_loc, coalesce(p_fulfilled_at, (now() at time zone 'Asia/Manila')::date), p_notes, p_idempotency_key, auth.uid())
  returning id into v_f_id;

  for v_line in select * from jsonb_array_elements(v_items) loop
    select * into v_oi from public.sales_order_items where id = (v_line ->> 'order_item_id')::uuid and order_id = v_o.id for update;
    if v_oi.id is null then raise exception 'VALIDATION: order item does not belong to this order' using errcode = '23503'; end if;
    v_lot_id := (v_line ->> 'finished_goods_lot_id')::uuid;
    v_qty := (v_line ->> 'quantity')::integer;
    if v_qty is null or v_qty <= 0 then raise exception 'VALIDATION: quantity must be a positive integer' using errcode = '22023'; end if;
    if v_oi.fulfilled_quantity + v_qty > v_oi.quantity then
      raise exception 'VALIDATION: fulfilling % would exceed the ordered quantity (% of % already shipped)', v_qty, v_oi.fulfilled_quantity, v_oi.quantity using errcode = '22023';
    end if;
    if not exists (select 1 from public.finished_goods_lots where id = v_lot_id and business_id = v_o.business_id and variant_id = v_oi.product_variant_id) then
      raise exception 'VALIDATION: finished lot does not match the ordered product' using errcode = '23503';
    end if;
    select id into v_item_id from public.inventory_items where item_type = 'finished_product' and reference_id = v_lot_id;

    -- Release this order's own reservation on that lot (up to qty) before deducting.
    select a.*, r.quantity as reserved_qty, r.inventory_item_id, r.status as res_status into v_alloc
    from public.sales_order_allocations a join public.inventory_reservations r on r.id = a.reservation_id
    where a.order_item_id = v_oi.id and a.finished_goods_lot_id = v_lot_id and r.status = 'active' limit 1;
    if v_alloc.id is not null then
      v_release := least(v_alloc.reserved_qty, v_qty);
      perform 1 from public.inventory_balances where inventory_item_id = v_item_id and location_id = v_alloc.location_id for update;
      update public.inventory_balances set reserved_quantity = reserved_quantity - v_release, updated_at = now() where inventory_item_id = v_item_id and location_id = v_alloc.location_id;
      if v_alloc.reserved_qty - v_release = 0 then
        update public.inventory_reservations set status = 'consumed', released_at = now() where id = v_alloc.reservation_id;
        delete from public.sales_order_allocations where id = v_alloc.id;
      else
        update public.inventory_reservations set quantity = quantity - v_release where id = v_alloc.reservation_id;
        update public.sales_order_allocations set quantity = quantity - v_release where id = v_alloc.id;
      end if;
      v_loc := v_alloc.location_id;
    end if;

    perform app.post_movement(v_o.business_id, v_item_id, v_loc, -v_qty, 'sale', 'sales_fulfillment', v_f_id,
      'sf:' || v_f_id || ':' || v_oi.id || ':' || v_lot_id, 0, 'Order ' || v_o.order_number, auth.uid());
    v_cost := app.consume_cost_layers(v_item_id, v_qty);

    insert into public.sales_fulfillment_items (business_id, fulfillment_id, order_item_id, finished_goods_lot_id, quantity, unit_cost_snapshot, total_cost, unit_price_snapshot)
    values (v_o.business_id, v_f_id, v_oi.id, v_lot_id, v_qty, round(v_cost / v_qty, 6), round(v_cost, 2), v_oi.unit_price)
    returning id into v_fi_id;
    update public.sales_order_items set fulfilled_quantity = fulfilled_quantity + v_qty where id = v_oi.id;
  end loop;

  update public.sales_fulfillments set status = 'posted', posted_at = now(), posted_by = auth.uid() where id = v_f_id;
  select bool_and(fulfilled_quantity >= quantity) into v_all from public.sales_order_items where order_id = v_o.id;
  update public.sales_orders set status = case when v_all then 'fulfilled'::public.sales_order_status else 'partially_fulfilled'::public.sales_order_status end where id = v_o.id;
  perform app.refresh_payment_status(v_o.id);
  return v_f_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Payments & refunds
-- -----------------------------------------------------------------------------
create or replace function public.record_payment(
  p_order_id uuid, p_amount numeric, p_method text, p_reference text, p_received_at date, p_notes text, p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_o public.sales_orders%rowtype;
  v_id uuid;
  v_outstanding numeric;
begin
  select * into v_o from public.sales_orders where id = p_order_id for update;
  if v_o.id is null then raise exception 'NOT_FOUND: sales order' using errcode = 'P0002'; end if;
  perform app.require_permission(v_o.business_id, 'sales.manage');
  select id into v_id from public.payments where business_id = v_o.business_id and idempotency_key = p_idempotency_key;
  if v_id is not null then return v_id; end if;
  if v_o.status in ('draft', 'cancelled') then raise exception 'INVALID_STATE: confirm the order before recording payments' using errcode = '55000'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'VALIDATION: payment amount must be greater than zero' using errcode = '22023'; end if;
  v_outstanding := v_o.total_amount - (v_o.amount_paid - v_o.amount_refunded);
  if round(p_amount, 2) > v_outstanding + 0.005 then
    raise exception 'VALIDATION: payment (%) exceeds the outstanding balance (%)', round(p_amount, 2), v_outstanding using errcode = '22023';
  end if;
  if p_reference is not null and exists (select 1 from public.payments where order_id = v_o.id and status = 'received' and lower(payment_reference) = lower(p_reference)) then
    raise exception 'VALIDATION: a payment with reference "%" is already recorded for this order', p_reference using errcode = '23505';
  end if;
  perform set_config('app.posting', 'on', true);
  insert into public.payments (business_id, order_id, amount, payment_method, payment_reference, received_at, notes, idempotency_key, recorded_by)
  values (v_o.business_id, v_o.id, round(p_amount, 2), p_method::public.payment_method, nullif(btrim(coalesce(p_reference, '')), ''), coalesce(p_received_at, (now() at time zone 'Asia/Manila')::date), p_notes, p_idempotency_key, auth.uid())
  returning id into v_id;
  perform app.refresh_payment_status(v_o.id);
  return v_id;
end;
$$;

create or replace function public.issue_refund(p_payment_id uuid, p_amount numeric, p_reason text, p_method text, p_idempotency_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.payments%rowtype;
  v_id uuid;
  v_refunded numeric;
begin
  select * into v_p from public.payments where id = p_payment_id for update;
  if v_p.id is null then raise exception 'NOT_FOUND: payment' using errcode = 'P0002'; end if;
  perform app.require_permission(v_p.business_id, 'sales.manage');
  select id into v_id from public.refunds where business_id = v_p.business_id and idempotency_key = p_idempotency_key;
  if v_id is not null then return v_id; end if;
  if v_p.status <> 'received' then raise exception 'INVALID_STATE: payment is voided' using errcode = '55000'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'VALIDATION: refund amount must be greater than zero' using errcode = '22023'; end if;
  select coalesce(sum(amount), 0) into v_refunded from public.refunds where payment_id = v_p.id and status = 'issued';
  if round(p_amount, 2) > v_p.amount - v_refunded + 0.005 then
    raise exception 'VALIDATION: refund (%) exceeds the refundable amount (%) of this payment', round(p_amount, 2), v_p.amount - v_refunded using errcode = '22023';
  end if;
  perform set_config('app.posting', 'on', true);
  insert into public.refunds (business_id, payment_id, order_id, amount, reason, refund_method, idempotency_key, created_by)
  values (v_p.business_id, v_p.id, v_p.order_id, round(p_amount, 2), p_reason, coalesce(p_method, v_p.payment_method::text)::public.payment_method, p_idempotency_key, auth.uid())
  returning id into v_id;
  perform app.refresh_payment_status(v_p.order_id);
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Returns: inspected lines with a disposition; only 'restock' re-enters sellable stock.
-- p_items: [{ "fulfillment_item_id": uuid, "quantity": int, "condition": text, "disposition": text }]
-- -----------------------------------------------------------------------------
create or replace function public.create_sales_return(
  p_order_id uuid, p_location_id uuid, p_reason text, p_received_at date, p_notes text, p_items jsonb, p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_o public.sales_orders%rowtype;
  v_r_id uuid;
  v_line jsonb;
  v_fi record;
  v_qty integer;
  v_item_id uuid;
  v_loc uuid;
  v_ri_id uuid;
  v_all_returned boolean;
begin
  select * into v_o from public.sales_orders where id = p_order_id for update;
  if v_o.id is null then raise exception 'NOT_FOUND: sales order' using errcode = 'P0002'; end if;
  perform app.require_permission(v_o.business_id, 'sales.manage');
  select id into v_r_id from public.sales_returns where business_id = v_o.business_id and idempotency_key = p_idempotency_key;
  if v_r_id is not null then return v_r_id; end if;
  if v_o.status not in ('partially_fulfilled', 'fulfilled', 'completed', 'returned') then
    raise exception 'INVALID_STATE: only fulfilled orders can have returns' using errcode = '55000';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'VALIDATION: a return needs at least one line' using errcode = '22023'; end if;
  v_loc := coalesce(p_location_id, (select default_location_id from public.business_settings where business_id = v_o.business_id));
  perform set_config('app.posting', 'on', true);

  insert into public.sales_returns (business_id, order_id, return_number, reason, location_id, received_at, notes, idempotency_key, created_by)
  values (v_o.business_id, v_o.id, app.next_document_number(v_o.business_id, 'sales_return', 'SR'), p_reason, v_loc, coalesce(p_received_at, (now() at time zone 'Asia/Manila')::date), p_notes, p_idempotency_key, auth.uid())
  returning id into v_r_id;

  for v_line in select * from jsonb_array_elements(p_items) loop
    select fi.*, f.order_id as f_order_id into v_fi from public.sales_fulfillment_items fi join public.sales_fulfillments f on f.id = fi.fulfillment_id
    where fi.id = (v_line ->> 'fulfillment_item_id')::uuid for update of fi;
    if v_fi.id is null or v_fi.f_order_id <> v_o.id then raise exception 'VALIDATION: fulfillment line does not belong to this order' using errcode = '23503'; end if;
    v_qty := (v_line ->> 'quantity')::integer;
    if v_qty is null or v_qty <= 0 then raise exception 'VALIDATION: quantity must be a positive integer' using errcode = '22023'; end if;
    if v_fi.returned_quantity + v_qty > v_fi.quantity then
      raise exception 'VALIDATION: returning % would exceed the % unit(s) shipped on this line (% already returned)', v_qty, v_fi.quantity, v_fi.returned_quantity using errcode = '22023';
    end if;
    if (v_line ->> 'disposition') not in ('restock', 'quarantine', 'waste') then raise exception 'VALIDATION: unknown disposition' using errcode = '22023'; end if;
    if (v_line ->> 'condition') not in ('sealed', 'opened', 'damaged') then raise exception 'VALIDATION: unknown condition' using errcode = '22023'; end if;
    if (v_line ->> 'disposition') = 'restock' and (v_line ->> 'condition') <> 'sealed' then
      raise exception 'VALIDATION: only sealed items can be restocked' using errcode = '22023';
    end if;

    insert into public.sales_return_items (business_id, return_id, fulfillment_item_id, quantity, condition, disposition, unit_cost_snapshot)
    values (v_o.business_id, v_r_id, v_fi.id, v_qty, v_line ->> 'condition', v_line ->> 'disposition', v_fi.unit_cost_snapshot)
    returning id into v_ri_id;

    if (v_line ->> 'disposition') = 'restock' then
      select id into v_item_id from public.inventory_items where item_type = 'finished_product' and reference_id = v_fi.finished_goods_lot_id;
      perform app.post_movement(v_o.business_id, v_item_id, v_loc, v_qty, 'sale_return', 'sales_return_item', v_ri_id,
        'sr:' || v_r_id || ':' || v_ri_id, round(coalesce(v_fi.unit_cost_snapshot, 0) * v_qty, 2), 'Return ' || v_o.order_number, auth.uid());
      perform app.add_cost_layer(v_o.business_id, v_item_id, 'sales_return_item', v_ri_id, v_qty, round(coalesce(v_fi.unit_cost_snapshot, 0) * v_qty, 2), now());
    end if;

    update public.sales_fulfillment_items set returned_quantity = returned_quantity + v_qty where id = v_fi.id;
    update public.sales_order_items set returned_quantity = returned_quantity + v_qty where id = v_fi.order_item_id;
  end loop;

  update public.sales_returns set status = 'posted', posted_at = now(), posted_by = auth.uid() where id = v_r_id;
  select bool_and(returned_quantity >= fulfilled_quantity) and bool_or(fulfilled_quantity > 0) into v_all_returned from public.sales_order_items where order_id = v_o.id;
  if v_all_returned then
    update public.sales_orders set status = 'returned' where id = v_o.id;
  end if;
  return v_r_id;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.create_sales_order(uuid, uuid, uuid, text, date, date, numeric, text, jsonb, text)',
    'public.update_sales_order_draft(uuid, uuid, uuid, text, date, date, numeric, text, jsonb)',
    'public.confirm_sales_order(uuid, boolean)',
    'public.cancel_sales_order(uuid, text)',
    'public.fulfill_sales_order(uuid, uuid, date, jsonb, text, text)',
    'public.record_payment(uuid, numeric, text, text, date, text, text)',
    'public.issue_refund(uuid, numeric, text, text, text)',
    'public.create_sales_return(uuid, uuid, text, date, text, jsonb, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.customers enable row level security;
create policy customers_select on public.customers for select to authenticated using (app.has_permission(business_id, 'customers.read'));
create policy customers_insert on public.customers for insert to authenticated with check (app.has_permission(business_id, 'customers.manage'));
create policy customers_update on public.customers for update to authenticated using (app.has_permission(business_id, 'customers.manage')) with check (app.has_permission(business_id, 'customers.manage'));
create policy customers_delete on public.customers for delete to authenticated using (app.member_role(business_id) = 'owner');

do $$
declare t text;
begin
  foreach t in array array['sales_orders', 'sales_order_items', 'sales_order_allocations', 'sales_fulfillments', 'sales_fulfillment_items', 'payments', 'refunds', 'sales_returns', 'sales_return_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I_select on public.%I for select to authenticated using (app.has_permission(business_id, %L))', t, t, 'sales.read');
  end loop;
end;
$$;
create policy sales_orders_update on public.sales_orders for update to authenticated
  using (app.has_permission(business_id, 'sales.manage')) with check (app.has_permission(business_id, 'sales.manage'));
create policy sales_orders_delete on public.sales_orders for delete to authenticated
  using (app.has_permission(business_id, 'sales.manage') and status = 'draft');

-- -----------------------------------------------------------------------------
-- Views
-- -----------------------------------------------------------------------------
create view public.sales_order_summary_view
with (security_invoker = true)
as
select
  o.id, o.business_id, o.order_number, o.status, o.payment_status, o.price_tier, o.ordered_at, o.due_at,
  o.subtotal, o.discount_amount, o.total_amount, o.amount_paid, o.amount_refunded,
  (o.total_amount - (o.amount_paid - o.amount_refunded))::numeric(14, 2) as outstanding_amount,
  o.customer_id, c.name as customer_name, c.customer_type,
  o.sales_channel_id, ch.name as channel_name, ch.channel_type,
  o.notes, o.confirmed_at, o.completed_at, o.cancelled_at, o.created_at,
  i.item_count, i.ordered_units, i.fulfilled_units, i.returned_units,
  i.product_names,
  cogs.total_cogs
from public.sales_orders o
left join public.customers c on c.id = o.customer_id
join public.sales_channels ch on ch.id = o.sales_channel_id
left join lateral (
  select count(*) as item_count, sum(quantity) as ordered_units, sum(fulfilled_quantity) as fulfilled_units, sum(returned_quantity) as returned_units,
         string_agg(p.name || ' ' || pv.name || ' ×' || si.quantity, ', ' order by si.created_at) as product_names
  from public.sales_order_items si join public.product_variants pv on pv.id = si.product_variant_id join public.products p on p.id = pv.product_id
  where si.order_id = o.id
) i on true
left join lateral (
  select sum(fi.total_cost) as total_cogs from public.sales_fulfillment_items fi join public.sales_fulfillments f on f.id = fi.fulfillment_id
  where f.order_id = o.id and f.status = 'posted'
) cogs on true;

create view public.customer_summary_view
with (security_invoker = true)
as
select
  c.*,
  coalesce(s.orders, 0)::bigint as orders,
  coalesce(s.revenue, 0)::numeric(14, 2) as revenue,
  coalesce(s.outstanding, 0)::numeric(14, 2) as outstanding,
  s.last_order_at
from public.customers c
left join lateral (
  select count(*) as orders,
         sum(case when o.status in ('partially_fulfilled', 'fulfilled', 'completed', 'returned') then o.total_amount else 0 end) as revenue,
         sum(case when o.status not in ('draft', 'cancelled') then o.total_amount - (o.amount_paid - o.amount_refunded) else 0 end) as outstanding,
         max(o.ordered_at) as last_order_at
  from public.sales_orders o where o.customer_id = c.id and o.status <> 'cancelled'
) s on true;

create view public.variant_availability_view
with (security_invoker = true)
as
select pv.id as variant_id, pv.business_id, pv.sku, pv.name as variant_name, p.name as product_name, pv.net_weight_g, pv.selling_price, pv.wholesale_price, pv.is_active,
  coalesce(sum(b.on_hand_quantity), 0)::bigint as on_hand,
  coalesce(sum(b.reserved_quantity), 0)::bigint as reserved,
  coalesce(sum(b.on_hand_quantity - b.reserved_quantity), 0)::bigint as available
from public.product_variants pv
join public.products p on p.id = pv.product_id
left join public.finished_goods_lots fl on fl.variant_id = pv.id
left join public.inventory_items ii on ii.item_type = 'finished_product' and ii.reference_id = fl.id
left join public.inventory_balances b on b.inventory_item_id = ii.id
group by pv.id, pv.business_id, pv.sku, pv.name, p.name, pv.net_weight_g, pv.selling_price, pv.wholesale_price, pv.is_active;

grant select on public.sales_order_summary_view to authenticated, service_role;
grant select on public.customer_summary_view to authenticated, service_role;
grant select on public.variant_availability_view to authenticated, service_role;

-- Seed defaults: standard channels for new businesses.
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
  values (p_business_id, 'Yoshan DY-2kg', 'Yoshan', 'DY-2kg', 2000, 'Initial drum roaster') on conflict do nothing returning id into v_roaster_id;
  insert into public.inventory_locations (business_id, name, location_type)
  values (p_business_id, 'Main Roastery', 'roastery') on conflict do nothing returning id into v_location_id;
  insert into public.expense_categories (business_id, name, classification) values
    (p_business_id, 'Green Coffee', 'cogs'), (p_business_id, 'Packaging Materials', 'cogs'), (p_business_id, 'Fuel & Gas', 'operating'),
    (p_business_id, 'Electricity', 'operating'), (p_business_id, 'Labor', 'operating'), (p_business_id, 'Delivery & Logistics', 'operating'),
    (p_business_id, 'Rent', 'operating'), (p_business_id, 'Equipment', 'capital'), (p_business_id, 'Miscellaneous', 'other') on conflict do nothing;
  insert into public.sales_channels (business_id, name, channel_type) values
    (p_business_id, 'Direct', 'direct'), (p_business_id, 'Walk-in', 'walk_in'), (p_business_id, 'Facebook', 'facebook'), (p_business_id, 'Instagram', 'instagram'),
    (p_business_id, 'Shopee', 'shopee'), (p_business_id, 'Lazada', 'lazada'), (p_business_id, 'Wholesale', 'wholesale'), (p_business_id, 'Online', 'online') on conflict do nothing;
  insert into public.packaging_materials (business_id, name, base_unit, reorder_level) values
    (p_business_id, '250 g coffee bag', 'pc', 50), (p_business_id, '500 g coffee bag', 'pc', 25), (p_business_id, 'Label sticker', 'pc', 100) on conflict do nothing;
  update public.business_settings
  set default_roaster_id = coalesce(default_roaster_id, v_roaster_id), default_location_id = coalesce(default_location_id, v_location_id), currency = 'PHP', timezone = 'Asia/Manila'
  where business_id = p_business_id;
end;
$$;
