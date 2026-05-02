# FEFO Inventory Technical Audit

This audit is based only on the files currently available in this repository. It does not assume live Supabase database state because no live database query was performed.

Inspected areas:

- `apps/web/src`
- `apps/web/supabase/sql`
- `apps/web/supabase/functions`
- `docs`
- `README.md`

## 1. Current FEFO Feature Implementation Status

| Feature | Status | Evidence from Codebase | Notes / Missing Parts |
| --- | --- | --- | --- |
| Product catalog | Implemented | `apps/web/src/features/products/services/productService.js` uses `getProductCatalog()` and `product_catalog_view`; `apps/web/src/features/products/pages/ProductsPage.jsx`; `apps/web/supabase/sql/16_products_barcode_category_quality.sql` creates `product_catalog_view`. | Catalog exists, but product identity and stock are still mixed in `products`. |
| Inventory batch table | Not yet implemented | No references found for `inventory_batches`. `docs/supabase/sql-run-order.md` says active frontend-relevant tables are `products`, `sales`, `sale_items`, `branches`, `profiles`, plus views. | No batch table, batch quantity, or batch expiration structure. |
| Barcode scan/search | Partial | `products.barcode` is added in `16_products_barcode_category_quality.sql`; `InventoryPage.jsx` has "Scan or enter barcode"; `PosPage.jsx` and `ProductsPage.jsx` include barcode in search. | Barcode field/search exists. No dedicated scanner workflow or batch barcode behavior. |
| Stock-in with expiration date | Partial | `InventoryPage.jsx` product form includes `expiry_date`; `inventoryService.buildSupabaseProductPayload()` writes `expiration_date`; `updateInventoryStock()` updates only `products.stock_quantity`. | Expiration is product-level. Stock-in modal accepts quantity only, not a new batch expiration date. |
| FEFO deduction during checkout | Not yet implemented | `apps/web/supabase/sql/19_transactional_checkout_rpc.sql` deducts from `products.stock_quantity`; no `ORDER BY expiration_date ASC`; no batch tables. | Checkout deducts aggregate product stock, not earliest-expiring batch stock. |
| Near-expiry alerts | Partial | `inventoryService.js` has `NEAR_EXPIRY_DAYS = 30`, `isNearExpiry()`, `getInventoryStatus()`; `InventoryTable.jsx` shows status badges; `inventoryFilters.js` has expiry-date filter/sort. | UI-derived status only. Not stored in database and not batch-level. |
| Sales velocity computation | Not yet implemented | `reportService.js` computes totals, top items, cashier performance, and low stock only. | No average daily sales or velocity formula found. |
| Predictive stockout alerts | Not yet implemented | No stockout formula or alert-generation logic found. | Missing average daily sales, days before stockout, estimated stockout date, and alert persistence. |
| Multi-branch filtering | Partial | `PosPage.jsx`, `InventoryPage.jsx`, `SalesHistoryPanel.jsx`, `productService.getProducts({ branchId })`, and `inventoryFilters.filterInventoryItemsByBranch()`. | POS, inventory, and sales history are branch-aware. Admin Reports page currently exposes date filters only. |
| Role-based access | Implemented | `shared/utils/permissions.js`, `ProtectedRoute.jsx`, `AppRouter.jsx`, `04_auth_profiles_rollout.sql`, `09_auth_role_policies.sql`, `18_auth_inventory_hardening.sql`, `admin-create-user/index.ts`. | Roles are `admin` and `employee`. `cashier` is treated as an employee alias in frontend normalization. |

## 2. Actual Supabase Database Schema

