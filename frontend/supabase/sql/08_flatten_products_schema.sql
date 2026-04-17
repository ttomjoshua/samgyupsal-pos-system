begin;

alter table public.products
  add column if not exists category text,
  add column if not exists net_weight text,
  add column if not exists price numeric(12, 2),
  add column if not exists stock_quantity integer not null default 0,
  add column if not exists expiration_date date;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'category_id'
  ) then
    update public.products p
    set category = c.name
    from public.categories c
    where p.category_id = c.id
      and coalesce(btrim(p.category), '') = '';
  end if;

  update public.products
  set category = 'Uncategorized'
  where coalesce(btrim(category), '') = '';

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'unit_label'
  ) then
    update public.products
    set net_weight = coalesce(unit_label, '')
    where net_weight is null;
  end if;

  update public.products
  set net_weight = ''
  where net_weight is null;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'default_price'
  ) then
    update public.products
    set price = default_price
    where price is null
      and default_price is not null;
  end if;

  if to_regclass('public.inventory_items') is not null then
    update public.products p
    set price = coalesce(i.selling_price, p.price),
        stock_quantity = coalesce(i.stock_quantity, 0),
        expiration_date = i.expiration_date
    from public.inventory_items i
    where i.product_id = p.id;
  end if;

  if to_regclass('public.products_legacy') is not null
     and not exists (select 1 from public.products limit 1) then
    insert into public.products (
      branch,
      category,
      product_name,
      net_weight,
      price,
      stock_quantity,
      expiration_date
    )
    with legacy_rows as (
      select
        case
          when coalesce(branch_id, 1) = 2 then 'Dollar'
          else 'Sta. Lucia'
        end as branch_name,
        case
          when btrim(coalesce(category, '')) = '' then 'Uncategorized'
          else regexp_replace(btrim(category), '\s+', ' ', 'g')
        end as category_name,
        regexp_replace(
          btrim(coalesce(product_name, 'Unnamed Product')),
          '\s+',
          ' ',
          'g'
        ) as product_name_clean,
        coalesce(
          regexp_replace(btrim(coalesce(net_weight, '')), '\s+', ' ', 'g'),
          ''
        ) as net_weight_clean,
        case
          when btrim(coalesce(price, '')) ~ '^\d+(\.\d+)?$'
            then btrim(price)::numeric(12, 2)
          else null
        end as price_numeric,
        case
          when regexp_replace(btrim(coalesce(stock_quantity, '')), '[^0-9-]', '', 'g') ~ '^-?\d+$'
            then greatest(
              regexp_replace(btrim(stock_quantity), '[^0-9-]', '', 'g')::integer,
              0
            )
          else 0
        end as stock_quantity_numeric,
        case
          when btrim(coalesce(expiration_date, '')) ~ '^\d{4}-\d{2}-\d{2}$'
            then btrim(expiration_date)::date
          else null
        end as expiration_date_value
      from public.products_legacy
    ),
    collapsed_rows as (
      select
        branch_name,
        category_name,
        product_name_clean,
        net_weight_clean,
        max(price_numeric) as price_numeric,
        sum(stock_quantity_numeric) as stock_quantity_total,
        min(expiration_date_value) as expiration_date_value
      from legacy_rows
      group by 1, 2, 3, 4
    )
    select
      branch_name,
      category_name,
      product_name_clean,
      net_weight_clean,
      price_numeric,
      stock_quantity_total,
      expiration_date_value
    from collapsed_rows
    order by branch_name asc, category_name asc, product_name_clean asc, net_weight_clean asc;
  end if;
end
$$;

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

drop trigger if exists set_products_updated_at on public.products;

alter table public.products
  drop column if exists branch_id cascade,
  drop column if exists category_id cascade,
  drop column if exists unit_label cascade,
  drop column if exists default_price cascade,
  drop column if exists legacy_price_text cascade,
  drop column if exists is_active cascade,
  drop column if exists created_at cascade,
  drop column if exists updated_at cascade;

alter table public.products
  alter column branch set default 'Sta. Lucia',
  alter column branch set not null,
  alter column category set not null,
  alter column product_name set not null,
  alter column net_weight set not null,
  alter column stock_quantity set default 0,
  alter column stock_quantity set not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'products_catalog_unique'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      drop constraint products_catalog_unique;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_catalog_unique'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_catalog_unique
      unique (branch, category, product_name, net_weight);
  end if;
end
$$;

drop index if exists idx_products_category_id;
create index if not exists idx_products_branch on public.products (branch);
create index if not exists idx_products_category on public.products (category);
create index if not exists idx_products_product_name on public.products (product_name);

create or replace view public.product_catalog_view
with (security_invoker = true) as
select
  p.id as product_id,
  p.branch,
  coalesce(
    b.code,
    case
      when p.branch = 'Dollar' then 'DOLLAR'
      when p.branch = 'Sta. Lucia' then 'MAIN'
      else null
    end
  ) as branch_code,
  coalesce(b.name, p.branch) as branch_name,
  null::bigint as category_id,
  p.category as category_name,
  p.product_name,
  p.net_weight as unit_label,
  p.price as default_price,
  true as is_active
from public.products p
left join public.branches b
  on b.name = p.branch;

create or replace view public.inventory_catalog_view
with (security_invoker = true) as
select
  p.id as inventory_item_id,
  coalesce(
    b.id,
    case
      when p.branch = 'Dollar' then 2
      when p.branch = 'Sta. Lucia' then 1
      else null
    end
  ) as branch_id,
  coalesce(
    b.code,
    case
      when p.branch = 'Dollar' then 'DOLLAR'
      when p.branch = 'Sta. Lucia' then 'MAIN'
      else null
    end
  ) as branch_code,
  coalesce(b.name, p.branch) as branch_name,
  p.id as product_id,
  p.branch as product_branch,
  null::bigint as category_id,
  p.category as category_name,
  p.product_name,
  p.net_weight as unit_label,
  coalesce(p.price, 0) as price,
  p.price as default_price,
  p.price as selling_price,
  p.stock_quantity,
  10 as reorder_level,
  p.expiration_date,
  null::text as legacy_stock_text,
  true as is_active
from public.products p
left join public.branches b
  on b.name = p.branch;

select setval(
  pg_get_serial_sequence('public.products', 'id'),
  greatest((select coalesce(max(id), 1) from public.products), 1),
  true
);

commit;
