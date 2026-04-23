begin;

revoke all on public.products_legacy from anon, authenticated;
revoke all on public.sale_items_legacy from anon, authenticated;

alter table public.products_legacy enable row level security;
alter table public.sale_items_legacy enable row level security;

drop policy if exists demo_products_select on public.products_legacy;
drop policy if exists demo_products_insert on public.products_legacy;
drop policy if exists demo_products_update on public.products_legacy;
drop policy if exists demo_products_delete on public.products_legacy;

drop policy if exists demo_sale_items_select on public.sale_items_legacy;
drop policy if exists demo_sale_items_insert on public.sale_items_legacy;

commit;