| Table Name | Exists / Referenced? | Purpose | Important Columns | Related Files |
| --- | --- | --- | --- | --- |
| `inventory_batches` | Not referenced | Intended FEFO batch table, but absent. | None found. | No matches in `apps`, `docs`, or `README.md`. |
| `inventory_movements` | Not referenced | Intended movement/audit table, but absent. | None found. | No matches found. |
| `sale_item_batch_allocations` | Not referenced | Intended sale-to-batch allocation table, but absent. | None found. | No matches found. |
| `inventory_items` | Legacy only | Older inventory structure. Not active after cleanup. | `branch_id`, `product_id`, `stock_quantity`, `expiration_date`. | Created in `01_core_tables.sql`, dropped in `14_drop_obsolete_legacy_tables.sql`. |
| `branches` | Defined and used | Branch records and branch assignment. | `id`, `code`, `name`, `manager_name`, `contact_number`, `address`, `opening_date`, `notes`, `status`. | `01_core_tables.sql`, `branchService.js`, `userService.js`. |
| `products` | Defined and used | Current product catalog plus inventory stock source. | `id`, `branch_id`, `branch`, `barcode`, `category`, `product_name`, `net_weight`, `price`, `stock_quantity`, `reorder_level`, `is_active`, `expiration_date`. | `08_flatten_products_schema.sql`, `13_products_operational_alignment.sql`, `16_products_barcode_category_quality.sql`, `inventoryService.js`, `productService.js`. |
| `profiles` | Defined and used | App profile and role record linked to Supabase Auth. | `id`, `username`, `full_name`, `role_key`, `branch_id`, `status`. | `04_auth_profiles_rollout.sql`, `profileService.js`, `authService.js`. |
| `sales` | Defined and used | Sale header per checkout. | `id`, `cashier_id`, `cashier_name`, `branch_id`, `branch_name`, `payment_method`, totals, `submitted_at`. | `01_core_tables.sql`, `salesService.js`, `19_transactional_checkout_rpc.sql`. |
| `sale_items` | Defined and used | Sale line items. | `id`, `sale_id`, `product_id`, `inventory_item_id`, `item_name`, `quantity`, `unit_price`, `line_total`. | `01_core_tables.sql`, `salesService.js`, `19_transactional_checkout_rpc.sql`. |

Schema answers:

- Proper batch-based inventory structure: No.
- `products` still stores `stock_quantity` and `expiration_date` directly: Yes.
- Product identity and physical inventory batches are separated properly: No.
- Foreign keys present: `profiles.branch_id -> branches`, `products.branch_id -> branches`, `sales.branch_id -> branches`, `sale_items.sale_id -> sales`, `sale_items.product_id -> products`.
- No foreign key to `inventory_batches` exists.
- Schema files exist in `apps/web/supabase/sql/*.sql`.
- There is no conventional `supabase/migrations` folder in this repository.

## 3. Actual FEFO Checkout Behavior

Current behavior matches Option C: FEFO deduction is not yet implemented.

What exists:

- `PaymentPanel.jsx` builds the checkout payload and calls `createSale()`.
- `salesService.js` calls Supabase RPC `create_checkout_sale`.
- `19_transactional_checkout_rpc.sql` validates cashier, branch, totals, stock, inserts `sales`, inserts `sale_items`, and deducts `products.stock_quantity`.

FEFO-specific findings:

- No `ORDER BY expiration_date ASC` in checkout logic.
- SQL orders by `product.id` only for deterministic row locking.
- Deduction is aggregate: `products.stock_quantity = products.stock_quantity - sold_quantity`.
- No batch selection UI.
- No multi-batch deduction because there are no batches.
- No sale-to-batch record. `sale_items.inventory_item_id` is compatibility data and currently mirrors product identity, not batch identity.

Missing for full FEFO:

- `inventory_batches` table.
- Batch stock-in with received date, expiration date, and quantity on hand.
- Checkout RPC allocation ordered by earliest expiration.
- Allocation across multiple batches.
- `sale_item_batch_allocations`.
- `inventory_movements` audit trail.
- Batch-aware RLS, UI, tests, and reports.

## 4. Predictive Alert Logic

Current status: Not implemented.

Findings:

