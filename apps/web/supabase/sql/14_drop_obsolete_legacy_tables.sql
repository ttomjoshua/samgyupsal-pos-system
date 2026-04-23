begin;

do $$
begin
  if to_regclass('public.inventory_items') is not null then
    update public.sale_items sale_item
    set product_id = coalesce(inventory_row.product_id, sale_item.product_id)
    from public.inventory_items inventory_row
    where sale_item.inventory_item_id = inventory_row.id
      and sale_item.product_id is distinct from coalesce(
        inventory_row.product_id,
        sale_item.product_id
      );
  end if;
end
$$;

alter table public.sale_items
  drop constraint if exists sale_items_inventory_item_id_fkey;

update public.sale_items
set inventory_item_id = product_id
where product_id is not null
  and inventory_item_id is distinct from product_id;

drop trigger if exists cleanup_legacy_inventory_items_before_product_delete on public.products;
drop trigger if exists populate_sale_item_legacy_inventory_ref on public.sale_items;

drop function if exists public.cleanup_legacy_inventory_items_for_product();
drop function if exists public.populate_sale_item_legacy_inventory_ref();

drop table if exists public.sale_items_legacy cascade;
drop table if exists public.products_legacy cascade;
drop table if exists public.inventory_items cascade;
drop table if exists public.categories cascade;

commit;
