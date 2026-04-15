begin;

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.categories to anon, authenticated;
grant select, insert, update on public.products to anon, authenticated;
grant select, insert, update on public.inventory_items to anon, authenticated;
grant select on public.branches to anon, authenticated;
grant select, insert on public.sales to anon, authenticated;
grant select, insert on public.sale_items to anon, authenticated;
grant select on public.product_catalog_view to anon, authenticated;
grant select on public.inventory_catalog_view to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.inventory_items enable row level security;
alter table public.branches enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'categories'
      and policyname = 'demo_categories_select'
  ) then
    create policy demo_categories_select
      on public.categories
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'categories'
      and policyname = 'demo_categories_insert'
  ) then
    create policy demo_categories_insert
      on public.categories
      for insert
      to anon, authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'categories'
      and policyname = 'demo_categories_update'
  ) then
    create policy demo_categories_update
      on public.categories
      for update
      to anon, authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'products'
      and policyname = 'demo_products_select'
  ) then
    create policy demo_products_select
      on public.products
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'products'
      and policyname = 'demo_products_insert'
  ) then
    create policy demo_products_insert
      on public.products
      for insert
      to anon, authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'products'
      and policyname = 'demo_products_update'
  ) then
    create policy demo_products_update
      on public.products
      for update
      to anon, authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'inventory_items'
      and policyname = 'demo_inventory_items_select'
  ) then
    create policy demo_inventory_items_select
      on public.inventory_items
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'inventory_items'
      and policyname = 'demo_inventory_items_insert'
  ) then
    create policy demo_inventory_items_insert
      on public.inventory_items
      for insert
      to anon, authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'inventory_items'
      and policyname = 'demo_inventory_items_update'
  ) then
    create policy demo_inventory_items_update
      on public.inventory_items
      for update
      to anon, authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'branches'
      and policyname = 'demo_branches_select'
  ) then
    create policy demo_branches_select
      on public.branches
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sales'
      and policyname = 'demo_sales_select'
  ) then
    create policy demo_sales_select
      on public.sales
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sales'
      and policyname = 'demo_sales_insert'
  ) then
    create policy demo_sales_insert
      on public.sales
      for insert
      to anon, authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sale_items'
      and policyname = 'demo_sale_items_select'
  ) then
    create policy demo_sale_items_select
      on public.sale_items
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sale_items'
      and policyname = 'demo_sale_items_insert'
  ) then
    create policy demo_sale_items_insert
      on public.sale_items
      for insert
      to anon, authenticated
      with check (true);
  end if;
end
$$;

commit;
