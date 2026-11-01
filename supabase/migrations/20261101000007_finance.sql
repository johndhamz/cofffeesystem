-- =============================================================================
-- Phase 6: Expenses, cost allocations, reporting read models and exports.
-- Reads cost snapshots recorded by earlier phases; introduces no second costing system.
-- =============================================================================

-- Owner-only financial reporting permission (profitability, expenses, dashboard money metrics).
insert into public.role_permissions (role, permission) values ('owner', 'finance.read') on conflict do nothing;
insert into public.role_permissions (role, permission) values ('owner', 'expenses.allocate') on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Expenses
-- -----------------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  expense_number text not null,
  expense_category_id uuid not null,
  supplier_id uuid,
  amount numeric(14, 2) not null check (amount > 0),
  incurred_at date not null default (now() at time zone 'Asia/Manila')::date,
  description text not null check (char_length(btrim(description)) between 1 and 500),
  payment_method public.payment_method,
  payment_reference text check (payment_reference is null or char_length(payment_reference) <= 120),
  receipt_path text,
  -- How the cost is recognised. Production/acquisition treatments are already inside inventory
  -- cost (batch costs, landed costs) and are therefore NOT counted as operating expenses.
  cost_treatment text not null check (cost_treatment in (
    'inventory_acquisition', 'roast_production', 'packaging_production', 'selling', 'administrative', 'other_operating', 'capital'
  )),
  notes text check (notes is null or char_length(notes) <= 2000),
  is_voided boolean not null default false,
  void_reason text,
  idempotency_key text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, expense_number),
  unique (business_id, idempotency_key),
  unique (id, business_id),
  foreign key (expense_category_id, business_id) references public.expense_categories (id, business_id) on delete restrict,
  foreign key (supplier_id, business_id) references public.suppliers (id, business_id) on delete restrict
);
create index expenses_business_date_idx on public.expenses (business_id, incurred_at desc);
create index expenses_category_idx on public.expenses (expense_category_id);

-- Links an expense (or part of it) to the production document whose recorded cost it explains.
create table public.cost_allocations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  expense_id uuid not null,
  source_type text not null default 'expense' check (source_type in ('expense')),
  source_id uuid not null,
  target_type text not null check (target_type in ('roast_batch', 'packaging_session', 'goods_receipt')),
  target_id uuid not null,
  amount numeric(14, 2) not null check (amount > 0),
  notes text check (notes is null or char_length(notes) <= 500),
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (expense_id, target_type, target_id),
  foreign key (expense_id, business_id) references public.expenses (id, business_id) on delete cascade
);
create index cost_allocations_target_idx on public.cost_allocations (target_type, target_id);

create trigger set_updated_at before update on public.expenses for each row execute function app.set_updated_at();
create trigger audit after insert or update or delete on public.expenses for each row execute function app.audit_row_change();
create trigger audit after insert or update or delete on public.cost_allocations for each row execute function app.audit_row_change();
create trigger lock_business before update on public.expenses for each row execute function app.prevent_business_change();

-- Allocations may not exceed the expense; targets must belong to the same business.
create or replace function app.cost_allocation_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_exp public.expenses%rowtype;
  v_sum numeric;
  v_ok boolean;
begin
  select * into v_exp from public.expenses where id = new.expense_id;
  if v_exp.is_voided then raise exception 'INVALID_STATE: expense is voided' using errcode = '55000'; end if;
  new.source_id := new.expense_id;
  new.business_id := v_exp.business_id;
  select coalesce(sum(amount), 0) into v_sum from public.cost_allocations where expense_id = new.expense_id and id <> new.id;
  if v_sum + new.amount > v_exp.amount + 0.005 then
    raise exception 'VALIDATION: allocations (%) would exceed the expense amount (%)', v_sum + new.amount, v_exp.amount using errcode = '22023';
  end if;
  if new.target_type = 'roast_batch' then
    select exists (select 1 from public.roast_batches where id = new.target_id and business_id = v_exp.business_id) into v_ok;
  elsif new.target_type = 'packaging_session' then
    select exists (select 1 from public.packaging_sessions where id = new.target_id and business_id = v_exp.business_id) into v_ok;
  else
    select exists (select 1 from public.goods_receipts where id = new.target_id and business_id = v_exp.business_id) into v_ok;
  end if;
  if not v_ok then raise exception 'VALIDATION: allocation target does not belong to this business' using errcode = '23503'; end if;
  return new;
