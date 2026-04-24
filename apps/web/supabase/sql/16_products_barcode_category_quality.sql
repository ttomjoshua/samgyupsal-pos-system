begin;

alter table public.products
  add column if not exists barcode text;

comment on column public.products.barcode is
  'Optional product barcode or scan code. Stored without whitespace; nullable while catalog barcodes are being collected.';

create or replace function public.infer_product_category_from_name(product_name text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  name_key text := upper(regexp_replace(btrim(coalesce(product_name, '')), '\s+', ' ', 'g'));
begin
  if name_key = '' then
    return 'Uncategorized';
  end if;

  if name_key like '%PORK BELLY%'
     or name_key like '%PORK JOWLS%'
     or name_key like '%PORK BULGOGI%'
     or name_key like '%PORK SPICY BULGOGI%'
     or name_key like '%BEEF PLAIN%'
     or name_key like '%BEEF TERIYAKI%'
     or name_key like '%BEEF BULGOGI%'
     or name_key like '%BEEF SPECIAL BBQ%'
     or name_key like '%BEEF SPICY BULGOGI%' then
    return 'Meat';
  end if;

  if name_key in ('VEGGIE', 'MEP')
     or name_key like '%BULDAK%'
     or name_key like '%RAMEN%'
     or name_key like '%RAMYUN%'
     or name_key like '%KORENO%'
     or name_key like '%TANGLE%'
     or name_key like '%CHAPAGHETTI%'
     or name_key like '%NEOGURI%'
     or name_key like '%CHEESY RAMEN%'
     or name_key like '%STIR-FRY%' then
    return 'Noodles';
  end if;

  if name_key like '%MAXIM%'
     or name_key like '%MOCHA%'
     or name_key like '%HONEY CITRON%'
     or name_key like '%COFFEE%'
     or name_key like '%LET''S BE%' then
    return 'Coffee / Tea';
  end if;

  if name_key like '%MELONA%'
     or name_key like '%SAMACO%'
     or name_key like '%WATERMELON%'
     or name_key like '%BOOMBOOM%'
     or name_key like '%AVOCADO CHOCO%'
     or name_key like '%CHOCKY%'
     or name_key like '%ORANGE BLAST%'
     or name_key like '%CORNETO%'
     or name_key like '%SUNDAE%'
     or name_key like '%ROCKY ROAD%'
     or name_key like '%COOKIES & CREAM%'
     or name_key like '%DOUBLE DUTCH%'
     or name_key like '%BIRTHDAY%' then
    return 'Desserts';
  end if;

  if name_key like '%TOBLER%'
     or name_key like '%ALMOND%'
     or name_key like '%PEPERO%'
     or name_key like '%MINI KRUNCH%'
     or name_key like '%MILK CLASSIC%' then
    return 'Snacks';
  end if;

  if name_key like '%FISH CAKE%'
     or name_key like '%FISH TOFU%'
     or name_key like '%SHABU%'
     or name_key like '%SAUSAGE%'
     or name_key like '%CRABSTICK%'
     or name_key like '%DUMPLING%'
     or name_key like '%FRENCH FRIES%'
     or name_key like '%SALTED CHICKEN%'
     or name_key like '%LUNCHEON MEAT%'
     or name_key like '%HANSUNG%' then
    return 'Frozen Goods';
  end if;

  if name_key like '%LETTUCE%'
     or name_key like '%ENOKI%'
     or name_key like '%MUSHROOM%' then
    return 'Vegetables';
  end if;

  if name_key like '%KIMCHI%'
     or name_key like '%RADISH%'
     or name_key like '%MARBLE POTATO%'
     or name_key like '%RICE CAKE%'
     or name_key like '%TEOKBOKKI%'
     or name_key like '%YOPOKKI%'
     or name_key like '%NAMKWANG%'
     or name_key like '%BIBIGO%'
     or name_key like '%ONCHEONGI%'
     or name_key like '%NARI%'
     or name_key like '%FIRM TOFU%'
     or name_key like '%SOFT TOFU%'
     or name_key like '%GLASS NOODLES%'
     or name_key like '%RAW EGG%'
     or name_key like '%BOILED EGG%'
     or name_key like '%SESAME SEEDS%' then
    return 'Rice / Sides';
  end if;

  if name_key like '%CHILI%'
     or name_key like '%SESAME OIL%'
     or name_key like '%KEWPIE%'
     or name_key like '%WASABI%'
     or name_key like '%GOCHUJANG%'
     or name_key like '%SSAMJANG%'
     or name_key like '%CHEESE DIP%'
     or name_key like '%GRILLER%'
     or name_key like '%PORK BONE%'
     or name_key like '%CHICKEN%'
     or name_key like '%SEAFOOD%'
     or name_key like '%SATAY%'
     or name_key like '%BLACK PEPER%'
     or name_key like '%BLACK PEPPER%'
     or name_key like '%SICHUAN%' then
    return 'Condiments';
  end if;

  if name_key like '%SLICE CHEESE%'
     or name_key like '%ANCHOR CHEESE%'
     or name_key like '%EDEN CHEESE%'
     or name_key like '%ANCHOR BUTTER%'
     or name_key like '%ALASKA%'
     or name_key like '%ALL PURPOSE CREAM%' then
    return 'Dairy';
  end if;

  if name_key like '%BUTANE%' then
    return 'Supplies';
  end if;

  if name_key like '%COKE%'
     or name_key like '%SPRITE%'
     or name_key like '%ROYAL%'
     or name_key like '%WELCH%'
     or name_key like '%BINGGRAE%'
     or name_key like '%PORORO%'
     or name_key like '%APPLE CIDER%'
     or name_key like '%PINEAPPLE%'
     or name_key like '%MOGU MOGU%'
     or name_key like '%YAKULT%'
     or name_key like '%POCARI%'
     or name_key like '%MINERAL%'
     or name_key like '%ALOE VERA%'
     or name_key like '%CHAMISUL%'
     or name_key in ('ORIGINAL', 'PLUM', 'PEACH', 'STRAWBERRY', 'LEMON', 'GRAPE FRUIT') then
    return 'Drinks';
  end if;

  return 'Uncategorized';
end;
$$;

create or replace function public.normalize_product_catalog_quality_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.product_name := regexp_replace(btrim(coalesce(new.product_name, '')), '\s+', ' ', 'g');
  new.branch := coalesce(
    nullif(regexp_replace(btrim(coalesce(new.branch, '')), '\s+', ' ', 'g'), ''),
    'Sta. Lucia'
  );
  new.net_weight := regexp_replace(btrim(coalesce(new.net_weight, '')), '\s+', ' ', 'g');
  new.barcode := nullif(regexp_replace(btrim(coalesce(new.barcode, '')), '\s+', '', 'g'), '');
  new.category := coalesce(
    nullif(regexp_replace(btrim(coalesce(new.category, '')), '\s+', ' ', 'g'), ''),
    'Uncategorized'
  );
  new.stock_quantity := greatest(coalesce(new.stock_quantity, 0), 0);

  if lower(new.category) in (
    'uncategorized',
    'other / uncategorized',
    'others / uncategorized'
  ) then
    new.category := public.infer_product_category_from_name(new.product_name);
  elsif lower(new.category) = 'meat' then
    new.category := 'Meat';
  elsif lower(new.category) = 'drinks' then
    new.category := 'Drinks';
  elsif lower(new.category) = 'condiments' then
    new.category := 'Condiments';
  elsif lower(new.category) = 'frozen goods' then
    new.category := 'Frozen Goods';
  elsif lower(new.category) in ('korean noodles', 'noodles') then
    new.category := 'Noodles';
  elsif lower(new.category) in ('rice / sides', 'rice and sides') then
    new.category := 'Rice / Sides';
  elsif lower(new.category) = 'vegetables' then
    new.category := 'Vegetables';
  elsif lower(new.category) = 'dairy' then
    new.category := 'Dairy';
  elsif lower(new.category) in ('snacks', 'seaweed') then
    new.category := 'Snacks';
  elsif lower(new.category) = 'desserts' then
    new.category := 'Desserts';
  elsif lower(new.category) in ('coffee / tea', 'coffee', 'tea') then
    new.category := 'Coffee / Tea';
  elsif lower(new.category) = 'packaging' then
    new.category := 'Packaging';
  elsif lower(new.category) = 'supplies' then
    new.category := 'Supplies';
  elsif lower(new.category) in ('samgyup meat', 'samgyup bowl meat') then
    new.category := 'Meat';
  end if;

  return new;
end;
$$;

drop trigger if exists normalize_product_catalog_quality_fields on public.products;
create trigger normalize_product_catalog_quality_fields
  before insert or update of product_name, branch, category, net_weight, barcode, stock_quantity
  on public.products
  for each row
  execute function public.normalize_product_catalog_quality_fields();

update public.products
set
  product_name = regexp_replace(btrim(coalesce(product_name, '')), '\s+', ' ', 'g'),
  branch = coalesce(
    nullif(regexp_replace(btrim(coalesce(branch, '')), '\s+', ' ', 'g'), ''),
    'Sta. Lucia'
  ),
  net_weight = regexp_replace(btrim(coalesce(net_weight, '')), '\s+', ' ', 'g'),
  barcode = nullif(regexp_replace(btrim(coalesce(barcode, '')), '\s+', '', 'g'), ''),
  stock_quantity = greatest(coalesce(stock_quantity, 0), 0);

with category_review as (
  select
    id,
    lower(regexp_replace(btrim(coalesce(category, '')), '\s+', ' ', 'g')) as current_category,
    public.infer_product_category_from_name(product_name) as inferred_category
  from public.products
),
resolved_categories as (
  select
    id,
    case
      when inferred_category <> 'Uncategorized' then inferred_category
      when current_category = 'meat' then 'Meat'
      when current_category = 'drinks' then 'Drinks'
      when current_category = 'condiments' then 'Condiments'
      when current_category = 'frozen goods' then 'Frozen Goods'
      when current_category in ('korean noodles', 'noodles') then 'Noodles'
      when current_category in ('rice / sides', 'rice and sides') then 'Rice / Sides'
      when current_category = 'vegetables' then 'Vegetables'
      when current_category = 'dairy' then 'Dairy'
      when current_category in ('snacks', 'seaweed') then 'Snacks'
      when current_category = 'desserts' then 'Desserts'
      when current_category in ('coffee / tea', 'coffee', 'tea') then 'Coffee / Tea'
      when current_category = 'packaging' then 'Packaging'
      when current_category = 'supplies' then 'Supplies'
      when current_category in ('samgyup meat', 'samgyup bowl meat') then 'Meat'
      else 'Uncategorized'
    end as category
  from category_review
)
update public.products product_row
set category = resolved.category
from resolved_categories resolved
where product_row.id = resolved.id
  and product_row.category is distinct from resolved.category;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_barcode_format_check'
  ) then
    alter table public.products
      add constraint products_barcode_format_check
      check (barcode is null or barcode ~ '^[A-Za-z0-9._/-]{1,64}$')
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_category_standard_check'
  ) then
    alter table public.products
      add constraint products_category_standard_check
      check (
        category in (
          'Meat',
          'Drinks',
          'Condiments',
          'Frozen Goods',
          'Noodles',
          'Rice / Sides',
          'Vegetables',
          'Dairy',
          'Snacks',
          'Desserts',
          'Coffee / Tea',
          'Packaging',
          'Supplies',
          'Uncategorized'
        )
      )
      not valid;
  end if;
