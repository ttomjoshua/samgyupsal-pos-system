# Supabase SQL Editor Run Order

Run these files in order inside the Supabase SQL Editor.

## 1. Rebuild the base schema and preserve legacy data

Run:

- [`frontend/supabase/sql/01_core_tables.sql`](../../frontend/supabase/sql/01_core_tables.sql)

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

## 2. Flatten `products` into the branch-stock table used by the app

Run:

- [`frontend/supabase/sql/08_flatten_products_schema.sql`](../../frontend/supabase/sql/08_flatten_products_schema.sql)

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

- [`frontend/supabase/sql/02_dev_demo_policies.sql`](../../frontend/supabase/sql/02_dev_demo_policies.sql)

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

- [`frontend/supabase/generate_owner_inventory_sql.ps1`](../../frontend/supabase/generate_owner_inventory_sql.ps1)
- [`frontend/supabase/sql/07_replace_inventory_with_owner_csv.sql`](../../frontend/supabase/sql/07_replace_inventory_with_owner_csv.sql)

Workflow:

1. Regenerate the SQL file if the owner sends updated CSVs:

```powershell
./generate_owner_inventory_sql.ps1
```

2. Run [`frontend/supabase/sql/07_replace_inventory_with_owner_csv.sql`](../../frontend/supabase/sql/07_replace_inventory_with_owner_csv.sql) in the Supabase SQL Editor.

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

Run only when the backend/auth team is ready:

- [`frontend/supabase/sql/03_optional_profiles_table.sql`](../../frontend/supabase/sql/03_optional_profiles_table.sql)

This prepares a `profiles` table linked to `auth.users`.

## 6. Real auth profile trigger and RLS rollout

Run when you are ready to switch the frontend login to Supabase Auth:

- [`frontend/supabase/sql/04_auth_profiles_rollout.sql`](../../frontend/supabase/sql/04_auth_profiles_rollout.sql)

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

- [`frontend/supabase/sql/05_auth_profile_seed_template.sql`](../../frontend/supabase/sql/05_auth_profile_seed_template.sql)

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

- [`frontend/supabase/sql/09_auth_role_policies.sql`](../../frontend/supabase/sql/09_auth_role_policies.sql)

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

- [`frontend/supabase/sql/10_auth_session_locking.sql`](../../frontend/supabase/sql/10_auth_session_locking.sql)

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

- [`frontend/supabase/sql/11_legacy_table_policy_lockdown.sql`](../../frontend/supabase/sql/11_legacy_table_policy_lockdown.sql)

This script:

- revokes remaining `anon` and `authenticated` table grants from `products_legacy` and `sale_items_legacy`
- enables RLS on both legacy tables as a defense-in-depth fallback
- removes the leftover demo-era legacy policies that would otherwise keep showing up in security review

Important:

- this step is recommended if the project went through the legacy-table rename path and those tables still exist
- it is safe to skip only when those legacy tables are already gone

## 11. Deploy the secure admin-create-user Edge Function

The repo now includes:

- [`frontend/supabase/functions/admin-create-user/index.ts`](../../frontend/supabase/functions/admin-create-user/index.ts)

This is the trusted server-side path that lets an authenticated admin create employee Auth users without exposing the `service_role` key in the browser.

What it does:

- validates the caller JWT on the server
- confirms the caller is an active admin from `public.profiles`
- creates the Auth user with `auth.admin.createUser`
- upserts the matching `public.profiles` row with username, branch, role, and status

After deploying it:

- admins can create employee login accounts directly from the Users page
- the login page no longer depends on a frontend-only employee placeholder flow

## New backend shape

The frontend is now aligned to this structure:

- `branches`
- `products`
- `sales`
- `sale_items`
- `product_catalog_view`
- `inventory_catalog_view`

`products` is now the raw branch stock table again, and the two views act as compatibility read models for the current frontend.

## Legacy data caution

Some legacy rows still carry messy text values such as:

- `price = '4 FOR 100'`
- `stock_quantity = '114 PCS'`

The flattened schema keeps operational values in these columns:

- `products.branch`
- `products.price`
- `products.stock_quantity`
- `products.expiration_date`

## Recommended quick checks after running the scripts

1. Confirm that `products_legacy` still exists.
2. Confirm that `products` now contains rows.
3. If you ran the auth rollout, confirm that `profiles` contains rows for your auth users.
4. Check these review queries in SQL Editor:

```sql
select count(*) from public.products_legacy;
select count(*) from public.products;

select *
from public.products
where price is null
limit 20;

select *
from public.products
where stock_quantity < 0
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
