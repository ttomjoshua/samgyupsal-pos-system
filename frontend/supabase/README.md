# Supabase SQL Editor Run Order

Run these files in order inside the Supabase SQL Editor.

## 1. Rebuild the core schema and migrate legacy products

Run:

- [`sql/01_core_tables.sql`](./sql/01_core_tables.sql)

This script now does the careful full-stack reset path:

- preserves the old mixed `products` table by renaming it to `products_legacy`
- preserves the old `sale_items` table by renaming it to `sale_items_legacy`
- creates normalized tables for:
  - `branches`
  - `categories`
  - `products`
  - `inventory_items`
  - `sales`
  - `sale_items`
- creates two read views for the frontend:
  - `product_catalog_view`
  - `inventory_catalog_view`
- migrates legacy product rows into the new catalog and inventory tables

Important:

- This is a one-time structural migration.
- It is designed to be safe for the current state where your old `products` table already exists.
- Do not manually delete `products_legacy` until the team is fully happy with the migrated data.

## 2. Development/demo RLS policies and grants

Run:

- [`sql/02_dev_demo_policies.sql`](./sql/02_dev_demo_policies.sql)

This script:

- grants anon/authenticated access needed for the current frontend demo
- enables RLS on the new tables
- adds broad demo policies for select/insert/update
- grants select access to the frontend views

Important:

- This is intentionally permissive for capstone/demo use.
- Tighten these policies before production.
- Do not treat them as final security.

## 3. Replace the demo catalog with the owner inventory snapshot

When you want the database to reflect the owner-provided CSV inventory for:

- `branch_id = 1` -> `Sta. Lucia` main branch
- `branch_id = 2` -> `Dollar`

use:

- [`generate_owner_inventory_sql.ps1`](./generate_owner_inventory_sql.ps1)
- [`sql/07_replace_inventory_with_owner_csv.sql`](./sql/07_replace_inventory_with_owner_csv.sql)

Workflow:

1. Regenerate the SQL file if the owner sends updated CSVs:

```powershell
./generate_owner_inventory_sql.ps1
```

2. Run [`sql/07_replace_inventory_with_owner_csv.sql`](./sql/07_replace_inventory_with_owner_csv.sql) in the Supabase SQL Editor.

This replacement script:

- updates branch `1` to `Sta. Lucia` as the main branch
- updates branch `2` to `Dollar`
- replaces `categories`, `products`, and `inventory_items` using the owner CSV snapshot
- preserves messy source values like `4 FOR 100`, `114 PCS`, and `1 BOX` in the legacy text columns while keeping operational columns numeric where possible

Expected verification result after the script runs:

- `categories_count = 13`
- `products_count = 254`
- `inventory_items_count = 481`
- `sta_lucia_inventory_items_count = 249`
- `dollar_inventory_items_count = 232`

## 4. Optional profile table scaffold

Run only when the backend/auth team is ready:

- [`sql/03_optional_profiles_table.sql`](./sql/03_optional_profiles_table.sql)

This prepares a `profiles` table linked to `auth.users`.

## 5. Real auth profile trigger and RLS rollout

Run when you are ready to switch the frontend login to Supabase Auth:

- [`sql/04_auth_profiles_rollout.sql`](./sql/04_auth_profiles_rollout.sql)

This script:

- makes the `profiles` table fully ready for real auth
- creates the `handle_new_auth_user()` trigger from `auth.users`
- backfills missing profile rows for any auth users that already exist
- adds the `current_user_is_admin()` helper
- enables RLS on `profiles`
- allows each authenticated user to read their own profile
- allows admins to read and update all profiles

Important:

- This is the handoff point where frontend login can safely start using Supabase Auth.
- After running it, create the real auth users in the Supabase Dashboard or through a trusted backend path.
- Do not expose the `service_role` key in the frontend.

## 6. Seed role and branch assignments for the first auth users

Run only after you manually create the first Auth users in Supabase Dashboard:

- [`sql/05_auth_profile_seed_template.sql`](./sql/05_auth_profile_seed_template.sql)

Before running:

- replace the example emails inside the file with the real email addresses you used
- keep the branch ids aligned to your `branches` table

This script is just a template so you can assign:

- admin role
- employee role
- branch scope
- active status

## New backend shape

The frontend is now aligned to this structure:

- `branches`
- `categories`
- `products`
- `inventory_items`
- `sales`
- `sale_items`
- `product_catalog_view`
- `inventory_catalog_view`

That means we are no longer treating `products` as a raw all-in-one branch stock table.

## Legacy data caution

Some legacy rows still carry messy text values such as:

- `price = '4 FOR 100'`
- `stock_quantity = '114 PCS'`

The migration keeps those raw values in backup columns where useful:

- `products.legacy_price_text`
- `inventory_items.legacy_stock_text`

The clean operational columns are now numeric where the data could be parsed safely:

- `products.default_price`
- `inventory_items.selling_price`
- `inventory_items.stock_quantity`

## Recommended quick checks after running the scripts

1. Confirm that `products_legacy` still exists.
2. Confirm that `products` and `inventory_items` now contain rows.
3. If you ran the auth rollout, confirm that `profiles` contains rows for your auth users.
4. Check these review queries in SQL Editor:

```sql
select count(*) from public.products_legacy;
select count(*) from public.products;
select count(*) from public.inventory_items;

select *
from public.products
where default_price is null
  and legacy_price_text is not null
limit 20;

select *
from public.inventory_items
where legacy_stock_text ~ '[A-Za-z]'
limit 20;
```

Those last two queries help you spot rows that still need manual cleanup later.

If you ran the auth rollout too, add:

```sql
select auth_user.email, profile.*
from public.profiles as profile
left join auth.users as auth_user
  on auth_user.id = profile.id
order by profile.created_at desc;
```
