-- =============================================================================
-- Production hardening (architecture review findings)
--  H1  Draft sales orders: financial columns could be edited directly, bypassing
--      app.replace_order_items(); totals/status/payment columns are now frozen
--      for every status unless a sales function is posting.
--  H2  reserve_inventory / release_inventory_reservation only required
--      inventory.read, so viewers could hold stock; now sales.manage or
--      inventory.adjust.
--  H3  audit_logs could be modified by the service role; now immutable.
--  H4  Cost snapshots on finished_goods_lots, roast_batches (drafts),
--      packaging_sessions, inventory_items.reference_id and voided/allocated
--      expenses could be overwritten by roles with update rights; guarded.
-- =============================================================================

-- H3: audit trail integrity --------------------------------------------------
create trigger immutable_audit before update or delete on public.audit_logs
  for each row execute function app.forbid_change();

-- H2: reservation permissions -------------------------------------------------
create or replace function app.require_any_permission(p_business_id uuid, p_permissions text[])
returns void
language plpgsql
stable
set search_path = ''
as $$
declare p text;
begin
  if auth.role() = 'service_role' then return; end if;
  foreach p in array p_permissions loop
    if app.has_permission(p_business_id, p) then return; end if;
  end loop;
  raise exception 'FORBIDDEN: missing permission %', array_to_string(p_permissions, ' or ') using errcode = '42501';
end;
$$;

