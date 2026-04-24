# Supabase SQL Editor Run Order

Run these files in order inside the Supabase SQL Editor.

## 1. Rebuild the base schema and preserve legacy data

Run:

- [`apps/web/supabase/sql/01_core_tables.sql`](../../apps/web/supabase/sql/01_core_tables.sql)

This script still does the careful base reset path:

- preserves the old mixed `products` table by renaming it to `products_legacy`
- preserves the old `sale_items` table by renaming it to `sale_items_legacy`
- creates the base tables for:
  - `branches`
  - `categories`
  - `products`
  - `inventory_items`
  - `sales`
  - `sale_items`
- creates two read views for the frontend:
  - `product_catalog_view`
  - `inventory_catalog_view`
- migrates legacy product rows into the intermediate schema

Important:

- This is the base bootstrap step.
- It is designed to be safe for the current state where your old `products` table already exists.
- Do not manually delete `products_legacy` until the team is fully happy with the migrated data.
- Do not rerun this script on an already-cleaned live environment just to pick up one missing column or field. Use the later catch-up scripts instead.

## 2. Flatten `products` into the branch-stock table used by the app

Run:

- [`apps/web/supabase/sql/08_flatten_products_schema.sql`](../../apps/web/supabase/sql/08_flatten_products_schema.sql)

This script makes `public.products` the source of truth for branch inventory with this final shape:

- `id`
- `branch`
- `category`
- `product_name`
- `net_weight`
- `price`
- `stock_quantity`
- `expiration_date`

It also:

- preserves existing `product_id` values by restructuring `products` in place
- backfills the new flat columns from the current normalized tables when needed
- recreates `product_catalog_view` and `inventory_catalog_view` as compatibility read models for the frontend

## 3. Authenticated-only bootstrap RLS policies and grants

Run:

- [`apps/web/supabase/sql/02_dev_demo_policies.sql`](../../apps/web/supabase/sql/02_dev_demo_policies.sql)

This script:

- removes anonymous table access and keeps the bootstrap policy set on authenticated requests only
- enables RLS on the new tables
- adds broad bootstrap policies for the authenticated app flow, including delete operations already used by the frontend
- grants select access to the frontend views

Important:

- This step is still intentionally broad and is only the bootstrap access layer.
- Do not stop here if Supabase Auth is enabled.
- Run the role-aware hardening script later in this guide before production-like demos or security review.

## 4. Replace the demo catalog with the owner inventory snapshot

When you want the database to reflect the owner-provided CSV inventory for:

- `branch_id = 1` -> `Sta. Lucia` main branch
- `branch_id = 2` -> `Dollar`

use:

- [`apps/web/supabase/generate_owner_inventory_sql.ps1`](../../apps/web/supabase/generate_owner_inventory_sql.ps1)
- [`apps/web/supabase/sql/07_replace_inventory_with_owner_csv.sql`](../../apps/web/supabase/sql/07_replace_inventory_with_owner_csv.sql)

Workflow:

1. Regenerate the SQL file if the owner sends updated CSVs:

```powershell
./generate_owner_inventory_sql.ps1
```

2. Run [`apps/web/supabase/sql/07_replace_inventory_with_owner_csv.sql`](../../apps/web/supabase/sql/07_replace_inventory_with_owner_csv.sql) in the Supabase SQL Editor.

This replacement script:

- updates branch `1` to `Sta. Lucia` as the main branch
- updates branch `2` to `Dollar`
- clears old `inventory_items` and `categories` rows so stale normalized data does not hang around
- replaces `products` using the owner CSV snapshot
- stores `stock_quantity` directly in `products`
- stores `branch` as descriptive text instead of `branch_id`

Expected verification result after the script runs:

- `products_count = 481`
- `sta_lucia_products_count = 249`
- `dollar_products_count = 232`

## 5. Optional profile table scaffold

Run only when the authentication rollout team is ready:

- [`apps/web/supabase/sql/03_optional_profiles_table.sql`](../../apps/web/supabase/sql/03_optional_profiles_table.sql)

This prepares a `profiles` table linked to `auth.users`.

## 6. Real auth profile trigger and RLS rollout

Run when you are ready to switch the frontend login to Supabase Auth:

- [`apps/web/supabase/sql/04_auth_profiles_rollout.sql`](../../apps/web/supabase/sql/04_auth_profiles_rollout.sql)

This script:

- makes the `profiles` table fully ready for real auth
- creates the `handle_new_auth_user()` trigger from `auth.users`
- backfills missing profile rows for any auth users that already exist
- adds the `current_user_is_admin()` helper
- enables RLS on `profiles`
- allows each authenticated user to read their own profile
- allows admins to read and update all profiles
- moves the security-definer auth helpers into the private schema instead of leaving them in `public`

