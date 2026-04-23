begin;

alter table public.products
  add column if not exists branch_id integer references public.branches (id) on update cascade on delete restrict,
  add column if not exists category text,
  add column if not exists net_weight text,
  add column if not exists price numeric(12, 2),
  add column if not exists stock_quantity integer not null default 0,
  add column if not exists reorder_level integer not null default 10,
  add column if not exists is_active boolean not null default true,
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

  if to_regclass('public.products_legacy') is not null then
    with allowed_legacy_categories as (
      select unnest(array[
        'Korean Noodles'::text,
        'Samgyup bowl meat'::text,
        'Samgyup meat'::text,
        'Seaweed'::text
      ]) as category_name
    ),
    legacy_category_matches as (
      select
        case
          when coalesce(branch_id, 1) = 2 then 'Dollar'
          else 'Sta. Lucia'
        end as branch_name,
        lower(regexp_replace(btrim(coalesce(product_name, '')), '\s+', ' ', 'g')) as product_name_key,
        lower(coalesce(regexp_replace(btrim(coalesce(net_weight, '')), '\s+', ' ', 'g'), '')) as net_weight_key,
        max(legacy_row.category_name) as category_name,
        count(distinct lower(legacy_row.category_name)) as category_count
      from (
        select
          branch_id,
          product_name,
          net_weight,
          regexp_replace(btrim(coalesce(category, '')), '\s+', ' ', 'g') as category_name
        from public.products_legacy
      ) legacy_row
      join allowed_legacy_categories allowed_category
        on lower(legacy_row.category_name) = lower(allowed_category.category_name)
      where legacy_row.category_name <> ''
      group by 1, 2, 3
    )
    update public.products product_row
    set category = legacy_match.category_name
    from legacy_category_matches legacy_match
    where legacy_match.category_count = 1
      and lower(regexp_replace(btrim(coalesce(product_row.branch, '')), '\s+', ' ', 'g')) =
        lower(regexp_replace(btrim(legacy_match.branch_name), '\s+', ' ', 'g'))
      and lower(regexp_replace(btrim(coalesce(product_row.product_name, '')), '\s+', ' ', 'g')) =
        legacy_match.product_name_key
      and lower(coalesce(regexp_replace(btrim(coalesce(product_row.net_weight, '')), '\s+', ' ', 'g'), '')) =
        legacy_match.net_weight_key
      and (
        coalesce(btrim(product_row.category), '') = ''
        or lower(regexp_replace(btrim(coalesce(product_row.category, '')), '\s+', ' ', 'g')) =
          'uncategorized'
      );
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

update public.products
set reorder_level = 10
where reorder_level is null;

update public.products
set is_active = true
where is_active is null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'branch_id'
  ) then
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
  end if;
end
$$;

drop trigger if exists set_products_updated_at on public.products;

alter table public.products
  drop column if exists category_id cascade,
  drop column if exists unit_label cascade,
  drop column if exists default_price cascade,
  drop column if exists legacy_price_text cascade,
  drop column if exists created_at cascade,
  drop column if exists updated_at cascade;

alter table public.products
  alter column branch set default 'Sta. Lucia',
  alter column branch set not null,
  alter column category set not null,
  alter column product_name set not null,
  alter column net_weight set not null,
  alter column reorder_level set default 10,
  alter column reorder_level set not null,
  alter column is_active set default true,
  alter column is_active set not null,
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
create index if not exists idx_products_branch_id on public.products (branch_id);
create index if not exists idx_products_category on public.products (category);
create index if not exists idx_products_product_name on public.products (product_name);

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

select setval(
  pg_get_serial_sequence('public.products', 'id'),
  greatest((select coalesce(max(id), 1) from public.products), 1),
  true
);

commit;
