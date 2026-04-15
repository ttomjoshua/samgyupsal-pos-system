# Supabase Frontend Integration

This frontend now treats `public.products` as the branch-scoped inventory source of truth, with compatibility views layered on top for read-heavy screens.

## What is already wired

- branch-scoped POS product loading via [`src/services/productService.js`](./src/services/productService.js)
- branch-scoped inventory reads and writes via [`src/services/inventoryService.js`](./src/services/inventoryService.js)
- sales and sale items via [`src/services/salesService.js`](./src/services/salesService.js)
- report snapshot via [`src/services/reportService.js`](./src/services/reportService.js)

## What is partially migrated now

- branch directory management now reads and writes through Supabase first
- login/auth session flow is ready for Supabase Auth rollout
- employee directory management in the Users page now reads real Supabase `profiles`

Important:

- secure Supabase auth-user creation still requires a trusted backend, Edge Function, or manual Dashboard setup
- do not put the Supabase `service_role` key in this frontend
- creating new Auth users is still not handled from the browser

## Required frontend env vars

Copy [`.env.example`](./.env.example) into `.env` and fill in:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Table and view names currently expected by the frontend

- `VITE_SUPABASE_CATEGORIES_TABLE`
- `VITE_SUPABASE_PRODUCTS_TABLE`
- `VITE_SUPABASE_INVENTORY_TABLE`
- `VITE_SUPABASE_SALES_TABLE`
- `VITE_SUPABASE_SALE_ITEMS_TABLE`
- `VITE_SUPABASE_BRANCHES_TABLE`
- `VITE_SUPABASE_PROFILES_TABLE`
- `VITE_SUPABASE_PRODUCTS_VIEW`
- `VITE_SUPABASE_INVENTORY_VIEW`
- `VITE_SUPABASE_AUTH_ENABLED`

## Runtime behavior

- `VITE_SUPABASE_DEFAULT_BRANCH_ID`
- `VITE_SUPABASE_SYNC_INVENTORY_ON_SALE`

Use `false` for `VITE_SUPABASE_SYNC_INVENTORY_ON_SALE` only if the backend team plans to deduct stock through SQL triggers, RPC, or an Edge Function.

## Current schema contract expected by the frontend

### `products`

- `id`
- `branch`
- `category`
- `product_name`
- `net_weight`
- `price`
- `stock_quantity`
- `expiration_date`

### `sales`

- `id`
- `cashier_id`
- `cashier_name`
- `branch_id`
- `branch_name`
- `payment_method`
- `subtotal`
- `discount`
- `total_amount`
- `cash_received`
- `change_amount`
- `notes`
- `submitted_at`

### `profiles`

- `id`
- `username`
- `full_name`
- `role_key`
- `branch_id`
- `status`
- `created_at`
- `updated_at`

### `sale_items`

- `id`
- `sale_id`
- `product_id`
- `inventory_item_id`
- `item_name`
- `quantity`
- `unit_price`
- `line_total`

### `product_catalog_view`

Read model used by the admin Products page:

- `product_id`
- `branch`
- `branch_code`
- `branch_name`
- `category_id`
- `category_name`
- `product_name`
- `unit_label`
- `default_price`
- `is_active`

### `inventory_catalog_view`

Read model used by POS and Inventory:

- `inventory_item_id`
- `branch_id`
- `branch_code`
- `branch_name`
- `product_id`
- `product_branch`
- `category_id`
- `category_name`
- `product_name`
- `unit_label`
- `price`
- `default_price`
- `selling_price`
- `stock_quantity`
- `reorder_level`
- `expiration_date`
- `legacy_stock_text`
- `is_active`

Important:

- `product_catalog_view` and `inventory_catalog_view` are compatibility read models built from `public.products`
- `categories` and `inventory_items` may still exist in older projects, but the frontend write path now saves directly to `public.products`

## Safe rollout order

1. Run the SQL files from [`supabase/README.md`](./supabase/README.md)
2. Reload the frontend so the new env values take effect
3. Verify:
   - `Products`
   - `POS`
   - `Inventory`
   - `Reports`
4. Run the auth SQL rollout files from [`supabase/README.md`](./supabase/README.md) when ready
5. Manually create the first Supabase Auth users
6. Seed their `profiles` rows with roles and branch assignments
7. Only after that, stop depending on local employee-login placeholders

## Important current assumption

The frontend is now branch-aware for POS and Inventory reads. Admin users without a fixed branch still default to a selected branch in the UI when working with branch-specific stock data.

## Current auth rollout behavior

When `VITE_SUPABASE_AUTH_ENABLED=true` and Supabase is configured:

- the login screen expects `email/password`
- the frontend restores the browser session from Supabase
- the route guards rely on the authenticated `profiles` row
- users without a valid `profiles` row will not be allowed through the app

The Users page now reads and updates real Supabase `profiles` for employee role, branch assignment, username, and status. Until the secure admin-create-user path is implemented, new Auth users still need to be created in Supabase Dashboard or a protected backend path first.
