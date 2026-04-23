begin;

alter table public.products
  add column if not exists branch_id integer references public.branches (id) on update cascade on delete restrict,
  add column if not exists reorder_level integer not null default 10,
  add column if not exists is_active boolean not null default true;

update public.products
set branch = 'Sta. Lucia'
where coalesce(btrim(branch), '') = '';

update public.products
set category = 'Uncategorized'
where coalesce(btrim(category), '') = '';

update public.products
set net_weight = ''
where net_weight is null;

update public.products
set stock_quantity = 0
where stock_quantity is null;

update public.products
set reorder_level = 10
where reorder_level is null;

update public.products
set is_active = true
where is_active is null;

do $$
begin
  update public.products product_row
  set branch_id = branch_row.id
  from public.branches branch_row
  where product_row.branch_id is null
    and branch_row.name = product_row.branch;

  update public.products product_row
  set branch = branch_row.name
  from public.branches branch_row
  where product_row.branch_id = branch_row.id
    and coalesce(btrim(product_row.branch), '') <> branch_row.name;
end
$$;

alter table public.products
  alter column branch set default 'Sta. Lucia',
  alter column branch set not null,
  alter column reorder_level set default 10,
  alter column reorder_level set not null,
  alter column is_active set default true,
  alter column is_active set not null,
  alter column stock_quantity set default 0,
  alter column stock_quantity set not null;

create index if not exists idx_products_branch_id on public.products (branch_id);

create or replace function public.sync_product_operational_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  matched_branch_id integer;
  matched_branch_name text;
begin
  new.branch := coalesce(
    nullif(regexp_replace(btrim(coalesce(new.branch, '')), '\s+', ' ', 'g'), ''),
    'Sta. Lucia'
  );
  new.category := coalesce(
    nullif(regexp_replace(btrim(coalesce(new.category, '')), '\s+', ' ', 'g'), ''),
    'Uncategorized'
  );
  new.net_weight := regexp_replace(btrim(coalesce(new.net_weight, '')), '\s+', ' ', 'g');
  new.stock_quantity := greatest(coalesce(new.stock_quantity, 0), 0);
  new.reorder_level := greatest(coalesce(new.reorder_level, 10), 0);
  new.is_active := coalesce(new.is_active, true);

  if new.branch_id is not null then
    select b.id, b.name
    into matched_branch_id, matched_branch_name
    from public.branches b
    where b.id = new.branch_id
    limit 1;

    if matched_branch_id is not null then
      new.branch_id := matched_branch_id;
      new.branch := matched_branch_name;
      return new;
    end if;
  end if;

  select b.id, b.name
  into matched_branch_id, matched_branch_name
  from public.branches b
  where b.name = new.branch
  limit 1;

  if matched_branch_id is not null then
    new.branch_id := matched_branch_id;
    new.branch := matched_branch_name;
  end if;

  return new;
end;
$$;

create or replace function public.cleanup_legacy_inventory_items_for_product()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if to_regclass('public.inventory_items') is not null then
    delete from public.inventory_items
    where product_id = old.id;
  end if;

  return old;
end;
$$;

create or replace function public.populate_sale_item_legacy_inventory_ref()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.inventory_item_id is null
     and new.product_id is not null
     and to_regclass('public.inventory_items') is not null then
    select inventory_row.id
    into new.inventory_item_id
    from public.inventory_items inventory_row
    left join public.sales sale_row
      on sale_row.id = new.sale_id
    where inventory_row.product_id = new.product_id
      and (
        sale_row.branch_id is null
        or inventory_row.branch_id = sale_row.branch_id
      )
    order by inventory_row.id asc
    limit 1;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_product_operational_fields on public.products;
create trigger sync_product_operational_fields
  before insert or update on public.products
  for each row
  execute function public.sync_product_operational_fields();

drop trigger if exists cleanup_legacy_inventory_items_before_product_delete on public.products;
create trigger cleanup_legacy_inventory_items_before_product_delete
  before delete on public.products
  for each row
  execute function public.cleanup_legacy_inventory_items_for_product();

drop trigger if exists populate_sale_item_legacy_inventory_ref on public.sale_items;
create trigger populate_sale_item_legacy_inventory_ref
  before insert or update of product_id, inventory_item_id, sale_id
  on public.sale_items
  for each row
  execute function public.populate_sale_item_legacy_inventory_ref();

create or replace view public.product_catalog_view
with (security_invoker = true) as
select
  p.id as product_id,
  coalesce(branch_lookup.name, p.branch) as branch,
  coalesce(
    branch_lookup.code,
    case
      when coalesce(branch_lookup.name, p.branch) = 'Dollar' then 'DOLLAR'
      when coalesce(branch_lookup.name, p.branch) = 'Sta. Lucia' then 'MAIN'
      else null
    end
  ) as branch_code,
  coalesce(branch_lookup.name, p.branch) as branch_name,
  null::bigint as category_id,
  p.category as category_name,
  p.product_name,
  p.net_weight as unit_label,
  p.price as default_price,
  coalesce(p.is_active, true) as is_active
from public.products p
left join lateral (
  select
    b.id,
    b.code,
    b.name
  from public.branches b
  where b.id = p.branch_id
     or (p.branch_id is null and b.name = p.branch)
  order by case when b.id = p.branch_id then 0 else 1 end, b.id
  limit 1
) branch_lookup on true;

create or replace view public.inventory_catalog_view
with (security_invoker = true) as
select
  p.id as inventory_item_id,
  coalesce(
    p.branch_id,
    branch_lookup.id,
    case
      when p.branch = 'Dollar' then 2
      when p.branch = 'Sta. Lucia' then 1
      else null
    end
  ) as branch_id,
  coalesce(
    branch_lookup.code,
    case
      when p.branch = 'Dollar' then 'DOLLAR'
      when p.branch = 'Sta. Lucia' then 'MAIN'
      else null
    end
  ) as branch_code,
  coalesce(branch_lookup.name, p.branch) as branch_name,
  p.id as product_id,
  coalesce(branch_lookup.name, p.branch) as product_branch,
  null::bigint as category_id,
  p.category as category_name,
  p.product_name,
  p.net_weight as unit_label,
  coalesce(p.price, 0) as price,
  p.price as default_price,
  p.price as selling_price,
  p.stock_quantity,
  coalesce(p.reorder_level, 10) as reorder_level,
  p.expiration_date,
  null::text as legacy_stock_text,
  coalesce(p.is_active, true) as is_active
from public.products p
left join lateral (
  select
    b.id,
    b.code,
    b.name
  from public.branches b
  where b.id = p.branch_id
     or (p.branch_id is null and b.name = p.branch)
  order by case when b.id = p.branch_id then 0 else 1 end, b.id
  limit 1
) branch_lookup on true;

commit;
