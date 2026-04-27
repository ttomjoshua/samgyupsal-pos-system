begin;

do $$
begin
  if to_regclass('public.products_legacy') is not null then
    execute 'revoke all on public.products_legacy from anon, authenticated';
    execute 'alter table public.products_legacy enable row level security';
    execute 'drop policy if exists demo_products_select on public.products_legacy';
    execute 'drop policy if exists bootstrap_products_select on public.products_legacy';
    execute 'drop policy if exists demo_products_insert on public.products_legacy';
    execute 'drop policy if exists bootstrap_products_insert on public.products_legacy';
    execute 'drop policy if exists demo_products_update on public.products_legacy';
    execute 'drop policy if exists bootstrap_products_update on public.products_legacy';
    execute 'drop policy if exists demo_products_delete on public.products_legacy';
    execute 'drop policy if exists bootstrap_products_delete on public.products_legacy';
  end if;

  if to_regclass('public.sale_items_legacy') is not null then
    execute 'revoke all on public.sale_items_legacy from anon, authenticated';
    execute 'alter table public.sale_items_legacy enable row level security';
    execute 'drop policy if exists demo_sale_items_select on public.sale_items_legacy';
    execute 'drop policy if exists bootstrap_sale_items_select on public.sale_items_legacy';
    execute 'drop policy if exists demo_sale_items_insert on public.sale_items_legacy';
    execute 'drop policy if exists bootstrap_sale_items_insert on public.sale_items_legacy';
  end if;
end
$$;

commit;