- No formula for average daily sales.
- No estimated days before stockout.
- No estimated stockout date.
- No predictive stockout alert generation.
- Reports use `sales` and `sale_items` through `salesService.getSalesRecords()`.
- `reportService.js` computes total sales, transactions, items sold, top items, low-stock rows, and cashier performance.
- Default report date range is 14 days from `shared/utils/reporting.js`, but that range is not used for velocity prediction.
- Near-expiry logic exists only as UI-derived inventory status from `products.expiration_date`.
- Alerts are not stored in the database. They are computed and displayed in UI components.

## 5. User Roles and Access Control

| Role | Exists in Codebase? | Permissions / Access | Related Files |
| --- | --- | --- | --- |
| Admin / Owner | Yes, as `admin` | Dashboard, POS, Inventory, Reports, Products, Users; product/category management; branch/user management. | `permissions.js`, `AppRouter.jsx`, `ProtectedRoute.jsx`, SQL RLS files. |
| Cashier / Staff | Yes, as `employee`; `cashier` is frontend alias | Dashboard, POS, Inventory; employee branch scope; stock quantity adjustments. | `permissions.js`, `authService.js`, `profileService.js`, `09_auth_role_policies.sql`. |
| Manager | No | Not a role. `branches.manager_name` is only branch metadata. | `branches` table/service only. |
| Branch Manager | No | No separate role or route permissions. | Not found. |
| Inventory Staff | No | No separate role. Inventory access is admin/employee only. | Not found. |

Access control is a combination of:

- Frontend role routing: `ProtectedRoute.jsx`, `AppRouter.jsx`.
- Frontend permission helpers: `permissions.js`.
- Supabase RLS: `04_auth_profiles_rollout.sql`, `09_auth_role_policies.sql`.
- Database trigger hardening: `18_auth_inventory_hardening.sql`.
- Edge Function admin check: `admin-create-user/index.ts`.

Security notes:

- Sample seed emails exist in `05_auth_profile_seed_template.sql`, but no passwords are committed there.
- Local fallback mode can store locally created account passwords in localStorage through `userService.js` and `storage.js`.
- Production should keep Supabase Auth enabled.
- Role model is intentionally simple: only `admin` and `employee`.

## 6. Branch Setup and Multi-Branch Logic

- Multiple branches are supported.
- Seed/current branch names in code and SQL: `Sta. Lucia` and `Dollar`.
- Branches are stored in `branches`.
- `profiles.branch_id` assigns employees to branches.
- `products.branch_id` and `products.branch` connect inventory/catalog rows to branches.
- `sales.branch_id` and `sales.branch_name` connect checkouts to branches.
- `sale_items` does not store branch directly; branch is inherited through `sales`.
- POS loads products with `getProducts({ branchId })`.
- Inventory filters by branch for admins and scopes employees to their branch.
- Sales history supports admin branch filtering.
- Reports service accepts `branchId`, but the admin Reports page currently does not expose a branch selector.

Documentation can accurately say multi-branch and can mention the current seeded branches `Sta. Lucia` and `Dollar`. It should not imply those are the only possible branches because `createBranch()` supports adding more.

## 7. Diagrams and Chapter 3 Readiness