end;
$$;
create trigger guard before insert or update on public.cost_allocations for each row execute function app.cost_allocation_guard();

create or replace function app.expense_number_default()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.expense_number is null or new.expense_number = '' then
    new.expense_number := app.next_document_number(new.business_id, 'expense', 'EXP');
  end if;
  return new;
end;
$$;
create trigger number_default before insert on public.expenses for each row execute function app.expense_number_default();
alter table public.expenses alter column expense_number set default '';

-- Receipts bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('expense-receipts', 'expense-receipts', false, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
create policy expense_receipts_select on storage.objects for select to authenticated
  using (bucket_id = 'expense-receipts' and app.has_permission((storage.foldername(name))[1]::uuid, 'expenses.read'));
create policy expense_receipts_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'expense-receipts' and app.has_permission((storage.foldername(name))[1]::uuid, 'expenses.manage'));
create policy expense_receipts_delete on storage.objects for delete to authenticated
  using (bucket_id = 'expense-receipts' and app.has_permission((storage.foldername(name))[1]::uuid, 'expenses.manage'));

-- RLS
alter table public.expenses enable row level security;
alter table public.cost_allocations enable row level security;
create policy expenses_select on public.expenses for select to authenticated using (app.has_permission(business_id, 'expenses.read'));
create policy expenses_insert on public.expenses for insert to authenticated with check (app.has_permission(business_id, 'expenses.manage'));
create policy expenses_update on public.expenses for update to authenticated using (app.has_permission(business_id, 'expenses.manage')) with check (app.has_permission(business_id, 'expenses.manage'));
create policy expenses_delete on public.expenses for delete to authenticated using (app.member_role(business_id) = 'owner');
create policy cost_allocations_select on public.cost_allocations for select to authenticated using (app.has_permission(business_id, 'expenses.read'));
create policy cost_allocations_insert on public.cost_allocations for insert to authenticated with check (app.has_permission(business_id, 'expenses.manage'));
create policy cost_allocations_delete on public.cost_allocations for delete to authenticated using (app.has_permission(business_id, 'expenses.manage'));

-- Reporting indexes
create index if not exists sales_fulfillments_business_date_idx on public.sales_fulfillments (business_id, fulfilled_at);
create index if not exists sales_fulfillment_items_business_idx on public.sales_fulfillment_items (business_id);
create index if not exists roast_batches_completed_idx on public.roast_batches (business_id, completed_at) where status = 'completed';
create index if not exists inventory_movements_business_type_idx on public.inventory_movements (business_id, movement_type, posted_at);

-- -----------------------------------------------------------------------------
-- Report read models
-- -----------------------------------------------------------------------------
-- One row per posted fulfilment line: the unit of revenue recognition.
-- net_units excludes returned units; net_revenue nets line + order discounts proportionally;
-- cogs = snapshot cost of units that stayed sold (restocked returns are credited back).
create view public.report_sales_lines_view
with (security_invoker = true)
as
select
  fi.id as fulfillment_item_id,
  fi.business_id,
  f.fulfilled_at as sold_at,
  o.id as order_id, o.order_number, o.ordered_at,
  c.id as customer_id, c.name as customer_name,
  ch.id as channel_id, ch.name as channel_name,
  pv.id as variant_id, pv.sku, p.id as product_id, p.name as product_name, pv.name as variant_name,
  fl.lot_code,
  fi.quantity as units,
  fi.returned_quantity as returned_units,
  (fi.quantity - fi.returned_quantity) as net_units,
  fi.unit_price_snapshot,
  fi.unit_cost_snapshot,
  round(
    (fi.quantity - fi.returned_quantity) * fi.unit_price_snapshot
    - (fi.quantity - fi.returned_quantity)::numeric * (oi.discount_amount / oi.quantity)
    - case when o.subtotal - od.line_discounts > 0
           then o.discount_amount * ((fi.quantity - fi.returned_quantity)::numeric * (oi.unit_price - oi.discount_amount / oi.quantity)) / (o.subtotal - od.line_discounts)
           else 0 end
  , 2) as net_revenue,
  round(fi.unit_cost_snapshot * (fi.quantity - coalesce(rr.restocked, 0)), 2) as cogs,
  origin.countries as origins