end
$$;

create index if not exists idx_products_barcode_lookup
  on public.products (lower(barcode))
  where barcode is not null;

do $$
begin
  if exists (
    select 1
    from public.products
    where barcode is not null
    group by branch, lower(barcode)
    having count(*) > 1
  ) then
    raise notice
      'Skipped products_branch_barcode_unique because duplicate nonblank barcodes exist per branch. Resolve duplicates, then create the partial unique index.';
  else
    execute 'create unique index if not exists products_branch_barcode_unique
      on public.products (branch, lower(barcode))
      where barcode is not null';
  end if;
end
$$;

do $$
declare
  has_branch_id boolean;
  has_reorder_level boolean;
  has_is_active boolean;
  branch_join_condition text;
  branch_order_clause text;
  product_branch_id_expr text;
  inventory_branch_id_expr text;
  is_active_expr text;
  reorder_level_expr text;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'branch_id'
  ) into has_branch_id;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'reorder_level'
  ) into has_reorder_level;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'is_active'
  ) into has_is_active;

  branch_join_condition := case
    when has_branch_id then
      'b.id = p.branch_id or (p.branch_id is null and b.name = p.branch)'
    else
      'b.name = p.branch'
  end;

  branch_order_clause := case
    when has_branch_id then
      'case when b.id = p.branch_id then 0 else 1 end, b.id'
    else
      'b.id'
  end;

  product_branch_id_expr := case
    when has_branch_id then
      'coalesce(p.branch_id, branch_lookup.id)'
    else
      'branch_lookup.id'
  end;

  inventory_branch_id_expr := case
    when has_branch_id then
      'coalesce(p.branch_id, branch_lookup.id, case when p.branch = ''Dollar'' then 2 when p.branch = ''Sta. Lucia'' then 1 else null end)'
    else
      'coalesce(branch_lookup.id, case when p.branch = ''Dollar'' then 2 when p.branch = ''Sta. Lucia'' then 1 else null end)'
  end;

  is_active_expr := case
    when has_is_active then 'coalesce(p.is_active, true)'
    else 'true'
  end;

  reorder_level_expr := case
    when has_reorder_level then 'coalesce(p.reorder_level, 10)'
    else '10'
  end;

  execute 'drop view if exists public.inventory_catalog_view';
  execute 'drop view if exists public.product_catalog_view';

  execute format($view$
    create view public.product_catalog_view
    with (security_invoker = true) as
    select
      p.id as product_id,
      %1$s as branch_id,
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
      p.barcode,
      p.product_name,
      p.net_weight as unit_label,
      p.price as default_price,
      %2$s as is_active
    from public.products p
    left join lateral (
      select
        b.id,
        b.code,
        b.name
      from public.branches b
      where %3$s
      order by %4$s
      limit 1
    ) branch_lookup on true;
  $view$, product_branch_id_expr, is_active_expr, branch_join_condition, branch_order_clause);

  execute format($view$
    create view public.inventory_catalog_view
    with (security_invoker = true) as
    select
      p.id as inventory_item_id,
      %1$s as branch_id,
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
      p.barcode,
      p.product_name,
      p.net_weight as unit_label,
      coalesce(p.price, 0) as price,
      p.price as default_price,
      p.price as selling_price,
      p.stock_quantity,
      %2$s as reorder_level,
      p.expiration_date,
      null::text as legacy_stock_text,
      %3$s as is_active
    from public.products p
    left join lateral (
      select
        b.id,
        b.code,
        b.name
      from public.branches b
      where %4$s
      order by %5$s
      limit 1
    ) branch_lookup on true;
  $view$, inventory_branch_id_expr, reorder_level_expr, is_active_expr, branch_join_condition, branch_order_clause);

  execute 'revoke all on public.product_catalog_view from anon, authenticated';
  execute 'revoke all on public.inventory_catalog_view from anon, authenticated';
  execute 'grant select on public.product_catalog_view to authenticated';
  execute 'grant select on public.inventory_catalog_view to authenticated';
end
$$;

select
  count(*) as products_count,
  count(*) filter (where barcode is not null) as products_with_barcode,
  count(*) filter (where category = 'Uncategorized') as uncategorized_count,
  count(distinct category) as category_count
from public.products;

select category, count(*) as product_count
from public.products
group by category
order by product_count desc, category asc;

commit;
