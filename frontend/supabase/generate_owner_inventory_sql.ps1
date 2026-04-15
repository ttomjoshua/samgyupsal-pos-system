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
      branch = if ([int]$_.branch_id -eq 2) { 'Dollar' } else { 'Sta. Lucia' }
      category = (($_.category -replace '\s+', ' ').Trim())
      product_name = (($_.product_name -replace '\s+', ' ').Trim())
      net_weight = (($_.net_weight -replace '\s+', ' ').Trim())
    }
  } |
  Group-Object branch, category, product_name, net_weight

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
--   products: $($normalizedProducts.Count)
--   branch 1 products: $($staLuciaRows.Count)
--   branch 2 products: $($dollarRows.Count)

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

alter table public.products
  add column if not exists branch text,
  add column if not exists category text,
  add column if not exists net_weight text,
  add column if not exists price numeric(12, 2),
  add column if not exists stock_quantity integer not null default 0,
  add column if not exists expiration_date date;

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

delete from public.inventory_items;
delete from public.categories;
delete from public.products;

insert into public.products (
  branch,
  category,
  product_name,
  net_weight,
  price,
  stock_quantity,
  expiration_date
)
with normalized_rows as (
  select
    case
      when branch_id = 2 then 'Dollar'
      else 'Sta. Lucia'
    end as branch_name,
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
    coalesce(regexp_replace(btrim(coalesce(net_weight, '')), '\s+', ' ', 'g'), '') as net_weight_clean,
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
  from owner_inventory_raw
),
collapsed_products as (
  select
    branch_name,
    category_clean,
    product_name_clean,
    net_weight_clean,
    max(price_numeric) as price_value,
    sum(stock_quantity_numeric) as stock_quantity_total,
    min(expiration_date_value) as expiration_date_value
  from normalized_rows
  group by 1, 2, 3, 4
)
select
  branch_name,
  category_clean,
  product_name_clean,
  net_weight_clean,
  price_value,
  stock_quantity_total,
  expiration_date_value
from collapsed_products
order by branch_name asc, category_clean asc, product_name_clean asc, net_weight_clean asc;

select setval(
  pg_get_serial_sequence('public.products', 'id'),
  greatest((select coalesce(max(id), 1) from public.products), 1),
  true
);

commit;

select
  (select count(*) from public.products) as products_count,
  (select count(*) from public.products where branch = 'Sta. Lucia') as sta_lucia_products_count,
  (select count(*) from public.products where branch = 'Dollar') as dollar_products_count;
"@

$outputDirectory = Split-Path -Parent $OutputPath
if (-not (Test-Path -LiteralPath $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

[System.IO.File]::WriteAllText($OutputPath, $sql, [System.Text.UTF8Encoding]::new($false))
Write-Output "Wrote $OutputPath"
