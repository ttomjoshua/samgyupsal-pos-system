begin;

do $$
begin
  if to_regclass('public.products_legacy') is null then
    raise exception 'public.products_legacy does not exist. Restore or preserve the legacy table before running this repair.';
  end if;
end
$$;

create temporary table restored_legacy_categories on commit drop as
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
),
updated_products as (
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
    )
  returning
    product_row.id as product_id,
    product_row.branch,
    product_row.product_name,
    product_row.net_weight,
    legacy_match.category_name as restored_category
)
select *
from updated_products;

select count(*) as updated_products_count
from restored_legacy_categories;

commit;
