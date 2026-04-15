param(
  [string]$StaLuciaCsv = 'C:\Users\tomja\OneDrive\Desktop\Stock_Inventory_Oh_G_Samgyup_Sta.Lucia - Sheet1.csv',
  [string]$DollarCsv = 'C:\Users\tomja\OneDrive\Desktop\Stock_Inventory_Oh_G_Samgyup_Dollar - Sheet1.csv',
  [string]$OutputPath = (Join-Path $PSScriptRoot 'sql\07_replace_inventory_with_owner_csv.sql')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Test-NumericString {
  param([string]$Value)

  return -not [string]::IsNullOrWhiteSpace($Value) -and $Value -match '^\d+(\.\d+)?$'
}

function Normalize-BranchRows {
  param(
    [string]$Path,
    [int]$ExpectedBranchId
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "CSV file not found: $Path"
  }

  $rows = Import-Csv -LiteralPath $Path

  foreach ($row in $rows) {
    $branchId = 0

    if (-not [int]::TryParse([string]$row.branch_id, [ref]$branchId)) {
      throw "The CSV at '$Path' contains a non-numeric branch_id value: '$($row.branch_id)'"
    }

    if ($branchId -ne $ExpectedBranchId) {
      throw "The CSV at '$Path' contains branch_id '$branchId' but expected '$ExpectedBranchId'."
    }
  }

  return $rows
}

function Convert-ToSqlLiteral {
  param($Value)

  if ($null -eq $Value) {
    return 'null'
  }

  $text = [string]$Value

  if ([string]::IsNullOrEmpty($text)) {
    return ''''''
  }

  return "'" + $text.Replace("'", "''") + "'"
}

function Convert-ToSqlIntegerLiteral {
  param($Value)

  $text = [string]$Value

  if ([string]::IsNullOrWhiteSpace($text)) {
    return 'null'
  }

  $integer = 0
  if (-not [int]::TryParse($text, [ref]$integer)) {
    throw "Expected an integer value but received '$text'."
  }

  return [string]$integer
}

$staLuciaRows = Normalize-BranchRows -Path $StaLuciaCsv -ExpectedBranchId 1
$dollarRows = Normalize-BranchRows -Path $DollarCsv -ExpectedBranchId 2
$rows = @($staLuciaRows) + @($dollarRows)

$normalizedProducts = $rows |
  ForEach-Object {
    [pscustomobject]@{
      category = (($_.category -replace '\s+', ' ').Trim())
      product_name = (($_.product_name -replace '\s+', ' ').Trim())
      net_weight = (($_.net_weight -replace '\s+', ' ').Trim())
    }
  } |
  Group-Object category, product_name, net_weight

$distinctCategories = (
  $rows |
    ForEach-Object { (($_.category -replace '\s+', ' ').Trim()) } |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
    Sort-Object -Unique
)

$valueLines = @(
  foreach ($row in $rows) {
    "  (" + (
      @(
        (Convert-ToSqlIntegerLiteral $row.id)
        (Convert-ToSqlIntegerLiteral $row.branch_id)
        (Convert-ToSqlLiteral $row.category)
        (Convert-ToSqlLiteral $row.product_name)
        (Convert-ToSqlLiteral $row.net_weight)
        (Convert-ToSqlLiteral $row.price)
        (Convert-ToSqlLiteral $row.stock_quantity)
        (Convert-ToSqlLiteral $row.expiration_date)
        (Convert-ToSqlLiteral $row.created_at)
      ) -join ', '
    ) + ")"
  }
)

$sql = @"
begin;

-- Generated from owner-provided CSV snapshots.
-- Source files:
--   $StaLuciaCsv
--   $DollarCsv
-- Expected result after a successful run:
--   categories: $($distinctCategories.Count)
--   products: $($normalizedProducts.Count)
--   inventory_items: $($rows.Count)
--   branch 1 inventory_items: $($staLuciaRows.Count)
--   branch 2 inventory_items: $($dollarRows.Count)

create temporary table owner_inventory_raw (
  source_row_id bigint,
  branch_id integer not null,
  category text,
  product_name text,
  net_weight text,
  price text,
  stock_quantity text,
  expiration_date text,
  created_at text
) on commit drop;

insert into owner_inventory_raw (
  source_row_id,
  branch_id,
  category,
  product_name,
  net_weight,
  price,
  stock_quantity,
  expiration_date,
  created_at
)
values
$($valueLines -join ",`n");

insert into public.branches (
  id,
  code,
  name,
  manager_name,
  contact_number,
  address,
  opening_date,
  status
)
values
  (1, 'MAIN', 'Sta. Lucia', null, null, null, null, 'active'),
  (2, 'DOLLAR', 'Dollar', null, null, null, null, 'active')
on conflict (id) do update
set
  code = excluded.code,
  name = excluded.name,
  manager_name = excluded.manager_name,
  contact_number = excluded.contact_number,
  address = excluded.address,
  opening_date = excluded.opening_date,
  status = excluded.status,
  updated_at = now();

delete from public.inventory_items;
delete from public.products;
delete from public.categories;

insert into public.categories (
  name,
  slug,
  created_at,
  updated_at
)
select distinct
  normalized_rows.category_clean,
  regexp_replace(
    lower(
      regexp_replace(normalized_rows.category_clean, '[^a-zA-Z0-9]+', '-', 'g')
    ),
    '(^-+|-+$)',
    '',
    'g'
  ) as category_slug,
  now(),
  now()
from (
  select
    case
      when btrim(coalesce(category, '')) = '' then 'Uncategorized'
      else regexp_replace(btrim(category), '\s+', ' ', 'g')
    end as category_clean
  from owner_inventory_raw
) normalized_rows
order by normalized_rows.category_clean asc;

insert into public.products (
  category_id,
  product_name,
  unit_label,
  default_price,
  legacy_price_text,
  is_active,
  created_at,
  updated_at
)
with normalized_rows as (
  select
    case
      when btrim(coalesce(category, '')) = '' then 'Uncategorized'
      else regexp_replace(btrim(category), '\s+', ' ', 'g')
    end as category_clean,
    regexp_replace(
      btrim(coalesce(product_name, 'Unnamed Product')),
      '\s+',
      ' ',
      'g'
    ) as product_name_clean,
    coalesce(regexp_replace(btrim(coalesce(net_weight, '')), '\s+', ' ', 'g'), '') as unit_label_clean,
    btrim(coalesce(price, '')) as price_text,
    case
      when btrim(coalesce(price, '')) ~ '^\d+(\.\d+)?$'
        then btrim(price)::numeric(12, 2)
      else null
    end as price_numeric,
    case
      when btrim(coalesce(created_at, '')) ~ '^\d{4}-\d{2}-\d{2}'
        then btrim(created_at)::timestamptz
      else now()
    end as created_at_value
  from owner_inventory_raw
),
catalog_seed as (
  select
    category_clean,
    product_name_clean,
    unit_label_clean,
    max(price_numeric) as default_price,
    max(nullif(price_text, '')) as legacy_price_text,
    min(created_at_value) as created_at_value
  from normalized_rows
  group by 1, 2, 3
)
select
  c.id,
  catalog_seed.product_name_clean,
  catalog_seed.unit_label_clean,
  catalog_seed.default_price,
  catalog_seed.legacy_price_text,
  true,
  catalog_seed.created_at_value,
  now()
from catalog_seed
join public.categories c
  on c.name = catalog_seed.category_clean
order by c.name asc, catalog_seed.product_name_clean asc, catalog_seed.unit_label_clean asc;

insert into public.inventory_items (
  branch_id,
  product_id,
  selling_price,
  stock_quantity,
  reorder_level,
  expiration_date,
  legacy_stock_text,
  is_active,
  created_at,
  updated_at
)
with normalized_rows as (
  select
    branch_id,
    case
      when btrim(coalesce(category, '')) = '' then 'Uncategorized'
      else regexp_replace(btrim(category), '\s+', ' ', 'g')
    end as category_clean,
    regexp_replace(
      btrim(coalesce(product_name, 'Unnamed Product')),
      '\s+',
      ' ',
      'g'
    ) as product_name_clean,
    coalesce(regexp_replace(btrim(coalesce(net_weight, '')), '\s+', ' ', 'g'), '') as unit_label_clean,
    btrim(coalesce(price, '')) as price_text,
    case
      when btrim(coalesce(price, '')) ~ '^\d+(\.\d+)?$'
        then btrim(price)::numeric(12, 2)
      else null
    end as price_numeric,
    btrim(coalesce(stock_quantity, '')) as stock_text,
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
    end as expiration_date_value,
    case
      when btrim(coalesce(created_at, '')) ~ '^\d{4}-\d{2}-\d{2}'
        then btrim(created_at)::timestamptz
      else now()
    end as created_at_value
  from owner_inventory_raw
),
inventory_seed as (
  select
    branch_id,
    category_clean,
    product_name_clean,
    unit_label_clean,
    max(price_numeric) as selling_price,
    sum(stock_quantity_numeric) as stock_quantity,
    max(expiration_date_value) as expiration_date_value,
    max(nullif(stock_text, '')) as legacy_stock_text,
    min(created_at_value) as created_at_value
  from normalized_rows
  group by 1, 2, 3, 4
)
select
  inventory_seed.branch_id,
  p.id,
  coalesce(inventory_seed.selling_price, p.default_price, 0),
  inventory_seed.stock_quantity,
  10,
  inventory_seed.expiration_date_value,
  inventory_seed.legacy_stock_text,
  true,
  inventory_seed.created_at_value,
  now()
from inventory_seed
join public.categories c
  on c.name = inventory_seed.category_clean
join public.products p
  on p.category_id = c.id
 and p.product_name = inventory_seed.product_name_clean
 and p.unit_label = inventory_seed.unit_label_clean
order by inventory_seed.branch_id asc, c.name asc, p.product_name asc, p.unit_label asc;

select setval(
  pg_get_serial_sequence('public.categories', 'id'),
  greatest((select coalesce(max(id), 1) from public.categories), 1),
  true
);

select setval(
  pg_get_serial_sequence('public.products', 'id'),
  greatest((select coalesce(max(id), 1) from public.products), 1),
  true
);

select setval(
  pg_get_serial_sequence('public.inventory_items', 'id'),
  greatest((select coalesce(max(id), 1) from public.inventory_items), 1),
  true
);

commit;

select
  (select count(*) from public.categories) as categories_count,
  (select count(*) from public.products) as products_count,
  (select count(*) from public.inventory_items) as inventory_items_count,
  (select count(*) from public.inventory_items where branch_id = 1) as sta_lucia_inventory_items_count,
  (select count(*) from public.inventory_items where branch_id = 2) as dollar_inventory_items_count;
"@

$outputDirectory = Split-Path -Parent $OutputPath
if (-not (Test-Path -LiteralPath $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

[System.IO.File]::WriteAllText($OutputPath, $sql, [System.Text.UTF8Encoding]::new($false))
Write-Output "Wrote $OutputPath"
