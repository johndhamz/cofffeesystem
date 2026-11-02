-- Sales history import: opening finished-goods stock + backdated, fulfilled, paid sales orders in
-- one transaction. Reuses the existing order functions so every rule (immutability, idempotency,
-- costing, audit) applies. Re-running the same batch key is a no-op for rows already created.
create or replace function public.import_sales_history(
  p_business_id uuid,
  p_batch_key text,
  p_location_id uuid,
  p_opening jsonb,
  p_orders jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_open jsonb;
  v_order jsonb;
  v_item record;
  v_lot record;
  v_idx integer := 0;
  v_lot_id uuid;
  v_item_id uuid;
  v_qty integer;
  v_cost numeric;
  v_code text;
  v_customer_id uuid;
  v_name text;
  v_order_id uuid;
  v_status public.sales_order_status;
  v_remaining integer;
  v_take integer;
  v_lines jsonb;
  v_paid numeric;
  v_lots_created integer := 0;
  v_orders_created integer := 0;
  v_orders_skipped integer := 0;
  v_units integer := 0;
  v_revenue numeric := 0;
  v_total numeric;
begin
  perform app.require_permission(p_business_id, 'sales.manage');
  perform app.require_permission(p_business_id, 'inventory.adjust');
  if p_batch_key is null or char_length(btrim(p_batch_key)) < 4 then
    raise exception 'VALIDATION: batch key is required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.inventory_locations where id = p_location_id and business_id = p_business_id and is_active) then
    raise exception 'VALIDATION: unknown or inactive location' using errcode = '23503';
  end if;
  perform set_config('app.posting', 'on', true);

  -- 1. Opening stock: one finished-goods lot per variant with the stated unit cost.
  for v_open in select * from jsonb_array_elements(coalesce(p_opening, '[]'::jsonb)) loop
    v_idx := v_idx + 1;
    v_qty := (v_open ->> 'quantity')::integer;
    v_cost := round(coalesce((v_open ->> 'unit_cost')::numeric, 0), 6);
    if v_qty is null or v_qty <= 0 then raise exception 'VALIDATION: opening quantity must be a positive integer' using errcode = '22023'; end if;
    if v_cost < 0 then raise exception 'VALIDATION: opening unit cost cannot be negative' using errcode = '22023'; end if;
    if not exists (select 1 from public.product_variants where id = (v_open ->> 'variant_id')::uuid and business_id = p_business_id) then
      raise exception 'VALIDATION: unknown product variant in opening stock' using errcode = '23503';
    end if;
    v_code := 'OPEN-' || upper(left(p_batch_key, 8)) || '-' || lpad(v_idx::text, 2, '0');
    select id into v_lot_id from public.finished_goods_lots where business_id = p_business_id and lower(btrim(lot_code)) = lower(v_code);
    if v_lot_id is not null then continue; end if;
    insert into public.finished_goods_lots (business_id, variant_id, packaging_session_id, lot_code, packaged_at, quantity, unit_cost, total_cost)
    values (p_business_id, (v_open ->> 'variant_id')::uuid, null, v_code, coalesce((v_open ->> 'packaged_at')::date, (now() at time zone 'Asia/Manila')::date),
            v_qty, v_cost, round(v_qty * v_cost, 2))
    returning id into v_lot_id;
    v_item_id := app.ensure_inventory_item(p_business_id, 'finished_product', v_lot_id, 'unit');
    perform app.post_movement(p_business_id, v_item_id, p_location_id, v_qty, 'adjustment', 'opening_finished_lot', v_lot_id,
      'import:' || p_batch_key || ':open:' || v_idx, round(v_qty * v_cost, 2), 'Opening stock (sales history import)', auth.uid());
    perform app.add_cost_layer(p_business_id, v_item_id, 'opening_finished_lot', v_lot_id, v_qty, round(v_qty * v_cost, 2),
      coalesce((v_open ->> 'packaged_at')::date, (now() at time zone 'Asia/Manila')::date)::timestamptz);
    v_lots_created := v_lots_created + 1;
  end loop;

  -- 2. Orders: create → confirm (no reservation) → fulfil FIFO from lots at the location → pay.
  for v_order in select * from jsonb_array_elements(coalesce(p_orders, '[]'::jsonb)) loop
    if coalesce(v_order ->> 'key', '') = '' then raise exception 'VALIDATION: every order needs a key' using errcode = '22023'; end if;
    v_customer_id := null;
    v_name := nullif(btrim(coalesce(v_order ->> 'customer_name', '')), '');
    if v_name is not null then
      select id into v_customer_id from public.customers where business_id = p_business_id and lower(btrim(name)) = lower(v_name) order by created_at limit 1;
      if v_customer_id is null then
        insert into public.customers (business_id, name, customer_type) values (p_business_id, v_name, 'retail') returning id into v_customer_id;
      end if;
    end if;

    select id, status into v_order_id, v_status from public.sales_orders
    where business_id = p_business_id and idempotency_key = 'import:' || p_batch_key || ':order:' || (v_order ->> 'key');
    if v_order_id is null then
      v_order_id := public.create_sales_order(p_business_id, v_customer_id, (v_order ->> 'sales_channel_id')::uuid, 'retail',
        (v_order ->> 'ordered_at')::date, null, 0, coalesce(v_order ->> 'notes', 'Imported sales history'),
        v_order -> 'items', 'import:' || p_batch_key || ':order:' || (v_order ->> 'key'));
      v_orders_created := v_orders_created + 1;
      v_status := 'draft';
    else
      v_orders_skipped := v_orders_skipped + 1;
    end if;

    if v_status = 'draft' then perform public.confirm_sales_order(v_order_id, false); end if;
    select status into v_status from public.sales_orders where id = v_order_id;

    if v_status in ('confirmed', 'reserved', 'partially_fulfilled') then
      v_lines := '[]'::jsonb;
      for v_item in select id, product_variant_id, quantity - fulfilled_quantity as remaining from public.sales_order_items where order_id = v_order_id loop
        v_remaining := v_item.remaining;
        for v_lot in
          select fl.id, b.on_hand_quantity - b.reserved_quantity as available
          from public.finished_goods_lots fl
          join public.inventory_items ii on ii.item_type = 'finished_product' and ii.reference_id = fl.id
          join public.inventory_balances b on b.inventory_item_id = ii.id and b.location_id = p_location_id
          where fl.business_id = p_business_id and fl.variant_id = v_item.product_variant_id
            and b.on_hand_quantity - b.reserved_quantity > 0
          -- opening lots of this batch first, then FIFO
          order by (fl.lot_code like 'OPEN-' || upper(left(p_batch_key, 8)) || '-%') desc, fl.packaged_at, fl.created_at
        loop
          exit when v_remaining <= 0;
          v_take := least(v_remaining, v_lot.available::integer);
          v_lines := v_lines || jsonb_build_object('order_item_id', v_item.id, 'finished_goods_lot_id', v_lot.id, 'quantity', v_take);
          v_remaining := v_remaining - v_take;
        end loop;
        if v_remaining > 0 then
          raise exception 'INSUFFICIENT_STOCK: not enough finished stock for order % (short by % units)', v_order ->> 'key', v_remaining using errcode = '55000';
        end if;
      end loop;
      perform public.fulfill_sales_order(v_order_id, p_location_id, (v_order ->> 'ordered_at')::date, v_lines,
        'Sales history import', 'import:' || p_batch_key || ':fulfil:' || (v_order ->> 'key'));
    end if;

    v_paid := round(coalesce((v_order ->> 'paid_amount')::numeric, 0), 2);
    if v_paid > 0 and not exists (
      select 1 from public.payments where order_id = v_order_id and idempotency_key = 'import:' || p_batch_key || ':pay:' || (v_order ->> 'key')
    ) then
      perform public.record_payment(v_order_id, v_paid, coalesce(v_order ->> 'payment_method', 'cash'), nullif(v_order ->> 'payment_reference', ''),
        (v_order ->> 'ordered_at')::date, 'Sales history import', 'import:' || p_batch_key || ':pay:' || (v_order ->> 'key'));
    end if;

    select coalesce(sum(quantity), 0), coalesce(sum(line_total), 0) into v_qty, v_total from public.sales_order_items where order_id = v_order_id;
    v_units := v_units + v_qty;
    v_revenue := v_revenue + v_total;
  end loop;

  return jsonb_build_object('orders_created', v_orders_created, 'orders_skipped', v_orders_skipped,
    'lots_created', v_lots_created, 'units', v_units, 'revenue', v_revenue);
end;
$$;

revoke all on function public.import_sales_history(uuid, text, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.import_sales_history(uuid, text, uuid, jsonb, jsonb) to authenticated, service_role;
