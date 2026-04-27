begin;

grant usage on schema public to authenticated;
grant select, insert, update on public.categories to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.inventory_items to authenticated;
grant select, insert on public.branches to authenticated;
grant select, insert, delete on public.sales to authenticated;
grant select, insert on public.sale_items to authenticated;
grant select on public.product_catalog_view to authenticated;
grant select on public.inventory_catalog_view to authenticated;
grant usage, select on all sequences in schema public to authenticated;

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
      and policyname = 'bootstrap_categories_select'
  ) then
    create policy bootstrap_categories_select
      on public.categories
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'categories'
      and policyname = 'bootstrap_categories_insert'
  ) then
    create policy bootstrap_categories_insert
      on public.categories
      for insert
      to authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'categories'
      and policyname = 'bootstrap_categories_update'
  ) then
    create policy bootstrap_categories_update
      on public.categories
      for update
      to authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'products'
      and policyname = 'bootstrap_products_select'
  ) then
    create policy bootstrap_products_select
      on public.products
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'products'
      and policyname = 'bootstrap_products_insert'
  ) then
    create policy bootstrap_products_insert
      on public.products
      for insert
      to authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'products'
      and policyname = 'bootstrap_products_update'
  ) then
    create policy bootstrap_products_update
      on public.products
      for update
      to authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'products'
      and policyname = 'bootstrap_products_delete'
  ) then
    create policy bootstrap_products_delete
      on public.products
      for delete
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'inventory_items'
      and policyname = 'bootstrap_inventory_items_select'
  ) then
    create policy bootstrap_inventory_items_select
      on public.inventory_items
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'inventory_items'
      and policyname = 'bootstrap_inventory_items_insert'
  ) then
    create policy bootstrap_inventory_items_insert
      on public.inventory_items
      for insert
      to authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'inventory_items'
      and policyname = 'bootstrap_inventory_items_update'
  ) then
    create policy bootstrap_inventory_items_update
      on public.inventory_items
      for update
      to authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'inventory_items'
      and policyname = 'bootstrap_inventory_items_delete'
  ) then
    create policy bootstrap_inventory_items_delete
      on public.inventory_items
      for delete
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'branches'
      and policyname = 'bootstrap_branches_select'
  ) then
    create policy bootstrap_branches_select
      on public.branches
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'branches'
      and policyname = 'bootstrap_branches_insert'
  ) then
    create policy bootstrap_branches_insert
      on public.branches
      for insert
      to authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sales'
      and policyname = 'bootstrap_sales_select'
  ) then
    create policy bootstrap_sales_select
      on public.sales
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sales'
      and policyname = 'bootstrap_sales_insert'
  ) then
    create policy bootstrap_sales_insert
      on public.sales
      for insert
      to authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sales'
      and policyname = 'bootstrap_sales_delete'
  ) then
    create policy bootstrap_sales_delete
      on public.sales
      for delete
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sale_items'
      and policyname = 'bootstrap_sale_items_select'
  ) then
    create policy bootstrap_sale_items_select
      on public.sale_items
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sale_items'
      and policyname = 'bootstrap_sale_items_insert'
  ) then
    create policy bootstrap_sale_items_insert
      on public.sale_items
      for insert
      to authenticated
      with check (true);
  end if;
end
$$;

commit;