Important:

- This is the handoff point where frontend login can safely start using Supabase Auth.
- After running it, create only the first admin auth user manually in the Supabase Dashboard.
- Do not expose the `service_role` key in the frontend.

## 7. Seed role and branch assignments for the first admin user

Run only after you manually create the first admin Auth user in Supabase Dashboard:

- [`apps/web/supabase/sql/05_auth_profile_seed_template.sql`](../../apps/web/supabase/sql/05_auth_profile_seed_template.sql)

Before running:

- replace the example emails inside the file with the real email addresses you used
- keep the branch ids aligned to your `branches` table

This script is just a template so you can assign:

- admin role
- employee role
- branch scope
- active status

## 8. Replace the bootstrap policies with role-aware app policies

Run after the auth rollout and admin seeding steps:

- [`apps/web/supabase/sql/09_auth_role_policies.sql`](../../apps/web/supabase/sql/09_auth_role_policies.sql)

This script:

- revokes the bootstrap demo-era grants from `anon`
- keeps the frontend compatibility views on `security_invoker`
- narrows access to authenticated users only
- limits branch reads, sales writes, and employee access by the authenticated profile
- preserves the current browser-managed inventory sync path by allowing branch-scoped product updates for active employees

Important:

- This is the policy set you should defend with during capstone review.
- It is materially safer than the bootstrap policy file, but it still inherits one design tradeoff from the current frontend: employees can update product rows within their assigned branch because the browser is still performing stock deductions after checkout.
- The next recommended security step is moving checkout and stock deduction into a trusted RPC or Edge Function so product writes no longer need to come from the browser at all.

## 9. Add one-device session locking for authenticated users

Run after the auth rollout and role-aware policy scripts:

- [`apps/web/supabase/sql/10_auth_session_locking.sql`](../../apps/web/supabase/sql/10_auth_session_locking.sql)

This script:

- creates a private session-lock table keyed by auth user id
- exposes authenticated RPC functions for:
  - `claim_session_lock()`
  - `validate_session_lock()`
  - `release_session_lock()`
- uses the Supabase JWT `session_id` claim as the active-device lock value
- cleans up orphaned locks whose prior `auth.sessions` row no longer exists
- keeps a second device blocked while the first device still has a live Supabase auth session

Important:

- this is required for the frontend behavior that blocks a second device from logging into the same account at the same time
- the first device stays active; the newer login is rejected until the older session signs out or its Supabase auth session disappears

## 10. Lock down legacy tables after auth hardening

Run when `products_legacy` or `sale_items_legacy` still exist from the older schema transition:

- [`apps/web/supabase/sql/11_legacy_table_policy_lockdown.sql`](../../apps/web/supabase/sql/11_legacy_table_policy_lockdown.sql)

This script:

- revokes remaining `anon` and `authenticated` table grants from `products_legacy` and `sale_items_legacy`
- enables RLS on both legacy tables as a defense-in-depth fallback
- removes the leftover demo-era legacy policies that would otherwise keep showing up in security review

Important:

- this step is recommended if the project went through the legacy-table rename path and those tables still exist
- it is safe to skip only when those legacy tables are already gone

## 11. Deploy the secure admin-create-user Edge Function

The repo now includes:

- [`apps/web/supabase/functions/admin-create-user/index.ts`](../../apps/web/supabase/functions/admin-create-user/index.ts)

This is the trusted server-side path that lets an authenticated admin create employee Auth users without exposing the `service_role` key in the browser.

What it does:

- validates the caller JWT on the server
- confirms the caller is an active admin from `public.profiles`
- creates the Auth user with `auth.admin.createUser`
- upserts the matching `public.profiles` row with username, branch, role, and status

After deploying it:

- admins can create employee login accounts directly from the Users page
- the login page no longer depends on a frontend-only employee placeholder flow

## 12. Restore legacy category labels for uncategorized products

Run when the flattened `products` table still shows `category = 'Uncategorized'` for rows that should have kept one of the legacy retail labels:

- [`apps/web/supabase/sql/12_restore_legacy_product_categories.sql`](../../apps/web/supabase/sql/12_restore_legacy_product_categories.sql)

This repair script:

- cross-references `public.products` against `public.products_legacy`
- matches rows by normalized branch, product name, and unit / net weight using trimmed, lowercased comparisons
- restores the original legacy category string when the match resolves cleanly to one of:
  - `Korean Noodles`
  - `Samgyup bowl meat`
  - `Samgyup meat`
  - `Seaweed`