from public.sales_fulfillment_items fi
join public.sales_fulfillments f on f.id = fi.fulfillment_id and f.status = 'posted'
join public.sales_orders o on o.id = f.order_id
join public.sales_order_items oi on oi.id = fi.order_item_id
left join public.customers c on c.id = o.customer_id
join public.sales_channels ch on ch.id = o.sales_channel_id
join public.finished_goods_lots fl on fl.id = fi.finished_goods_lot_id
join public.product_variants pv on pv.id = fl.variant_id
join public.products p on p.id = pv.product_id
left join lateral (select coalesce(sum(discount_amount), 0) as line_discounts from public.sales_order_items x where x.order_id = o.id) od on true
left join lateral (
  select sum(ri.quantity) as restocked from public.sales_return_items ri join public.sales_returns r on r.id = ri.return_id
  where ri.fulfillment_item_id = fi.id and ri.disposition = 'restock' and r.status = 'posted'
) rr on true
left join lateral (
  select string_agg(distinct gc.country, ', ' order by gc.country) as countries
  from public.packaging_inputs pi join public.roast_batch_inputs rbi on rbi.roast_batch_id = pi.roast_batch_id
  join public.green_coffee_lots gl on gl.id = rbi.green_lot_id join public.green_coffees gc on gc.id = gl.green_coffee_id
  where pi.session_id = fl.packaging_session_id
) origin on true;

create view public.report_expenses_view
with (security_invoker = true)
as
select
  e.id, e.business_id, e.expense_number, e.incurred_at, e.amount, e.description, e.cost_treatment, e.payment_method, e.payment_reference, e.receipt_path, e.is_voided,
  ec.id as category_id, ec.name as category_name, ec.classification,
  s.id as supplier_id, s.name as supplier_name,
  coalesce(a.allocated, 0)::numeric(14, 2) as allocated_amount,
  (e.amount - coalesce(a.allocated, 0))::numeric(14, 2) as unallocated_amount,
  -- recognised as operating expense only for operating treatments
  case when e.cost_treatment in ('selling', 'administrative', 'other_operating') and not e.is_voided then e.amount else 0 end::numeric(14, 2) as operating_amount,
  e.created_at
from public.expenses e
join public.expense_categories ec on ec.id = e.expense_category_id
left join public.suppliers s on s.id = e.supplier_id
left join lateral (select sum(amount) as allocated from public.cost_allocations ca where ca.expense_id = e.id) a on true;

