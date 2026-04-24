-- Demo/test product data completion for Samgyupsal POS.
--
-- Run after 16_products_barcode_category_quality.sql.
--
-- Purpose:
--   Fill incomplete product records so inventory, search, barcode-ready UI,
--   and POS testing have usable data. These values are deterministic demo
--   values inferred from product names/categories, not supplier-certified
--   barcodes or expiration dates.
--
-- What this script fills:
--   - blank barcode -> TEST-{branch}-{product_id}
--   - blank or price-copied unit values -> sensible product/category unit
--   - null/zero price -> sensible product/category demo price
--   - zero/blank stock -> category-specific demo stock
--   - null expiration_date -> category-specific future demo date
--   - weak/blank category -> standard category from the Step 16 inference rules

begin;

do $$
begin
  if to_regprocedure('public.infer_product_category_from_name(text)') is null then
    raise exception
      'Run apps/web/supabase/sql/16_products_barcode_category_quality.sql before this demo data completion script.';
  end if;
end
$$;

alter table public.products
  add column if not exists barcode text;

with product_review as (
  select
    id,
    upper(regexp_replace(btrim(coalesce(product_name, '')), '\s+', ' ', 'g')) as name_key,
    btrim(coalesce(branch, '')) as branch_clean,
    lower(regexp_replace(btrim(coalesce(category, '')), '\s+', ' ', 'g')) as category_key,
    regexp_replace(btrim(coalesce(net_weight, '')), '\s+', ' ', 'g') as unit_clean,
    nullif(regexp_replace(btrim(coalesce(barcode, '')), '\s+', '', 'g'), '') as barcode_clean,
    price,
    stock_quantity,
    expiration_date,
    public.infer_product_category_from_name(product_name) as inferred_category,
    case
      when regexp_replace(btrim(coalesce(net_weight, '')), '\s+', ' ', 'g') ~ '^\d+(\.\d+)?$'
        and price is not null
        then regexp_replace(btrim(coalesce(net_weight, '')), '\s+', ' ', 'g')::numeric = price
      else false
    end as unit_looks_like_copied_price
  from public.products
),
resolved_categories as (
  select
    *,
    case
      when inferred_category <> 'Uncategorized' then inferred_category
      when category_key = 'meat' then 'Meat'
      when category_key = 'drinks' then 'Drinks'
      when category_key = 'condiments' then 'Condiments'
      when category_key = 'frozen goods' then 'Frozen Goods'
      when category_key in ('korean noodles', 'noodles') then 'Noodles'
      when category_key in ('rice / sides', 'rice and sides') then 'Rice / Sides'
      when category_key = 'vegetables' then 'Vegetables'
      when category_key = 'dairy' then 'Dairy'
      when category_key in ('snacks', 'seaweed') then 'Snacks'
      when category_key = 'desserts' then 'Desserts'
      when category_key in ('coffee / tea', 'coffee', 'tea') then 'Coffee / Tea'
      when category_key = 'packaging' then 'Packaging'
      when category_key = 'supplies' then 'Supplies'
      when category_key in ('samgyup meat', 'samgyup bowl meat') then 'Meat'
      else 'Uncategorized'
    end as category_value
  from product_review
),
resolved_values as (
  select
    id,
    category_value,
    case
      when barcode_clean is not null then barcode_clean
      else format(
        'TEST-%s-%s',
        case
          when branch_clean = 'Dollar' then 'DOL'
          when branch_clean = 'Sta. Lucia' then 'STL'
          else 'BR'
        end,
        lpad(id::text, 6, '0')
      )
    end as barcode_value,
    case
      when unit_clean <> ''
        and unit_clean <> '-'
        and lower(unit_clean) not in ('n/a', 'na', 'none', 'null')
        and not unit_looks_like_copied_price
        then unit_clean
      when name_key like '%ALASKA%' then '370ml'
      when name_key like '%ALL PURPOSE CREAM%' then '250ml'
      when name_key like '%HONEY CITRON%' then '1KG'
      when name_key like '%LET''S BE%' then '175ml'
      when name_key like '%MAXIM%' or name_key like '%MOCHA%' then '11g'
      when name_key like '%BINGGRAE%' then '200ml'
      when name_key like '%PORORO%' then '235ml'
      when name_key like '%COKE MISMO%'
        or name_key like '%SPRITE MISMO%'
        or name_key like '%ROYAL MISMO%' then '290ml'
      when name_key like '%COKE%'
        or name_key like '%SPRITE%'
        or name_key like '%ROYAL%' then '1.5L'
      when name_key like '%CUP %' then 'cup'
      when name_key like '%POUCH %' then 'pouch'
      when category_value = 'Meat' then 'serving'
      when category_value = 'Drinks' then 'bottle'
      when category_value = 'Condiments' then 'pack'
      when category_value = 'Frozen Goods' then 'pack'
      when category_value = 'Noodles' then 'pack'
      when category_value = 'Rice / Sides' then 'serving'
      when category_value = 'Vegetables' then 'bundle'
      when category_value = 'Dairy' then 'pack'
      when category_value = 'Snacks' then 'pack'
      when category_value = 'Desserts' then 'piece'
      when category_value = 'Coffee / Tea' then '11g'
      when category_value = 'Packaging' then 'pack'
      when category_value = 'Supplies' then 'piece'
      else 'unit'
    end as net_weight_value,
    case
      when coalesce(price, 0) > 0 then price
      when name_key like '%BIBIGO%' then 45.00
      when name_key like '%KIMCHI BIG%' then 95.00
      when name_key like '%KIMCHI MEDIUM%' then 65.00
      when name_key like '%KIMCHI CUP%' then 35.00
      when name_key like '%MARBLE POTATO%' then 45.00
      when name_key like '%RADISH%' then 45.00
      when name_key like '%ALASKA CLASSIC%' then 35.00
      when name_key like '%BINGGRAE%' then 50.00
      when name_key like '%WELCH%' then 55.00
      when name_key like '%ALOE VERA%' then 70.00
      when name_key like '%PORORO PEACH%' then 50.00
      when name_key like '%PORORO%' then 50.00
      when name_key like '%CHAMISUL%' then 105.00
      when name_key like '%MELONA UBE%' then 35.00
      when name_key like '%MELONA COFFEE%' then 35.00
      when name_key like '%MILK CLASSIC%' then 60.00
      when name_key like '%ANCHOR CHEESE%' then 110.00
      when name_key like '%EDEN CHEESE%' then 95.00
      when name_key like '%ANCHOR BUTTER%' then 95.00
      when name_key like '%CUP YOPOKKI CHEESE%' then 100.00
      when name_key like '%CUP BULDAK CHEESE%' then 70.00
      when category_value = 'Meat' then 109.00
      when category_value = 'Drinks' then 50.00
      when category_value = 'Condiments' then 45.00
      when category_value = 'Frozen Goods' then 90.00
      when category_value = 'Noodles' then 55.00
      when category_value = 'Rice / Sides' then 45.00
      when category_value = 'Vegetables' then 50.00
      when category_value = 'Dairy' then 55.00
      when category_value = 'Snacks' then 50.00
      when category_value = 'Desserts' then 35.00
      when category_value = 'Coffee / Tea' then 11.00
      when category_value = 'Packaging' then 10.00
      when category_value = 'Supplies' then 65.00
      else 25.00
    end as price_value,
    case
      when coalesce(stock_quantity, 0) > 0 then stock_quantity
      when category_value = 'Meat' then 20
      when category_value = 'Drinks' then 36
      when category_value = 'Condiments' then 20
      when category_value = 'Frozen Goods' then 24
      when category_value = 'Noodles' then 30
      when category_value = 'Rice / Sides' then 22
      when category_value = 'Vegetables' then 12
      when category_value = 'Dairy' then 18
      when category_value = 'Snacks' then 24
      when category_value = 'Desserts' then 24
      when category_value = 'Coffee / Tea' then 48
      when category_value = 'Packaging' then 40
      when category_value = 'Supplies' then 10
      else 15
    end as stock_quantity_value,
    coalesce(
      expiration_date,
      case
        when category_value = 'Meat' then date '2026-10-31'
        when category_value = 'Drinks' then date '2027-06-30'
        when category_value = 'Condiments' then date '2027-09-30'
        when category_value = 'Frozen Goods' then date '2027-02-28'
        when category_value = 'Noodles' then date '2027-03-31'
        when category_value = 'Rice / Sides' then date '2027-01-31'
        when category_value = 'Vegetables' then date '2026-08-31'
        when category_value = 'Dairy' then date '2027-04-30'
        when category_value = 'Snacks' then date '2027-04-30'
        when category_value = 'Desserts' then date '2026-10-31'
        when category_value = 'Coffee / Tea' then date '2027-12-31'
        when category_value = 'Packaging' then date '2028-12-31'
        when category_value = 'Supplies' then date '2028-12-31'
        else date '2027-12-31'
      end
    ) as expiration_date_value
  from resolved_categories
),
updated_products as (
  update public.products product_row
  set
    category = resolved.category_value,
    barcode = resolved.barcode_value,
    net_weight = resolved.net_weight_value,
    price = resolved.price_value,
    stock_quantity = resolved.stock_quantity_value,
    expiration_date = resolved.expiration_date_value
  from resolved_values resolved
  where product_row.id = resolved.id
    and (
      product_row.category is distinct from resolved.category_value
      or nullif(regexp_replace(btrim(coalesce(product_row.barcode, '')), '\s+', '', 'g'), '') is null
      or btrim(coalesce(product_row.net_weight, '')) = ''
      or btrim(coalesce(product_row.net_weight, '')) = '-'
      or case
        when btrim(coalesce(product_row.net_weight, '')) ~ '^\d+(\.\d+)?$'
          and product_row.price is not null
          then btrim(product_row.net_weight)::numeric = product_row.price
        else false
      end
      or coalesce(product_row.stock_quantity, 0) <= 0
      or coalesce(product_row.price, 0) <= 0
      or product_row.expiration_date is null
    )
  returning
    product_row.id,
    product_row.branch,
    product_row.category,
    product_row.product_name,
    product_row.net_weight,
    product_row.barcode,
    product_row.price,
    product_row.stock_quantity,
    product_row.expiration_date
)
select
  count(*) as completed_products_count,
  count(*) filter (where category = 'Dairy') as completed_dairy_count,
  count(*) filter (where barcode is not null) as completed_with_barcode_count,
  count(*) filter (where price > 0) as completed_with_price_count,
  count(*) filter (where stock_quantity > 0) as completed_with_stock_count,
  count(*) filter (where expiration_date is not null) as completed_with_expiry_count
from updated_products;

select
  count(*) filter (where barcode is null or btrim(barcode) = '') as missing_barcode_count,
  count(*) filter (where coalesce(price, 0) <= 0) as zero_price_count,
  count(*) filter (
    where btrim(coalesce(net_weight, '')) = ''
      or btrim(coalesce(net_weight, '')) = '-'
      or case
        when btrim(coalesce(net_weight, '')) ~ '^\d+(\.\d+)?$'
          and price is not null
          then btrim(net_weight)::numeric = price
        else false
      end
  ) as missing_or_weak_unit_count,
  count(*) filter (where coalesce(stock_quantity, 0) <= 0) as zero_stock_count,
  count(*) filter (where expiration_date is null) as missing_expiry_count
from public.products;

select
  id,
  branch,
  category,
  product_name,
  net_weight,
  barcode,
  price,
  stock_quantity,
  expiration_date
from public.products
where product_name in (
  'ALASKA CLASSIC',
  'HONEY CITRON TEA',
  'MAXIM WHITE GOLD',
  'MAXIM ORIGINAL',
  'MOCHA ARABICA'
)
order by branch, product_name, id;

commit;