- only updates rows that are still blank or already set to `Uncategorized`

Important:

- this script expects `public.products_legacy` to still exist
- it is safe to run after the flattening step whenever category labels drift back to `Uncategorized`
- `apps/web/supabase/sql/08_flatten_products_schema.sql` now includes the same recovery logic for future rebuilds

## 13. Align flattened `products` with the live frontend contract

Run when the project already flattened `public.products` before the branch/reorder alignment work landed:

- [`apps/web/supabase/sql/13_products_operational_alignment.sql`](../../apps/web/supabase/sql/13_products_operational_alignment.sql)

This catch-up script:

- adds `products.branch_id` as the branch-scoping column used by the frontend and RLS
- persists `products.reorder_level` instead of relying on the view-level hardcoded `10`
- restores `products.is_active` as a real operational flag instead of a compatibility constant
- rebuilds `product_catalog_view` and `inventory_catalog_view` so they continue reading from `public.products` only
- keeps `products.branch` and `products.branch_id` synchronized through a trigger for compatibility and safer inserts
- clears legacy `inventory_items` rows automatically when a `products` row is deleted, so product removal no longer depends on frontend cleanup order
- backfills `sale_items.inventory_item_id` from legacy `inventory_items` only when a matching legacy row still exists

Important:

- this script is additive and does not delete `products_legacy`, `inventory_items`, or `categories`
- fresh rebuilds should pick up the same alignment from the updated flatten script in [`apps/web/supabase/sql/08_flatten_products_schema.sql`](../../apps/web/supabase/sql/08_flatten_products_schema.sql)
- older deployed environments should run this catch-up script before deploying the frontend changes that write `branch_id` and `reorder_level`
- if the auth/RLS rollout is already live in an older environment, rerun [`apps/web/supabase/sql/09_auth_role_policies.sql`](../../apps/web/supabase/sql/09_auth_role_policies.sql) after this catch-up so product row policies become `branch_id`-first with branch-name fallback

## 14. Drop obsolete legacy tables after verification

Run after:

- the legacy category repair in step 12, if you still need it
- the product alignment catch-up in step 13, when applicable
- the role-aware policy script in step 9

Run:

- [`apps/web/supabase/sql/14_drop_obsolete_legacy_tables.sql`](../../apps/web/supabase/sql/14_drop_obsolete_legacy_tables.sql)

This final cleanup script:

- aligns `sale_items.product_id` and `sale_items.inventory_item_id` one last time before removing legacy foreign-key dependencies
- removes the legacy cleanup and backfill triggers that only existed to bridge `inventory_items`
- drops the obsolete tables:
  - `categories`
  - `inventory_items`
  - `products_legacy`
  - `sale_items_legacy`

Important:

- run step 12 before this if you still need to recover category labels from `products_legacy`
- after this step, `products`, `sales`, `sale_items`, `branches`, `profiles`, and the two compatibility views are the only frontend-relevant tables left in the active public schema
- [`apps/web/supabase/sql/09_auth_role_policies.sql`](../../apps/web/supabase/sql/09_auth_role_policies.sql) and [`apps/web/supabase/sql/11_legacy_table_policy_lockdown.sql`](../../apps/web/supabase/sql/11_legacy_table_policy_lockdown.sql) are now guarded so rerunning them after cleanup will not fail when the dropped tables are already gone

## 15. Align `branches` with the frontend branch-management contract

Run when the live contract test or branch-management flow reports that `public.branches.notes` is missing:

- [`apps/web/supabase/sql/15_align_branches_notes_column.sql`](../../apps/web/supabase/sql/15_align_branches_notes_column.sql)

This catch-up script:

- adds `public.branches.notes`

Important:

- the Users branch-management flow already reads and writes `notes`
- fresh rebuilds pick this up from the updated [`apps/web/supabase/sql/01_core_tables.sql`](../../apps/web/supabase/sql/01_core_tables.sql)
- older deployed environments should run this script before using the live Supabase contract test or the branch create flow

## 16. Add barcode support and clean product categories

Run when the active `products` table needs barcode readiness and usable category labels:

- [`apps/web/supabase/sql/16_products_barcode_category_quality.sql`](../../apps/web/supabase/sql/16_products_barcode_category_quality.sql)

This catch-up script:

- adds nullable `products.barcode`
- normalizes blank barcode values to `null`
- adds a barcode lookup index
- adds a per-branch partial unique index for nonblank barcodes when no duplicate nonblank barcodes already exist
- adds future-facing check constraints for barcode format and standard category labels
- backfills product categories from transparent product-name rules
- keeps `category` as controlled text instead of introducing a new categories table
- drops and rebuilds `product_catalog_view` and `inventory_catalog_view` so barcode is available to the frontend and column order is corrected safely
- restores authenticated `select` grants on the rebuilt compatibility views