| Diagram | Ready? | Required Basis from System | Notes |
| --- | --- | --- | --- |
| System Architecture Diagram | Ready | React/Vite SPA, Vercel static hosting, Supabase Auth, PostgREST, PostgreSQL, RLS, RPC, Edge Function, localStorage fallback. | Existing deployment/network diagrams are close. Include `create_checkout_sale` and `admin-create-user`. |
| Use Case Diagram | Ready | Actors: Admin, Employee/Cashier. Use cases: login, POS checkout, sales history, inventory stock update, product management, reports, branch/user management. | Do not include FEFO/predictive as completed use cases. |
| Context Diagram | Ready | Users interact with web app; app uses Supabase Auth/DB/RPC/Edge Function. | Good for Chapter 3. |
| Data Flow Diagram | Ready for current system | Login, load catalog, checkout, inventory update, reports, user creation. | FEFO/batch allocation flow is not ready. |
| Entity Relationship Diagram | Partial | Current tables: `branches`, `profiles`, `products`, `sales`, `sale_items`. | Existing `docs/mermaid/erd_diagram.mmd` needs updates for current product columns and no batch entities. |
| Functional Decomposition Diagram | Ready | Modules: Auth, Dashboard, POS, Inventory, Products, Reports, Users/Branches, Supabase services. | Mark predictive/FEFO as future module. |
| Incremental Development Model | Ready | SQL rollout and modules show phases: base schema, auth, branch/product inventory, checkout RPC, hardening, future FEFO/predictive. | Use as development process diagram, not proof FEFO is complete. |

## 8. Final Technical Assessment

### A. What Is Already Implemented

- React POS/inventory/reporting app.
- Supabase client configuration.
- Product catalog via `product_catalog_view`.
- Inventory view via `inventory_catalog_view`.
- Branch table and branch-aware POS/inventory/sales history.
- Admin/employee role model.
- Protected routes.
- Supabase Auth profile lookup.
- Admin employee creation through Edge Function.
- Transactional checkout RPC.
- Aggregate product stock deduction.
- Sales and sale item recording.
- Low-stock reports and dashboard summaries.
- Product-level expiration status/filtering.

### B. What Is Partially Implemented

- Barcode support: field/search exists, scanner workflow does not.
- Expiration tracking: product-level only, not batch-level.
- Near-expiry alerts: computed UI status only.
- Multi-branch reporting: service support exists, but admin Reports page lacks branch filter.
- Documentation diagrams: enough basis exists, but ERD should be updated to current flattened schema.

### C. What Is Not Yet Implemented

- `inventory_batches`.
- `inventory_movements`.
- `sale_item_batch_allocations`.
- FEFO batch deduction.
- Batch-level stock-in.
- Batch-level expiry alerts.
- Sales velocity calculation.
- Predictive stockout alerts.
- Stored alert records.
- Separate Manager, Branch Manager, or Inventory Staff roles.

### D. Main Technical Risks

- `products` still mixes catalog identity, branch stock, and expiration.
- No batch-level stock source.
- No sale-to-batch allocation audit trail.
- FEFO is not enforceable with the current schema.
- Predictive alert title is not supported by current logic.
- `sale_items.inventory_item_id` is compatibility data, not a true inventory batch reference.
- Local fallback mode stores account password data in localStorage.
- Existing ERD/docs can become misleading if they imply FEFO or predictive alerts are complete.

### E. Recommended Next Development Steps

1. Add FEFO schema: `inventory_batches`, `inventory_movements`, `sale_item_batch_allocations`.
2. Separate product catalog identity from physical stock batches.
3. Change Stock In so each stock-in creates a batch with expiration date.
4. Rewrite checkout RPC to allocate from earliest-expiring available batches.
5. Record batch allocations per sale item.
6. Add predictive sales velocity from `sale_items` over a selected period, preferably 30 days.
7. Generate stockout estimates and alert rows or computed alert views.
8. Update RLS policies, UI, tests, and ERD/DFD after schema changes.

### F. Suggested Title Alignment

Current proposed title:

> A Web-Based Cloud-Integrated Multi-Branch Retail Monitoring Platform with FEFO-Based Predictive Inventory Alerts

Assessment: too advanced for the current implementation.

Supported today:

- Web-based: yes.
- Cloud-integrated with Supabase/Vercel: yes.
- Multi-branch: partially to mostly yes.
- Retail/POS monitoring: yes.
- FEFO-based: no.
- Predictive inventory alerts: no.

To fully support the title, complete batch-based FEFO deduction, sale-to-batch allocation records, sales velocity computation, and predictive stockout/expiry alerting first.