grant select on public.report_sales_lines_view to authenticated, service_role;
grant select on public.report_expenses_view to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Aggregations (SECURITY INVOKER: RLS applies; permission checked explicitly)
-- -----------------------------------------------------------------------------
create or replace function public.report_profitability(p_business_id uuid, p_from date, p_to date)
returns table (
  net_sales numeric, cogs numeric, gross_profit numeric, gross_margin_pct numeric,
  operating_expenses numeric, operating_result numeric, units_sold bigint, orders bigint, refunds numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not app.has_permission(p_business_id, 'finance.read') then
    raise exception 'FORBIDDEN: missing permission finance.read' using errcode = '42501';
  end if;
  return query
  with s as (
    select coalesce(sum(net_revenue), 0) as net_sales, coalesce(sum(cogs), 0) as cogs, coalesce(sum(net_units), 0) as units, count(distinct order_id) as orders
    from public.report_sales_lines_view where business_id = p_business_id and sold_at between p_from and p_to
  ), e as (
    select coalesce(sum(operating_amount), 0) as opex from public.report_expenses_view where business_id = p_business_id and incurred_at between p_from and p_to
  ), r as (
    select coalesce(sum(amount), 0) as refunds from public.refunds where business_id = p_business_id and status = 'issued' and refunded_at between p_from and p_to
  )
  select s.net_sales, s.cogs, s.net_sales - s.cogs, case when s.net_sales > 0 then round((s.net_sales - s.cogs) * 100 / s.net_sales, 2) else null end,
         e.opex, s.net_sales - s.cogs - e.opex, s.units::bigint, s.orders::bigint, r.refunds
  from s, e, r;
end;
$$;

create or replace function public.report_monthly_sales(p_business_id uuid, p_from date, p_to date)
returns table (month date, net_sales numeric, cogs numeric, gross_profit numeric, gross_margin_pct numeric, units bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select date_trunc('month', sold_at)::date as month, sum(net_revenue), sum(cogs), sum(net_revenue) - sum(cogs),
         case when sum(net_revenue) > 0 then round((sum(net_revenue) - sum(cogs)) * 100 / sum(net_revenue), 2) else null end, sum(net_units)::bigint
  from public.report_sales_lines_view
  where business_id = p_business_id and sold_at between p_from and p_to
  group by 1 order by 1;
$$;

create or replace function public.report_sales_by_dimension(p_business_id uuid, p_from date, p_to date, p_dimension text)
returns table (label text, net_sales numeric, cogs numeric, units bigint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
begin
  if p_dimension not in ('product', 'channel', 'origin', 'customer') then
    raise exception 'VALIDATION: unknown dimension' using errcode = '22023';
  end if;
  return query
  select case p_dimension when 'product' then v.product_name || ' ' || v.variant_name when 'channel' then v.channel_name when 'origin' then coalesce(v.origins, 'Unknown') else coalesce(v.customer_name, 'Walk-in') end,
         sum(v.net_revenue), sum(v.cogs), sum(v.net_units)::bigint
  from public.report_sales_lines_view v
  where v.business_id = p_business_id and v.sold_at between p_from and p_to
  group by 1 order by 2 desc;
end;
$$;

create or replace function public.report_weekly_production(p_business_id uuid, p_from date, p_to date)
returns table (week date, batches bigint, green_g bigint, roasted_g bigint, loss_pct numeric, cost_per_kg numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select date_trunc('week', roast_date)::date, count(*)::bigint, sum(green_weight_g)::bigint, sum(roasted_weight_g)::bigint,
         case when sum(green_weight_g) > 0 then round((sum(green_weight_g) - sum(roasted_weight_g)) * 100.0 / sum(green_weight_g), 2) end,
         case when sum(roasted_weight_g) > 0 then round(sum(production_cost_total) * 1000 / sum(roasted_weight_g), 2) end
  from public.roast_batches
  where business_id = p_business_id and status = 'completed' and roast_date between p_from and p_to
  group by 1 order by 1;
$$;

create or replace function public.report_expenses_by_category(p_business_id uuid, p_from date, p_to date)
returns table (category text, classification text, cost_treatment text, amount numeric, operating_amount numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select category_name, classification, cost_treatment, sum(amount), sum(operating_amount)
  from public.report_expenses_view
  where business_id = p_business_id and not is_voided and incurred_at between p_from and p_to
  group by 1, 2, 3 order by 4 desc;
$$;

-- Inventory valuation at the current moment (from remaining cost layers; reconciles to balances).
create or replace function public.report_inventory_valuation(p_business_id uuid)
returns table (item_type public.inventory_item_type, items bigint, quantity bigint, value numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select ii.item_type, count(distinct ii.id)::bigint, coalesce(sum(b.on_hand_quantity), 0)::bigint, coalesce(sum(cl.remaining_cost), 0)
  from public.inventory_items ii
  left join lateral (select sum(on_hand_quantity) as on_hand_quantity from public.inventory_balances x where x.inventory_item_id = ii.id) b on true
  left join lateral (select sum(remaining_cost) as remaining_cost from public.inventory_cost_layers c where c.inventory_item_id = ii.id) cl on true
  where ii.business_id = p_business_id
  group by ii.item_type order by ii.item_type;
$$;

create or replace function public.dashboard_metrics(p_business_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v jsonb := '{}'::jsonb;
  v_fin boolean := app.has_permission(p_business_id, 'finance.read');
  r record;
begin
  if not app.is_member(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  -- inventory (inventory.read)
  select coalesce(sum(available_g), 0) as green_g, coalesce(sum(stock_value), 0) as green_value, count(*) filter (where stock_status <> 'in_stock') as low
  into r from public.green_lot_inventory_view where business_id = p_business_id;
  v := v || jsonb_build_object('green_stock_g', r.green_g, 'green_stock_value', r.green_value, 'low_stock_alerts', r.low);
  select coalesce(sum(roasted_available_g), 0) as g, coalesce(sum(roasted_stock_value), 0) as val into r from public.roast_batch_summary_view where business_id = p_business_id and status = 'completed';
  v := v || jsonb_build_object('roasted_stock_g', r.g, 'roasted_stock_value', r.val);
  select coalesce(sum(available), 0) as units, coalesce(sum(stock_value), 0) as val into r from public.finished_goods_inventory_view where business_id = p_business_id;
  v := v || jsonb_build_object('finished_units', r.units, 'finished_stock_value', r.val);
  select count(*) filter (where stock_status <> 'in_stock') as low into r from public.packaging_material_inventory_view where business_id = p_business_id and is_active;
  v := v || jsonb_build_object('low_material_alerts', r.low);
  -- production
  select count(*) as batches, coalesce(sum(roasted_weight_g), 0) as roasted, case when sum(green_weight_g) > 0 then round((sum(green_weight_g) - sum(roasted_weight_g)) * 100.0 / sum(green_weight_g), 2) end as loss
  into r from public.roast_batches where business_id = p_business_id and status = 'completed' and roast_date between p_from and p_to;
  v := v || jsonb_build_object('roast_batches', r.batches, 'roasted_output_g', r.roasted, 'avg_roast_loss_pct', r.loss);
  if v_fin then
    select * into r from public.report_profitability(p_business_id, p_from, p_to);
    v := v || jsonb_build_object('net_sales', r.net_sales, 'cogs', r.cogs, 'gross_profit', r.gross_profit, 'gross_margin_pct', r.gross_margin_pct,
                                 'operating_expenses', r.operating_expenses, 'operating_result', r.operating_result, 'units_sold', r.units_sold, 'orders', r.orders, 'refunds', r.refunds);
    select coalesce(sum(total_amount - (amount_paid - amount_refunded)), 0) as ar into r from public.sales_orders
    where business_id = p_business_id and status not in ('draft', 'cancelled') and total_amount - (amount_paid - amount_refunded) > 0;
    v := v || jsonb_build_object('receivables', r.ar, 'finance', true);
  else
    v := v || jsonb_build_object('finance', false);
  end if;
  return v;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.report_profitability(uuid, date, date)', 'public.report_monthly_sales(uuid, date, date)', 'public.report_sales_by_dimension(uuid, date, date, text)',
    'public.report_weekly_production(uuid, date, date)', 'public.report_expenses_by_category(uuid, date, date)', 'public.report_inventory_valuation(uuid)', 'public.dashboard_metrics(uuid, date, date)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end;
$$;