Important:

- the owner-provided fixed workbook currently has a barcode column, but all barcode cells are blank, so the new column is intentionally nullable
- if duplicate nonblank barcodes are found within the same branch, the script skips the unique index and prints a notice instead of failing the whole migration
- records that do not match any category rule remain `Uncategorized` for manual review
- the script supports the current flattened `products` table even when `branch_id`, `reorder_level`, and `is_active` are not present; the rebuilt views provide compatible read fields

## 17. Optional demo/test product data completion

Run when you want the imported owner catalog to be test-ready for inventory review, barcode-ready UI, and POS flows:

- [`apps/web/supabase/sql/17_products_demo_data_completion.sql`](../../apps/web/supabase/sql/17_products_demo_data_completion.sql)

This script fills incomplete product records with deterministic demo values:

- blank barcode values become generated test barcodes like `TEST-STL-000215`
- blank or price-copied unit values become sensible units such as `370ml`, `11g`, `pack`, or `serving`
- zero or missing prices become sensible product/category demo prices
- zero stock values become category-specific demo quantities
- missing expiration dates become category-specific future demo dates
- weak or blank categories are resolved through the Step 16 category inference function

Important:

- these are inferred demo/testing values, not supplier-certified barcode or expiry data
- run this after Step 16 so the category inference function and barcode column exist
- the script preserves meaningful existing values and fills only blank, zero, or clearly weak catalog fields
- example: `ALASKA CLASSIC` is completed as a Dairy item with unit, stock, expiry date, and generated barcode so it can be tested properly in the inventory UI

## New backend shape

The frontend is now aligned to this structure:

- `branches`
- `products`
- `sales`
- `sale_items`
- `product_catalog_view`
- `inventory_catalog_view`

`products` is now the raw branch stock table again, and the two views act as compatibility read models for the current frontend.

The live operational fields are now:

- `branches.code`
- `branches.name`
- `branches.manager_name`
- `branches.contact_number`
- `branches.address`
- `branches.opening_date`
- `branches.notes`
- `branches.status`
- `products.branch_id`
- `products.branch`
- `products.barcode`
- `products.category`
- `products.product_name`
- `products.net_weight`
- `products.price`
- `products.stock_quantity`
- `products.reorder_level`
- `products.is_active`
- `products.expiration_date`

Compatibility notes:

- `inventory_catalog_view.inventory_item_id` is still emitted for the UI, but in the flattened model it mirrors `products.id`
- `product_catalog_view.category_id` and `inventory_catalog_view.category_id` remain compatibility placeholders, not live normalized category foreign keys
- before step 14, `inventory_items` and `categories` may still remain as migration leftovers
- after step 14, those legacy tables should be gone from the live project

## Legacy data caution

Some legacy rows still carry messy text values such as:

- `price = '4 FOR 100'`
- `stock_quantity = '114 PCS'`

The flattened schema keeps operational values in these columns:

- `products.branch_id`
- `products.branch`
- `products.price`
- `products.stock_quantity`
- `products.reorder_level`
- `products.is_active`
- `products.expiration_date`

## Recommended quick checks after running the scripts

1. Confirm that `products` now contains rows.
2. If you ran the auth rollout, confirm that `profiles` contains rows for your auth users.
3. Check these review queries in SQL Editor:

```sql
select count(*) from public.products;

select
  to_regclass('public.products_legacy') as products_legacy_table,
  to_regclass('public.sale_items_legacy') as sale_items_legacy_table,
  to_regclass('public.categories') as categories_table,
  to_regclass('public.inventory_items') as inventory_items_table;

select count(*)
from public.products
where lower(btrim(category)) = 'uncategorized';

select *
from public.products
where price is null
limit 20;

select *
from public.products
where stock_quantity < 0
limit 20;

select *
from public.products
where branch_id is null
limit 20;

select *
from public.products
where reorder_level < 0;

select branch, barcode, count(*)
from public.products
where barcode is not null
group by branch, barcode
having count(*) > 1;

select category, count(*)
from public.products
group by category
order by count(*) desc, category;
```

Important:

- before step 14, the `to_regclass(...)` query will show the legacy tables when they still exist
- after step 14, all four values should come back `null`
- the remaining review queries help you spot rows that still need manual cleanup later

If you ran the auth rollout too, add:

```sql
select auth_user.email, profile.*
from public.profiles as profile
left join auth.users as auth_user
  on auth_user.id = profile.id
order by profile.created_at desc;
```

