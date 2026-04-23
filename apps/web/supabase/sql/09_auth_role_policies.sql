begin;

create schema if not exists private;

create or replace function private.current_user_is_active()
returns boolean
language sql
security definer
set search_path = public, private
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function private.current_user_branch_id()
returns integer
language sql
security definer
set search_path = public, private
stable
as $$
  select branch_id
  from public.profiles
  where id = auth.uid()
    and status = 'active'
  limit 1;
$$;

create or replace function private.current_user_branch_name()
returns text
language sql
security definer
set search_path = public, private
stable
as $$
  select b.name
  from public.profiles p
  join public.branches b
    on b.id = p.branch_id
  where p.id = auth.uid()
    and p.status = 'active'
  limit 1;
$$;

revoke all on function private.current_user_is_active() from public;
revoke all on function private.current_user_branch_id() from public;
revoke all on function private.current_user_branch_name() from public;

grant execute on function private.current_user_is_active() to authenticated;
grant execute on function private.current_user_branch_id() to authenticated;
grant execute on function private.current_user_branch_name() to authenticated;

revoke all on public.products from anon, authenticated;
revoke all on public.branches from anon, authenticated;
revoke all on public.sales from anon, authenticated;
revoke all on public.sale_items from anon, authenticated;
revoke all on public.product_catalog_view from anon, authenticated;
revoke all on public.inventory_catalog_view from anon, authenticated;

grant select, insert, update, delete on public.products to authenticated;
grant select, insert on public.branches to authenticated;
grant select, insert, delete on public.sales to authenticated;
grant select, insert on public.sale_items to authenticated;
grant select on public.product_catalog_view to authenticated;
grant select on public.inventory_catalog_view to authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter view public.product_catalog_view set (security_invoker = true);
alter view public.inventory_catalog_view set (security_invoker = true);

drop policy if exists demo_products_select on public.products;
drop policy if exists demo_products_insert on public.products;
drop policy if exists demo_products_update on public.products;
drop policy if exists demo_products_delete on public.products;

drop policy if exists demo_branches_select on public.branches;
drop policy if exists demo_branches_insert on public.branches;

drop policy if exists demo_sales_select on public.sales;
drop policy if exists demo_sales_insert on public.sales;
drop policy if exists demo_sales_delete on public.sales;

drop policy if exists demo_sale_items_select on public.sale_items;
drop policy if exists demo_sale_items_insert on public.sale_items;

do $$
begin
  if to_regclass('public.categories') is not null then
    execute 'revoke all on public.categories from anon, authenticated';
    execute 'drop policy if exists demo_categories_select on public.categories';
    execute 'drop policy if exists demo_categories_insert on public.categories';
    execute 'drop policy if exists demo_categories_update on public.categories';
    execute 'drop policy if exists categories_select_admin on public.categories';
  end if;

  if to_regclass('public.inventory_items') is not null then
    execute 'revoke all on public.inventory_items from anon, authenticated';
    execute 'drop policy if exists demo_inventory_items_select on public.inventory_items';
    execute 'drop policy if exists demo_inventory_items_insert on public.inventory_items';
    execute 'drop policy if exists demo_inventory_items_update on public.inventory_items';
    execute 'drop policy if exists demo_inventory_items_delete on public.inventory_items';
    execute 'drop policy if exists inventory_items_select_admin on public.inventory_items';
    execute 'drop policy if exists inventory_items_delete_admin on public.inventory_items';
  end if;
end
$$;

drop policy if exists branches_select_admin on public.branches;
create policy branches_select_admin
  on public.branches
  for select
  to authenticated
  using (private.current_user_is_admin());

drop policy if exists branches_select_assigned on public.branches;
create policy branches_select_assigned
  on public.branches
  for select
  to authenticated
  using (
    private.current_user_is_active()
    and id = private.current_user_branch_id()
  );

drop policy if exists branches_insert_admin on public.branches;
create policy branches_insert_admin
  on public.branches
  for insert
  to authenticated
  with check (private.current_user_is_admin());

drop policy if exists products_select_admin on public.products;
create policy products_select_admin
  on public.products
  for select
  to authenticated
  using (private.current_user_is_admin());

drop policy if exists products_select_assigned on public.products;
create policy products_select_assigned
  on public.products
  for select
  to authenticated
  using (
    private.current_user_is_active()
    and (
      branch_id = private.current_user_branch_id()
      or (
        branch_id is null
        and branch = private.current_user_branch_name()
      )
    )
  );

drop policy if exists products_insert_admin on public.products;
create policy products_insert_admin
  on public.products
  for insert
  to authenticated
  with check (private.current_user_is_admin());

drop policy if exists products_update_admin on public.products;
create policy products_update_admin
  on public.products
  for update
  to authenticated
  using (private.current_user_is_admin())
  with check (private.current_user_is_admin());

drop policy if exists products_update_assigned on public.products;
create policy products_update_assigned
  on public.products
  for update
  to authenticated
  using (
    private.current_user_is_active()
    and (
      branch_id = private.current_user_branch_id()
      or (
        branch_id is null
        and branch = private.current_user_branch_name()
      )
    )
  )
  with check (
    private.current_user_is_active()
    and (
      branch_id = private.current_user_branch_id()
      or (
        branch_id is null
        and branch = private.current_user_branch_name()
      )
    )
  );

drop policy if exists products_delete_admin on public.products;
create policy products_delete_admin
  on public.products
  for delete
  to authenticated
  using (private.current_user_is_admin());

drop policy if exists sales_select_admin on public.sales;
create policy sales_select_admin
  on public.sales
  for select
  to authenticated
  using (private.current_user_is_admin());

drop policy if exists sales_select_cashier on public.sales;
create policy sales_select_cashier
  on public.sales
  for select
  to authenticated
  using (
    private.current_user_is_active()
    and cashier_id = auth.uid()::text
  );

drop policy if exists sales_insert_cashier on public.sales;
create policy sales_insert_cashier
  on public.sales
  for insert
  to authenticated
  with check (
    private.current_user_is_active()
    and cashier_id = auth.uid()::text
    and (
      private.current_user_is_admin()
      or branch_id = private.current_user_branch_id()
    )
  );

drop policy if exists sales_delete_empty_cashier on public.sales;
create policy sales_delete_empty_cashier
  on public.sales
  for delete
  to authenticated
  using (
    private.current_user_is_active()
    and cashier_id = auth.uid()::text
    and not exists (
      select 1
      from public.sale_items
      where sale_id = public.sales.id
    )
  );

drop policy if exists sale_items_select_admin on public.sale_items;
create policy sale_items_select_admin
  on public.sale_items
  for select
  to authenticated
  using (private.current_user_is_admin());

drop policy if exists sale_items_select_cashier on public.sale_items;
create policy sale_items_select_cashier
  on public.sale_items
  for select
  to authenticated
  using (
    private.current_user_is_active()
    and exists (
      select 1
      from public.sales s
      where s.id = sale_items.sale_id
        and s.cashier_id = auth.uid()::text
    )
  );

drop policy if exists sale_items_insert_cashier on public.sale_items;
create policy sale_items_insert_cashier
  on public.sale_items
  for insert
  to authenticated
  with check (
    private.current_user_is_active()
    and exists (
      select 1
      from public.sales s
      where s.id = sale_items.sale_id
        and s.cashier_id = auth.uid()::text
        and (
          private.current_user_is_admin()
          or s.branch_id = private.current_user_branch_id()
        )
    )
  );

commit;