create or replace function public.reserve_inventory(
  p_inventory_item_id uuid, p_location_id uuid, p_quantity bigint, p_source_type text, p_source_id uuid, p_idempotency_key text
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
  if v_business_id is null then raise exception 'NOT_FOUND: inventory item' using errcode = 'P0002'; end if;
  perform app.require_any_permission(v_business_id, array['sales.manage', 'inventory.adjust']);
  if p_quantity <= 0 then raise exception 'VALIDATION: quantity must be positive' using errcode = '22023'; end if;
  select id into v_existing from public.inventory_reservations where business_id = v_business_id and idempotency_key = p_idempotency_key;
  if v_existing is not null then return v_existing; end if;
  insert into public.inventory_balances (business_id, inventory_item_id, location_id) values (v_business_id, p_inventory_item_id, p_location_id)
  on conflict (inventory_item_id, location_id) do nothing;
  select on_hand_quantity, reserved_quantity into v_on_hand, v_reserved from public.inventory_balances
  where inventory_item_id = p_inventory_item_id and location_id = p_location_id for update;
  if v_on_hand - v_reserved < p_quantity then
    raise exception 'INSUFFICIENT_STOCK: available % < requested %', v_on_hand - v_reserved, p_quantity using errcode = 'P0001', hint = 'insufficient_stock';
  end if;
  insert into public.inventory_reservations (business_id, inventory_item_id, location_id, quantity, source_type, source_id, idempotency_key, created_by)
  values (v_business_id, p_inventory_item_id, p_location_id, p_quantity, p_source_type, p_source_id, p_idempotency_key, auth.uid()) returning id into v_id;
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
declare v_res public.inventory_reservations%rowtype;
begin
  select * into v_res from public.inventory_reservations where id = p_reservation_id for update;
  if v_res.id is null then raise exception 'NOT_FOUND: reservation' using errcode = 'P0002'; end if;
  perform app.require_any_permission(v_res.business_id, array['sales.manage', 'inventory.adjust']);
  if v_res.status <> 'active' then return; end if;
  perform 1 from public.inventory_balances where inventory_item_id = v_res.inventory_item_id and location_id = v_res.location_id for update;
  update public.inventory_balances set reserved_quantity = reserved_quantity - v_res.quantity, updated_at = now()
  where inventory_item_id = v_res.inventory_item_id and location_id = v_res.location_id;
  update public.inventory_reservations set status = 'released', released_at = now() where id = v_res.id;
end;
$$;

-- H1: sales order financial columns are function-only in every status -------
create or replace function app.sales_order_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_catalog.current_setting('app.posting', true) = 'on' then return new; end if;
  if new.subtotal is distinct from old.subtotal or new.discount_amount is distinct from old.discount_amount
     or new.total_amount is distinct from old.total_amount or new.status is distinct from old.status
     or new.amount_paid is distinct from old.amount_paid or new.amount_refunded is distinct from old.amount_refunded
     or new.payment_status is distinct from old.payment_status or new.order_number is distinct from old.order_number
     or new.confirmed_at is distinct from old.confirmed_at or new.completed_at is distinct from old.completed_at
     or new.cancelled_at is distinct from old.cancelled_at or new.idempotency_key is distinct from old.idempotency_key then
    raise exception 'INVALID_STATE: order % - status, totals and payments change only through sales functions', old.order_number using errcode = '55000';
  end if;
  if old.status <> 'draft' and (new.customer_id is distinct from old.customer_id or new.sales_channel_id is distinct from old.sales_channel_id
     or new.price_tier is distinct from old.price_tier or new.ordered_at is distinct from old.ordered_at) then
    raise exception 'INVALID_STATE: order % is % - only notes and due date may change', old.order_number, old.status using errcode = '55000';
  end if;
  return new;
end;
$$;

-- H4: snapshot guards ---------------------------------------------------------
create or replace function app.roast_batch_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_catalog.current_setting('app.posting', true) = 'on' then return new; end if;
  if new.status is distinct from old.status or new.green_weight_g is distinct from old.green_weight_g
     or new.roasted_weight_g is distinct from old.roasted_weight_g or new.green_cost is distinct from old.green_cost
     or new.production_cost_total is distinct from old.production_cost_total or new.roasted_cost_per_g is distinct from old.roasted_cost_per_g
     or new.roast_loss_pct is distinct from old.roast_loss_pct or new.roast_yield_pct is distinct from old.roast_yield_pct
     or new.batch_number is distinct from old.batch_number or new.completed_at is distinct from old.completed_at
     or new.voided_at is distinct from old.voided_at or new.idempotency_key is distinct from old.idempotency_key then
    raise exception 'INVALID_STATE: roast batch % - status, weights and costs change only through roast functions (immutable)', old.batch_number using errcode = '55000';
  end if;
  if old.status in ('completed', 'voided') and (new.roaster_id is distinct from old.roaster_id or new.location_id is distinct from old.location_id
     or new.roast_level is distinct from old.roast_level or new.total_duration_seconds is distinct from old.total_duration_seconds
     or new.first_crack_seconds is distinct from old.first_crack_seconds) then
    raise exception 'INVALID_STATE: roast batch % is % and its stock-affecting fields are immutable', old.batch_number, old.status using errcode = '55000';
  end if;
  return new;
end;
$$;

create or replace function app.packaging_session_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_catalog.current_setting('app.posting', true) = 'on' then return new; end if;
  if new.status is distinct from old.status or new.required_weight_g is distinct from old.required_weight_g
     or new.input_weight_g is distinct from old.input_weight_g or new.coffee_cost is distinct from old.coffee_cost
     or new.material_cost is distinct from old.material_cost or new.total_cost is distinct from old.total_cost
     or new.session_number is distinct from old.session_number or new.completed_at is distinct from old.completed_at
     or new.idempotency_key is distinct from old.idempotency_key then
    raise exception 'INVALID_STATE: packaging session % - status, weights and costs change only through packaging functions (immutable)', old.session_number using errcode = '55000';
  end if;
  if old.status in ('completed', 'voided') and (new.labor_cost is distinct from old.labor_cost or new.overhead_cost is distinct from old.overhead_cost
     or new.location_id is distinct from old.location_id or new.packaged_at is distinct from old.packaged_at) then
    raise exception 'INVALID_STATE: packaging session % is % and its stock-affecting fields are immutable', old.session_number, old.status using errcode = '55000';
  end if;
  return new;
end;
$$;

create or replace function app.finished_lot_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_catalog.current_setting('app.posting', true) = 'on' then return new; end if;
  if new.quantity is distinct from old.quantity or new.unit_cost is distinct from old.unit_cost or new.total_cost is distinct from old.total_cost
     or new.variant_id is distinct from old.variant_id or new.packaging_session_id is distinct from old.packaging_session_id
     or new.packaged_at is distinct from old.packaged_at then
    raise exception 'INVALID_STATE: finished lot % cost and quantity snapshots are immutable', old.lot_code using errcode = '55000';
  end if;
  return new;
end;
$$;
create trigger guard before update on public.finished_goods_lots for each row execute function app.finished_lot_guard();

create or replace function app.inventory_item_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_catalog.current_setting('app.posting', true) = 'on' then return new; end if;
  if new.item_type is distinct from old.item_type or new.reference_id is distinct from old.reference_id or new.base_unit is distinct from old.base_unit then
    raise exception 'INVALID_STATE: inventory item identity is immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;
create trigger guard before update on public.inventory_items for each row execute function app.inventory_item_guard();

create or replace function app.expense_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare v_alloc numeric;
begin
  if old.is_voided then
    raise exception 'INVALID_STATE: expense % is voided and immutable', old.expense_number using errcode = '55000';
  end if;
  if new.expense_number is distinct from old.expense_number or new.idempotency_key is distinct from old.idempotency_key then
    raise exception 'INVALID_STATE: expense number is immutable' using errcode = '55000';
  end if;
  select coalesce(sum(amount), 0) into v_alloc from public.cost_allocations where expense_id = old.id;
  if new.amount < v_alloc then
    raise exception 'VALIDATION: amount (%) cannot be lower than existing allocations (%)', new.amount, v_alloc using errcode = '22023';
  end if;
  if new.is_voided and v_alloc > 0 then
    delete from public.cost_allocations where expense_id = old.id;
  end if;
  return new;
end;
$$;
create trigger guard before update on public.expenses for each row execute function app.expense_guard();

-- Lots: identity + received_at only via functions once stock exists (lot_code and quality fields remain editable).
create or replace function app.green_lot_identity_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_catalog.current_setting('app.posting', true) = 'on' or auth.role() = 'service_role' then return new; end if;
  if new.green_coffee_id <> old.green_coffee_id or new.supplier_id is distinct from old.supplier_id then
    if exists (select 1 from public.inventory_items where item_type = 'green_coffee_lot' and reference_id = old.id) then
      raise exception 'INVALID_STATE: lot identity cannot change once stock has been received' using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;

-- Triggers that temporarily enable app.posting must restore the caller's value, otherwise a
-- posting function that updates inputs mid-way would trip the guards above.
create or replace function app.recalc_roast_green_weight()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_batch_id uuid := coalesce(new.roast_batch_id, old.roast_batch_id);
  v_prev text := pg_catalog.current_setting('app.posting', true);
begin
  perform set_config('app.posting', 'on', true);
  update public.roast_batches b
  set green_weight_g = coalesce((select sum(input_weight_g) from public.roast_batch_inputs i where i.roast_batch_id = b.id), 0)
  where b.id = v_batch_id;
  perform set_config('app.posting', coalesce(nullif(v_prev, ''), 'off'), true);
  return null;
end;
$$;

create or replace function app.recalc_sales_order(p_order_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare v_prev text := pg_catalog.current_setting('app.posting', true);
begin
  perform set_config('app.posting', 'on', true);
  update public.sales_orders o
  set subtotal = coalesce((select sum(i.quantity * i.unit_price) from public.sales_order_items i where i.order_id = o.id), 0),
      total_amount = greatest(0, coalesce((select sum(i.line_total) from public.sales_order_items i where i.order_id = o.id), 0) - o.discount_amount)
  where o.id = p_order_id;
  perform set_config('app.posting', coalesce(nullif(v_prev, ''), 'off'), true);
end;
$$;

create or replace function public.start_roast_batch(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_batch public.roast_batches%rowtype;
begin
  select * into v_batch from public.roast_batches where id = p_batch_id for update;
  if v_batch.id is null then raise exception 'NOT_FOUND: roast batch' using errcode = 'P0002'; end if;
  perform app.require_permission(v_batch.business_id, 'roasting.manage');
  if v_batch.status = 'in_progress' then return; end if;
  if v_batch.status <> 'draft' then raise exception 'INVALID_STATE: roast batch is %', v_batch.status using errcode = '55000'; end if;
  if v_batch.green_weight_g <= 0 then raise exception 'VALIDATION: add green coffee inputs before starting' using errcode = '22023'; end if;
  perform set_config('app.posting', 'on', true);
  update public.roast_batches set status = 'in_progress', started_at = now() where id = v_batch.id;
end;
$$;
