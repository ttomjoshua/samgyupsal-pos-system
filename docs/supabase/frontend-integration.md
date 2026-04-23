# Supabase Frontend Integration

This frontend now treats `public.products` as the branch-scoped inventory source of truth, with compatibility views layered on top for read-heavy screens.

The current operational contract expects branch scope, stock settings, and product visibility to live on `public.products` itself instead of being split across normalized legacy tables.

Important:

- when `VITE_SUPABASE_AUTH_ENABLED=false`, the stabilized frontend now stays on the local/demo data path instead of using anonymous Supabase table access
- once real auth is enabled, apply the role-aware policy script in [`sql-run-order.md`](./sql-run-order.md) so the browser no longer depends on the bootstrap policy set

## What is already wired

- branch-scoped POS product loading via [`apps/web/src/features/products/services/productService.js`](../../apps/web/src/features/products/services/productService.js)
- branch-scoped inventory reads and writes via [`apps/web/src/features/inventory/services/inventoryService.js`](../../apps/web/src/features/inventory/services/inventoryService.js)
- sales and sale items via [`apps/web/src/features/pos/services/salesService.js`](../../apps/web/src/features/pos/services/salesService.js)
- report snapshot via [`apps/web/src/features/reports/services/reportService.js`](../../apps/web/src/features/reports/services/reportService.js)

## What is partially migrated now

- branch directory management now reads and writes through Supabase first
- login/auth session flow is ready for Supabase Auth rollout
- employee directory management in the Users page now reads real Supabase `profiles`
- secure employee account creation is wired through a Supabase Edge Function

Important:

- do not put the Supabase `service_role` key in this frontend
- the browser only invokes the trusted Edge Function; it never receives the `service_role` key

## Required frontend env vars

Copy [`apps/web/.env.example`](../../apps/web/.env.example) into `.env` and fill in:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Optional live contract-test env vars:

- `SUPABASE_TEST_EMAILS`
- `SUPABASE_TEST_PASSWORD`

## Table and view names currently expected by the frontend

- `VITE_SUPABASE_PRODUCTS_TABLE`
- `VITE_SUPABASE_SALES_TABLE`
- `VITE_SUPABASE_SALE_ITEMS_TABLE`
- `VITE_SUPABASE_BRANCHES_TABLE`
- `VITE_SUPABASE_PROFILES_TABLE`
- `VITE_SUPABASE_ADMIN_CREATE_USER_FUNCTION`
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
- `branch_id`
- `branch`
- `category`
- `product_name`
- `net_weight`
- `price`
- `stock_quantity`
- `reorder_level`
- `is_active`
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

### `branches`

- `id`
- `code`
- `name`
- `manager_name`
- `contact_number`
- `address`
- `opening_date`
- `notes`
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

Important:

- `sale_items.inventory_item_id` is now a legacy compatibility column
- the active checkout flow now writes both `product_id` and `inventory_item_id` using the same product-backed identifier emitted by `inventory_catalog_view`

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

Important:

- `category_id` is still exposed for compatibility, but the flattened `products` table no longer uses a live normalized category foreign key

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
- `inventory_catalog_view.inventory_item_id` mirrors `products.id` in the flattened model
- `category_id` remains a compatibility placeholder in the flattened model
- `categories` and `inventory_items` are legacy migration artifacts, not active frontend read/write tables
- after the final cleanup script runs, those legacy tables should no longer exist in the live project
- both views should remain `security_invoker = true` so authenticated requests still obey the underlying table RLS policies

## Safe rollout order

1. Run the SQL files from [`sql-run-order.md`](./sql-run-order.md)
2. Reload the frontend so the new env values take effect
3. Verify:
   - `Products`
   - `POS`
   - `Inventory`
   - `Reports`
4. Run the auth SQL rollout files from [`sql-run-order.md`](./sql-run-order.md) when ready
5. Deploy the `admin-create-user` Edge Function
6. Manually create and seed only the first admin user
7. After that, create employee accounts from the Users page

## Live contract test

To verify that Supabase is still returning every field the frontend depends on, run:

```bash
npm run test:supabase:web
```

This authenticated contract check verifies the current live shape for:

- `products`
- `product_catalog_view`
- `inventory_catalog_view`
- `sales`
- `sale_items`
- `branches`
- `profiles`

It also checks cross-source invariants such as:

- `inventory_catalog_view.inventory_item_id = product_id`
- product/view field alignment across `products`, `product_catalog_view`, and `inventory_catalog_view`
- sale-item alignment where product-backed rows keep `inventory_item_id = product_id`
- branch references staying visible through the `branches` table

## Important current assumption

The frontend is now branch-aware for POS and Inventory reads. Admin users without a fixed branch still default to a selected branch in the UI when working with branch-specific stock data.

## Current auth rollout behavior

When `VITE_SUPABASE_AUTH_ENABLED=true` and Supabase is configured:

- the login screen expects `email/password`
- the frontend restores the browser session from Supabase
- the route guards rely on the authenticated `profiles` row
- users without a valid `profiles` row will not be allowed through the app

The Users page now reads and updates real Supabase `profiles`, and new employee Auth users can be created through the secured `admin-create-user` Edge Function after it is deployed. The one remaining manual bootstrap step is creating the first admin account.

The auth-enabled frontend also expects the authenticated session-lock RPCs from [`apps/web/supabase/sql/10_auth_session_locking.sql`](../../apps/web/supabase/sql/10_auth_session_locking.sql). When that script is applied:

- a second device is blocked from signing into the same employee account
- the active device keeps the lock until logout or the 5-minute stale timeout expires
- logout releases only the current browser session instead of ending every device session

