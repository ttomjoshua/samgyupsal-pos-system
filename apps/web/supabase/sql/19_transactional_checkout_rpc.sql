-- Transaction-backed checkout RPC for authenticated Supabase sales.
--
-- Run after:
--   - 04_auth_profiles_rollout.sql
--   - 09_auth_role_policies.sql
--   - 13_products_operational_alignment.sql
--   - 14_drop_obsolete_legacy_tables.sql
--   - 18_auth_inventory_hardening.sql
--
-- Purpose:
--   Record the sale header, sale line items, and inventory deduction inside one
--   database transaction. This replaces the previous browser-managed sequence
--   of independent inserts and stock updates.

begin;

do $$
begin
  if to_regprocedure('private.current_user_is_admin()') is null
     or to_regclass('public.profiles') is null then
    raise exception
      'Run 04_auth_profiles_rollout.sql and 09_auth_role_policies.sql before 19_transactional_checkout_rpc.sql.';
  end if;

  if to_regclass('public.products') is null
     or to_regclass('public.sales') is null
     or to_regclass('public.sale_items') is null then
    raise exception
      'Run the core products, sales, and sale_items schema before 19_transactional_checkout_rpc.sql.';
  end if;
end
$$;

create or replace function private.create_checkout_sale(
  p_sale jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  current_role_key text;
  current_branch_id integer;
  current_status text;
  sale_branch_id integer;
  sale_branch_name text;
  created_sale public.sales%rowtype;
  created_items jsonb := '[]'::jsonb;
  invalid_item_count integer := 0;
  expected_product_count integer := 0;
  locked_product_count integer := 0;
  product_row record;
  product_branch_id integer;
begin
  if coalesce(auth.role(), '') <> 'authenticated' or current_user_id is null then
    raise exception 'Only authenticated accounts can complete checkout.'
      using errcode = '42501';
  end if;

  select
    role_key,
    branch_id,
    status
  into
    current_role_key,
    current_branch_id,
    current_status
  from public.profiles
  where id = current_user_id
  limit 1;

  if current_status is distinct from 'active' then
    raise exception 'Only active accounts can complete checkout.'
      using errcode = '42501';
  end if;

  if jsonb_typeof(p_sale) is distinct from 'object' then
    raise exception 'Checkout sale payload must be a JSON object.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Checkout items payload must be a JSON array.'
      using errcode = '22023';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'Checkout requires at least one line item.'
      using errcode = '22023';
  end if;

  if nullif(p_sale->>'cashier_id', '') is distinct from current_user_id::text then
    raise exception 'Checkout cashier must match the authenticated account.'
      using errcode = '42501';
  end if;

  sale_branch_id := nullif(p_sale->>'branch_id', '')::integer;

  if sale_branch_id is null then
    raise exception 'Checkout branch is required.'
      using errcode = '22023';
  end if;

  select name
  into sale_branch_name
  from public.branches
  where id = sale_branch_id
  limit 1;

  if sale_branch_name is null then
    raise exception 'Checkout branch is not available.'
      using errcode = '23503';
  end if;

  if coalesce(current_role_key, '') <> 'admin'
     and sale_branch_id is distinct from current_branch_id then
    raise exception 'Employee accounts can only complete checkout for their assigned branch.'
      using errcode = '42501';
  end if;

  with parsed_items as (
    select
      nullif(item->>'item_name', '') as item_name,
      coalesce(nullif(item->>'quantity', '')::integer, 0) as quantity,
      coalesce(nullif(item->>'unit_price', '')::numeric, 0) as unit_price,
      coalesce(nullif(item->>'line_total', '')::numeric, 0) as line_total
    from jsonb_array_elements(p_items) as source(item)
  )
  select count(*)
  into invalid_item_count
  from parsed_items
  where item_name is null
     or quantity <= 0
     or unit_price < 0
     or line_total < 0;

  if invalid_item_count > 0 then
    raise exception 'Checkout contains invalid line items.'
      using errcode = '22023';
  end if;

  with parsed_items as (
    select
      nullif(item->>'product_id', '')::bigint as product_id,
      coalesce(nullif(item->>'quantity', '')::integer, 0) as quantity
    from jsonb_array_elements(p_items) as source(item)
  ),
  product_quantities as (
    select
      product_id,
      sum(quantity)::integer as total_quantity
    from parsed_items
    where product_id is not null
    group by product_id
  )
  select count(*)
  into expected_product_count
  from product_quantities;

  for product_row in
    with parsed_items as (
      select
        nullif(item->>'product_id', '')::bigint as product_id,
        coalesce(nullif(item->>'quantity', '')::integer, 0) as quantity
      from jsonb_array_elements(p_items) as source(item)
    ),
    product_quantities as (
      select
        product_id,
        sum(quantity)::integer as total_quantity
      from parsed_items
      where product_id is not null
      group by product_id
    )
    select
      product.id,
      product.branch_id,
      product.branch,
      product.product_name,
      product.stock_quantity,
      product.is_active,
      product_quantities.total_quantity
    from product_quantities
    join public.products product
      on product.id = product_quantities.product_id
    order by product.id
    for update of product
  loop
    locked_product_count := locked_product_count + 1;
    product_branch_id := coalesce(
      product_row.branch_id,
      case
        when product_row.branch = 'Dollar' then 2
        when product_row.branch = 'Sta. Lucia' then 1
        else null
      end
    );

    if coalesce(product_row.is_active, true) is not true then
      raise exception '% is not available for checkout.', product_row.product_name
        using errcode = '23514';
    end if;

    if product_branch_id is null
       or product_branch_id is distinct from sale_branch_id then
      raise exception '% belongs to a different branch.', product_row.product_name
        using errcode = '42501';
    end if;

    if product_row.total_quantity > coalesce(product_row.stock_quantity, 0) then
      raise exception '% only has % item(s) in stock.',
        product_row.product_name,
        coalesce(product_row.stock_quantity, 0)
        using errcode = '23514';
    end if;
  end loop;

  if locked_product_count <> expected_product_count then
    raise exception 'One or more checkout items are no longer available.'
      using errcode = '23503';
  end if;

  update public.products product
  set stock_quantity = product.stock_quantity - product_quantities.total_quantity
  from (
    with parsed_items as (
      select
        nullif(item->>'product_id', '')::bigint as product_id,
        coalesce(nullif(item->>'quantity', '')::integer, 0) as quantity
      from jsonb_array_elements(p_items) as source(item)
    )
    select
      product_id,
      sum(quantity)::integer as total_quantity
    from parsed_items
    where product_id is not null
    group by product_id
  ) product_quantities
  where product.id = product_quantities.product_id;

  insert into public.sales (
    cashier_id,
    cashier_name,
    branch_id,
    branch_name,
    payment_method,
    subtotal,
    discount,
    total_amount,
    cash_received,
    change_amount,
    submitted_at,
    notes
  )
  values (
    current_user_id::text,
    nullif(p_sale->>'cashier_name', ''),
    sale_branch_id,
    sale_branch_name,
    coalesce(nullif(p_sale->>'payment_method', ''), 'cash'),
    coalesce(nullif(p_sale->>'subtotal', '')::numeric, 0),
    coalesce(nullif(p_sale->>'discount', '')::numeric, 0),
    coalesce(nullif(p_sale->>'total_amount', '')::numeric, 0),
    coalesce(nullif(p_sale->>'cash_received', '')::numeric, 0),
    coalesce(nullif(p_sale->>'change_amount', '')::numeric, 0),
    coalesce(nullif(p_sale->>'submitted_at', '')::timestamptz, now()),
    nullif(p_sale->>'notes', '')
  )
  returning *
  into created_sale;

  with parsed_items as (
    select
      ordinality,
      nullif(item->>'product_id', '')::bigint as product_id,
      nullif(item->>'inventory_item_id', '')::bigint as inventory_item_id,
      nullif(item->>'item_name', '') as item_name,
      coalesce(nullif(item->>'quantity', '')::integer, 0) as quantity,
      coalesce(nullif(item->>'unit_price', '')::numeric, 0) as unit_price,
      coalesce(nullif(item->>'line_total', '')::numeric, 0) as line_total
    from jsonb_array_elements(p_items) with ordinality as source(item, ordinality)
  ),
  inserted_items as (
    insert into public.sale_items (
      sale_id,
      product_id,
      inventory_item_id,
      item_name,
      quantity,
      unit_price,
      line_total
    )
    select
      created_sale.id,
      product_id,
      coalesce(inventory_item_id, product_id),
      item_name,
      quantity,
      unit_price,
      line_total
    from parsed_items
    order by ordinality
    returning *
  )
  select coalesce(jsonb_agg(to_jsonb(inserted_items) order by inserted_items.id), '[]'::jsonb)
  into created_items
  from inserted_items;

  return jsonb_build_object(
    'ok', true,
    'sale', to_jsonb(created_sale),
    'items', created_items,
    'inventory_synced', true
  );
end;
$$;

revoke all on function private.create_checkout_sale(jsonb, jsonb) from public;
grant execute on function private.create_checkout_sale(jsonb, jsonb) to authenticated;

create or replace function public.create_checkout_sale(
  p_sale jsonb,
  p_items jsonb
)
returns jsonb
language sql
set search_path = public, private
as $$
  select private.create_checkout_sale(p_sale, p_items);
$$;

revoke all on function public.create_checkout_sale(jsonb, jsonb) from public;
grant execute on function public.create_checkout_sale(jsonb, jsonb) to authenticated;

commit;
