# Samgyupsal POS System Technical Rundown

This document explains how the current Samgyupsal POS System works based on the actual codebase. It is written for Capstone documentation and for a beginner programmer who wants to understand the system step by step.

Inspected implementation areas:

- `apps/web/src/app`
- `apps/web/src/features`
- `apps/web/src/shared`
- `apps/web/supabase/sql`
- `apps/web/supabase/functions/admin-create-user`

## 1. System Architecture Overview

### Technology Stack

The project is a web-based point-of-sale and inventory system.

The main technologies are:

| Layer | Technology | Purpose |
| --- | --- | --- |
| Frontend | React 19 | Builds the user interface using components. |
| Build tool | Vite | Runs and bundles the frontend application. |
| Routing | React Router | Controls which page appears for each URL. |
| Backend/data platform | Supabase | Provides authentication, database access, row-level security, Edge Functions, and RPC functions. |
| Database | PostgreSQL through Supabase | Stores real business data such as products, sales, sale items, branches, and profiles. |
| Deployment | Vercel | Hosts the production frontend application. |

The main frontend application lives in `apps/web/src`.

### Frontend, Backend, and Database in Simple Terms

In this project, the **frontend** is the React application that users see in the browser. It contains pages such as Login, Dashboard, POS, Inventory, Products, Reports, and Users.

The **backend** is mostly Supabase. There is no separate Express, Laravel, Django, or custom REST API server in the repository. Instead, the browser uses the Supabase JavaScript client to call:

- Supabase Auth for login/logout/session handling.
- Supabase Database tables and views for reading and writing data.
- Supabase RPC functions for server-side database logic.
- A Supabase Edge Function for admin-only employee account creation.

The **database** is Supabase PostgreSQL. It stores the permanent records that the system depends on, including:

- Branches
- Products and inventory stock
- Sales
- Sale line items
- User profiles and roles
- Active session locks

### Overall Architecture

At a high level, the application works like this:

1. The user opens the React app in the browser.
2. React Router decides which page to show.
3. Protected pages check the logged-in user and role.
4. Pages call service files such as `salesService.js`, `inventoryService.js`, or `profileService.js`.
5. Services call Supabase through the shared client in `apps/web/src/shared/supabase/client.js`.
6. Supabase checks authentication and row-level security policies.
7. Supabase returns data to the service.
8. The page updates its UI using React state.

The important idea is: pages do not talk to the database directly. They call service functions, and service functions handle the Supabase calls.

### Main Project Organization

The frontend is organized by feature:

```text
apps/web/src
  app
    layout
    providers
    router
    styles
  features
    auth
    branches
    dashboard
    inventory
    pos
    products
    reports
    users
  shared
    components
    hooks
    styles
    supabase
    utils
```

This structure separates the app into understandable parts:

- `app` contains the shell of the application, routing, layout, and auth provider.
- `features` contains business modules such as POS, Inventory, Reports, and Users.
- `shared` contains reusable UI components, utilities, validation, permissions, storage helpers, and the Supabase client.

### Supabase Role in the Project

Supabase provides four major backend responsibilities:

1. **Authentication**
   Users sign in with Supabase Auth using email and password.

2. **Database**
   Business records are stored in PostgreSQL tables such as `products`, `sales`, `sale_items`, `branches`, and `profiles`.

3. **Security**
   SQL files define row-level security policies. These policies decide what admin and employee accounts are allowed to read or change.

4. **Server-side operations**
   The checkout flow uses a Supabase RPC function called `create_checkout_sale`. This records a sale and deducts inventory inside one database transaction.

There is also an Edge Function called `admin-create-user`. It securely creates employee Auth accounts because creating Supabase Auth users requires a service-role key that must never be placed in browser code.

## 2. Core Functionalities

### Login and Authentication

Users sign in from `apps/web/src/features/auth/pages/LoginPage.jsx`.

The login logic is handled by:

- `apps/web/src/features/auth/services/authService.js`
- `apps/web/src/app/providers/AuthProvider.jsx`
- `apps/web/src/features/auth/services/sessionLockService.js`

What the user can do:

- Sign in with email and password when Supabase Auth is enabled.
- Stay signed in through Supabase session persistence.
- Log out.
- Be automatically logged out after inactivity.
- Be blocked if the same account is already active in another non-stale session.

Database/data touched:

- Supabase Auth user session
- `profiles`
- `private.active_session_locks` through session lock RPCs

Why it matters:

Authentication controls who can use the system. The profile table then tells the app whether the user is an admin or employee and which branch they belong to.

### Role-Based Access

Role permissions are defined in `apps/web/src/shared/utils/permissions.js`.

Current roles:

- `admin`
- `employee`

Admin users can access:

- Dashboard
- POS
- Inventory
- Reports
- Products
- Users

Employee users can access:

- Dashboard
- POS
- Inventory

Employees cannot access the Reports, Products, or Users pages through the frontend router. Supabase row-level security also limits what employees can read or write in the database.

### Dashboard

The Dashboard page lives at:

- `apps/web/src/features/dashboard/pages/DashboardPage.jsx`

What the user can do:

- Admins can see an operations snapshot across branches, employees, inventory, low-stock items, and sales.
- Employees can see today's sales and assigned-branch inventory information.

Services/data used:

- `getBranches()`
- `getInventoryItems()`
- `getProfilesDirectory()` for admins
- `getReportSnapshot()`

Tables/data touched:

- `branches`
- `products` through `inventory_catalog_view`
- `profiles`
- `sales`
- `sale_items`

Why it matters:

The Dashboard gives a quick summary of business health without forcing the user to open every module.

### POS Sales Workspace

The POS page lives at:

- `apps/web/src/features/pos/pages/PosPage.jsx`

Important child components:

- `ProductGrid.jsx`
- `CartTable.jsx`
- `PaymentPanel.jsx`
- `SalesHistoryPanel.jsx`
- `SalesHistoryDetailsModal.jsx`
- `ReceiptPreview.jsx`

What the user can do:

- Select an active branch.
- Search products.
- Filter products by category.
- Add products to a cart.
- Increase or decrease cart quantities.
- Apply a discount.
- Add checkout service fees.
- Enter cash received.
- Complete checkout.
- Hold and restore one pending order.
- View the last receipt preview.
- View sales history.

Tables/data touched:

- Reads products from `inventory_catalog_view`
- Writes sales to `sales`
- Writes sale lines to `sale_items`
- Updates stock in `products`

Why it matters:

This is the main sales workflow. It connects the product catalog, cart calculation, payment validation, sales history, and inventory deduction.

### Transactional Checkout

Checkout is handled by:

- `PaymentPanel.jsx`
- `salesService.js`
- Supabase RPC: `public.create_checkout_sale`
- SQL file: `apps/web/supabase/sql/19_transactional_checkout_rpc.sql`

The most important production detail is that the final checkout is not just a browser-side insert. The app calls a database RPC that:

1. Checks the authenticated cashier.
2. Checks that the account is active.
3. Checks the branch.
4. Validates line items and totals.
5. Locks product rows.
6. Verifies stock availability.
7. Deducts inventory.
8. Inserts the sale.
9. Inserts sale line items.
10. Returns the saved sale and item data.

Why it matters:

This prevents a common POS problem where a sale is saved but inventory fails to update, or inventory updates but the sale fails to save. The RPC keeps checkout as one database transaction.

### Sales History

Sales history is shown inside the POS module through:

- `apps/web/src/features/pos/components/SalesHistoryPanel.jsx`

What the user can do:

- View completed sales.
- Filter by transaction number.
- Filter by date range.
- Filter by payment method.
- Admins can filter by branch and cashier.
- Open transaction details.

Tables/data touched:

- `sales`
- `sale_items`
- `profiles` for cashier search support

Why it matters:

Sales history proves what happened after checkout. It supports review, reporting, and receipt/detail lookup.

### Inventory Management

The Inventory page lives at:

- `apps/web/src/features/inventory/pages/InventoryPage.jsx`

Service file:

- `apps/web/src/features/inventory/services/inventoryService.js`

What the user can do:

- View inventory rows.
- Filter by branch, status, and category.
- Search and paginate items.
- Admins can add, edit, and remove product records.
- Admins and employees can update stock.
- Employees are scoped to their assigned branch.

Tables/data touched:

- Reads from `inventory_catalog_view`
- Writes to `products`

Why it matters:

Inventory is the source of truth for what can be sold. POS uses product stock to decide whether an item is sellable.

### Product and Category Review

The Products page lives at:

- `apps/web/src/features/products/pages/ProductsPage.jsx`

Service file:

- `apps/web/src/features/products/services/productService.js`

What the user can do:

- Review product catalog rows.
- Search products.
- View products by category.
- Rename product-backed categories.
- Remove product-backed categories by reassigning affected products to `Uncategorized`.
- Maintain local custom categories used by the frontend.

Tables/data touched:

- Reads from `product_catalog_view`
- Updates `products.category`

Why it matters:

This page helps admins clean and organize the selling catalog. The current implementation treats `products.category` as the active category source.

### Reports

The Reports page lives at:

- `apps/web/src/features/reports/pages/ReportsPage.jsx`

Service file:

- `apps/web/src/features/reports/services/reportService.js`

What the user can do:

- Select a report date range.
- View total sales.
- View transaction count.
- View items sold.
- View low-stock count.
- View top-selling items.
- View low-stock items.
- View cashier performance.

Tables/data touched:

- `sales`
- `sale_items`
- `products` through inventory service/view

Why it matters:

Reports summarize business performance. The current report data is calculated from sales and inventory data instead of being stored in a separate reports table.

### User and Branch Management

The Users page lives at:

- `apps/web/src/features/users/pages/UsersPage.jsx`

Service files:

- `profileService.js`
- `branchService.js`
- `userService.js` for local fallback mode

What the user can do:

- Admins can view employees.
- Admins can create employee accounts.
- Admins can assign employees to branches.
- Admins can activate or deactivate employees.
- Admins can create branch records.
- Admins can view branch staffing information.

Tables/data touched:

- `profiles`
- `branches`
- Supabase Auth users through the Edge Function

Why it matters:

The POS needs real staff accounts and branch assignments. This page controls access and operational scope.

## 3. Data Flow Analysis

This section explains how data moves through the system. A "flow" means the chain of steps from user action to database response to UI update.

### Flow 1: Logging In

1. The user opens `/` or `/login`.
2. `LoginPage.jsx` displays the login form.
3. The user enters an email and password.
4. The form is validated by `validateLoginForm()` in `shared/utils/validation.js`.
5. `loginUser()` in `authService.js` calls `supabase.auth.signInWithPassword()`.
6. Supabase Auth checks the credentials.
7. If login succeeds, `getProfileForAuthUser()` reads the matching row from `profiles`.
8. The system checks that:
   - The profile exists.
   - The account is active.
   - The role is valid.
   - Employee accounts have an assigned branch.
9. `claimCurrentSessionLock()` calls the Supabase session-lock RPC.
10. If the lock succeeds, `AuthProvider.jsx` stores the user in React context.
11. React Router sends the user to the correct default page.

If login fails, the user sees an error and the app signs out locally to avoid keeping a bad session.

### Flow 2: Restoring an Existing Session

1. `AuthProvider.jsx` runs when the app starts.
2. It calls `getCurrentSession()`.
3. If Supabase has a saved session, the app reads the user profile from `profiles`.
4. It validates the session lock with `validateCurrentSessionLock()`.
5. If the session is valid, the user is restored.
6. If not valid, the local Supabase session is cleared.

This allows refreshes to keep users signed in while still enforcing session safety.

### Flow 3: Loading Products for POS

1. The user opens `/app/pos`.
2. `PosPage.jsx` loads branch options with `getBranches()`.
3. The active branch is chosen from the user's assigned branch or from the admin-selected branch.
4. `getProducts({ branchId })` in `productService.js` reads rows from `inventory_catalog_view`.
5. Products are normalized into frontend-friendly fields such as `name`, `price`, `category`, `stockQuantity`, and `branchName`.
6. `ProductGrid.jsx` displays the filtered product list.
7. Products with missing price, missing unit, or no stock are shown as needing review or unavailable.

The POS product list is branch-aware so a cashier does not sell from the wrong branch stock.

### Flow 4: Adding Items to Cart

1. The user clicks a product card in `ProductGrid.jsx`.
2. The component checks if the product is sellable.
3. It checks available stock against the quantity already in the cart.
4. If allowed, the item is added to `cartItems` state in `PosPage.jsx`.
5. `CartTable.jsx` displays the cart.
6. `PaymentPanel.jsx` recalculates subtotal, discount, service fees, total, and change.

The cart is frontend state until checkout is completed.

### Flow 5: Completing a POS Transaction

1. The user clicks Checkout in `PaymentPanel.jsx`.
2. `validateCheckout()` checks:
   - Payment method exists.
   - Cart is not empty.
   - Quantities are whole numbers greater than zero.
   - Prices are valid.
   - Quantity does not exceed available stock.
   - Discount is not negative.
   - Discount does not exceed subtotal.
   - Cash received is enough for the total.
3. `PaymentPanel.jsx` builds the sale payload and line items.
4. `createSale()` in `salesService.js` creates a normalized sale record.
5. If Supabase data is enabled, `createSupabaseSale()` calls RPC `create_checkout_sale`.
6. The RPC validates cashier, branch, amounts, line totals, stock, and permissions.
7. The RPC updates `products.stock_quantity`.
8. The RPC inserts one row into `sales`.
9. The RPC inserts rows into `sale_items`.
10. Supabase returns the saved sale and sale items.
11. `salesService.js` invalidates sales, reports, inventory, and product caches.
12. `PaymentPanel.jsx` clears the cart and shows a success message.
13. `PosPage.jsx` refreshes history and updates visible product stock.

This is the most important data flow in the system because it affects money, sales records, and inventory counts.

### Flow 6: Updating Inventory

1. The user opens `/app/inventory`.
2. `InventoryPage.jsx` loads inventory through `getInventoryItems()`.
3. Admins can create or edit product records.
4. Admins and employees can update stock using stock-in or final stock adjustment actions.
5. `validateInventoryForm()` checks product data before save.
6. `validateInventoryQuantityAction()` checks stock quantity changes.
7. `inventoryService.js` writes changes to `products`.
8. Caches for inventory, products, and reports are cleared.
9. The Inventory page reloads and shows updated rows.

Employees are allowed to adjust stock for assigned-branch items, but database hardening prevents them from changing other product fields.

### Flow 7: Viewing Sales History

1. The user opens Sales History inside `/app/pos`.
2. `SalesHistoryPanel.jsx` reads filter state from session storage.
3. It calls `getSalesHistoryPage()` in `salesService.js`.
4. For Supabase mode, the service queries `sales` using filters.
5. It then loads related `sale_items` for the visible sale IDs.
6. The records are normalized and displayed in a table.
7. Clicking View Details opens `SalesHistoryDetailsModal.jsx`.

Admins can query broader history. Employees are limited to their own cashier records by service filters and Supabase policies.

### Flow 8: Generating Reports

1. The user opens `/app/reports`.
2. The page starts with a default report range from `getDefaultReportDateRange()`.
3. The user can change From and To dates.
4. `validateReportDateRange()` checks that the dates are valid and ordered.
5. `getReportSnapshot()` loads:
   - Inventory data through `getInventoryItems()`
   - Sales data through `getSalesRecords()`
6. `reportService.js` calculates:
   - Total sales
   - Transaction count
   - Items sold
   - Low-stock count
   - Top items
   - Cashier performance
7. The Reports page renders summary cards and tables.

Reports are derived from existing data. There is no separate `reports` table in active use.

### Flow 9: Creating an Employee Account

1. An admin opens `/app/users`.
2. The admin opens the Employee Manager.
3. The admin enters full name, email, username, temporary password, branch, and status.
4. `createManagedEmployeeAccount()` validates the payload.
5. The browser invokes the Supabase Edge Function `admin-create-user`.
6. The Edge Function verifies the caller's Supabase Auth session.
7. The Edge Function checks that the caller is an active admin in `profiles`.
8. It validates username uniqueness and branch status.
9. It uses the Supabase service-role key inside the Edge Function to create a Supabase Auth user.
10. It upserts the matching `profiles` row.
11. The frontend reloads the employee directory.

The service-role key is kept server-side in the Edge Function and is not exposed to browser code.

## 4. Endpoint / API / Data Access Mapping

### Frontend Routes

| Route | Page/component | Access | Purpose |
| --- | --- | --- | --- |
| `/` | `LoginPage.jsx` or redirect | Public/auth aware | Shows login or redirects signed-in users. |
| `/login` | Redirect route | Public/auth aware | Redirects to `/`. |
| `/app` | `MainLayout.jsx` | Authenticated | Main protected app shell. |
| `/app/dashboard` | `DashboardPage.jsx` | Admin, Employee | Operational summary. |
| `/app/pos` | `PosPage.jsx` | Admin, Employee | Sales desk and sales history. |
| `/app/inventory` | `InventoryPage.jsx` | Admin, Employee | Inventory viewing and stock management. |
| `/app/reports` | `ReportsPage.jsx` | Admin only | Sales and inventory reporting. |
| `/app/products` | `ProductsPage.jsx` | Admin only | Product and category review. |
| `/app/users` | `UsersPage.jsx` | Admin only | Employee and branch access management. |
| `*` | `NotFoundPage.jsx` | Any | Handles unknown routes. |

### Supabase Client Setup

The Supabase client is defined in:

- `apps/web/src/shared/supabase/client.js`

Important environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_ANON_KEY` as fallback
- `VITE_SUPABASE_EDGE_FUNCTION_ADMIN_CREATE_USER`
- `VITE_SUPABASE_RPC_CLAIM_SESSION_LOCK`
- `VITE_SUPABASE_RPC_VALIDATE_SESSION_LOCK`
- `VITE_SUPABASE_RPC_RELEASE_SESSION_LOCK`
- `VITE_SUPABASE_RPC_CREATE_CHECKOUT_SALE`
- `VITE_SUPABASE_DEFAULT_BRANCH_ID`
- `VITE_SUPABASE_SYNC_INVENTORY_ON_SALE`

The browser client uses a publishable/anon key only. Secret service-role keys are not used in frontend code.

### Service-Layer Data Access

| Service/function | Action type | Called from | Supabase resource |
| --- | --- | --- | --- |
| `authService.loginUser()` | Auth sign-in | Login page | Supabase Auth, `profiles`, session lock RPC |
| `authService.logoutUser()` | Auth sign-out | Header/AuthProvider | Supabase Auth, session lock RPC |
| `sessionLockService.claimCurrentSessionLock()` | RPC | Login/session restore | `claim_session_lock` |
| `sessionLockService.validateCurrentSessionLock()` | RPC | Auth heartbeat | `validate_session_lock` |
| `sessionLockService.releaseCurrentSessionLock()` | RPC | Logout | `release_session_lock` |
| `profileService.getProfileForAuthUser()` | Select | AuthProvider/login | `profiles` joined to `branches` |
| `profileService.getProfilesDirectory()` | Select | Dashboard, Users, Sales History filters | `profiles` joined to `branches` |
| `profileService.createManagedEmployeeAccount()` | Edge Function invoke | Users page | `admin-create-user` |
| `profileService.updateProfileDirectoryEntry()` | Update | Users page | `profiles` |
| `branchService.getBranches()` | Select | Dashboard, POS, Inventory, Users | `branches` |
| `branchService.createBranch()` | Insert | Users page | `branches` |
| `inventoryService.getInventoryItems()` | Select | Dashboard, Inventory, Reports | `inventory_catalog_view` |
| `inventoryService.createInventoryItem()` | Insert | Inventory page | `products` |
| `inventoryService.updateInventoryItem()` | Update | Inventory page | `products` |
| `inventoryService.updateInventoryStock()` | Update | Inventory page | `products.stock_quantity` |
| `inventoryService.removeInventoryItem()` | Delete | Inventory page | `products` |
| `productService.getProducts()` | Select | POS | `inventory_catalog_view` |
| `productService.getProductCatalog()` | Select | Products page | `product_catalog_view` |
| `productService.renameProductCategory()` | Update | Products page | `products.category` |
| `productService.removeProductCategory()` | Update | Products page | `products.category` to `Uncategorized` |
| `salesService.createSale()` | RPC or local fallback | PaymentPanel | `create_checkout_sale` RPC |
| `salesService.getSalesHistoryPage()` | Select | SalesHistoryPanel | `sales`, then `sale_items` |
| `salesService.getSalesRecords()` | Select | Reports service | `sales`, `sale_items` |
| `reportService.getReportSnapshot()` | Derived calculation | Dashboard, Reports | Uses sales and inventory services |

### Supabase RPCs

| RPC | Purpose |
| --- | --- |
| `claim_session_lock` | Claims the active session for the logged-in user. |
| `validate_session_lock` | Confirms the current browser still owns the active session. |
| `release_session_lock` | Releases the user's active session on logout. |
| `create_checkout_sale` | Saves checkout and inventory deduction as one database transaction. |

### Supabase Edge Function

| Function | Purpose | Why it exists |
| --- | --- | --- |
| `admin-create-user` | Creates employee Auth accounts and profile rows | Browser code cannot safely use the Supabase service-role key. |

## 5. Component Hierarchy

### Top-Level Application

`main.jsx` starts the React app and mounts it into the page.

`App.jsx` renders `AppRouter`.

`AppRouter.jsx` defines all app routes and wraps the app with:

- `AuthProvider`
- `BrowserRouter`
- `SessionInactivityMonitor`
- `ProtectedRoute`
- `MainLayout`

### Layout Components

| Component | Location | Responsibility |
| --- | --- | --- |
| `MainLayout.jsx` | `app/layout` | Main app shell with sidebar, header, content area, mobile sidebar behavior, and focus management. |
| `Header.jsx` | `app/layout` | Top header controls and user/logout area. |
| `Sidebar.jsx` | `app/layout` | Navigation menu based on visible nav items for the user's role. |
| `ProtectedRoute.jsx` | `app/router` | Blocks unauthenticated users and redirects users who lack the required role. |
| `SessionInactivityMonitor.jsx` | `app/router` | Tracks activity and logs out idle users. |

### Feature Pages

| Page | Location | Responsibility |
| --- | --- | --- |
| `LoginPage.jsx` | `features/auth/pages` | Handles login UI. |
| `DashboardPage.jsx` | `features/dashboard/pages` | Shows sales, branch, employee, and inventory summaries. |
| `PosPage.jsx` | `features/pos/pages` | Main sales workspace and sales history switcher. |
| `InventoryPage.jsx` | `features/inventory/pages` | Inventory table, filters, product forms, stock dialogs. |
| `ProductsPage.jsx` | `features/products/pages` | Product catalog and category management. |
| `ReportsPage.jsx` | `features/reports/pages` | Business reports and date-range filtering. |
| `UsersPage.jsx` | `features/users/pages` | Employee and branch management. |
| `NotFoundPage.jsx` | `app/pages` | Unknown route fallback. |

### POS Components

| Component | Responsibility |
| --- | --- |
| `ProductGrid.jsx` | Shows product cards and adds sellable products to the cart. |
| `CartTable.jsx` | Shows current cart items and quantity controls. |
| `PaymentPanel.jsx` | Calculates totals, validates checkout, calls `createSale()`, and shows receipt preview. |
| `SalesHistoryPanel.jsx` | Lists completed transactions with filters and pagination. |
| `SalesHistoryDetailsModal.jsx` | Shows details for one sale. |
| `ReceiptPreview.jsx` | Shows receipt-style output for a sale. |

### Inventory Components

| Component | Responsibility |
| --- | --- |
| `InventoryPage.jsx` | Stateful container for inventory loading, filtering, forms, stock updates, and delete actions. |
| `InventoryTable.jsx` | Displays inventory rows and action buttons. |

### Reports Components

| Component | Responsibility |
| --- | --- |
| `SummaryCards.jsx` | Shows report totals. |
| `TopItemsTable.jsx` | Reusable table for top items, low stock, and cashier performance. |

### Shared UI Components

| Component | Responsibility |
| --- | --- |
| `Modal.jsx` | Reusable modal dialog. |
| `SelectMenu.jsx` | Reusable styled select input. |
| `EmptyState.jsx` | Shows friendly empty results. |
| `Loader.jsx` | Shows loading state. |
| `NoticeBanner.jsx` | Shows success, warning, info, or error messages. |
| `PaginationControls.jsx` | Reusable pagination controls. |
| `StatusBadge.jsx` | Shows status labels. |

### Stateful vs Presentational Components

A **stateful component** owns data and behavior. Examples:

- `PosPage.jsx`
- `InventoryPage.jsx`
- `ReportsPage.jsx`
- `UsersPage.jsx`
- `AuthProvider.jsx`

A **presentational component** mostly receives data through props and displays it. Examples:

- `ProductGrid.jsx`
- `CartTable.jsx`
- `SummaryCards.jsx`
- `TopItemsTable.jsx`
- `StatusBadge.jsx`

This separation helps keep large pages understandable.

## 6. Technical Constraints, Business Logic, and Rules

### Role Rules

Rule:

- Admins have full management access.
- Employees have operational access to Dashboard, POS, and Inventory.

Implemented in:

- `shared/utils/permissions.js`
- `ProtectedRoute.jsx`
- Supabase RLS policies in SQL files

Why it exists:

It prevents employees from managing reports, products, branches, and other users.

### Branch Scoping

Rule:

- Employee users are tied to one branch.
- Employee POS and inventory views use the assigned branch.
- Admins can select broader branch scope.

Implemented in:

- `profileService.js`
- `PosPage.jsx`
- `InventoryPage.jsx`
- Supabase RLS policies
- Checkout RPC

Why it exists:

It prevents a cashier from selling or editing stock for the wrong branch.

### Employee Stock-Only Restriction

Rule:

- Employees may update stock quantity for assigned-branch products.
- Employees may not change product name, category, price, barcode, or other product fields.

Implemented in:

- Frontend UI permissions
- `apps/web/supabase/sql/18_auth_inventory_hardening.sql`

Why it exists:

Frontend restrictions alone are not enough. A database trigger protects the system if someone bypasses the UI and calls Supabase directly.

### Checkout Rules

Rule:

- Cart cannot be empty.
- Quantities must be whole numbers greater than zero.
- Quantity cannot exceed stock.
- Price must be valid.
- Discount cannot be negative.
- Discount cannot exceed product subtotal.
- Cash received must cover total.
- Payment method is currently cash only.

Implemented in:

- `validateCheckout()` in `shared/utils/validation.js`
- `PaymentPanel.jsx`
- `19_transactional_checkout_rpc.sql`

Why it exists:

Checkout affects money and inventory. The browser validates for user experience, and the database validates again for safety.

### Discount Rules

Current discount options:

| Discount | Rate |
| --- | --- |
| No Discount | 0% |
| Senior Citizen | 20% |
| PWD | 20% |

Implemented in:

- `features/pos/utils/discounts.js`

Discount is calculated from product subtotal, not from service fees.

### Service Fee Rules

Current checkout add-ons:

| Add-on | Amount |
| --- | --- |
| Self-Service Cooking | PHP 10 |
| Microwave Usage | PHP 5 |

Implemented in:

- `features/pos/utils/serviceFees.js`

Service fee line items are saved with sale items, but they are excluded from inventory deductions and item-sold counts.

### Inventory Rules

Rule:

- Product name is required.
- Category must be supported.
- Stock must be a whole number and cannot be negative.
- Price is required and cannot be negative.
- Barcode may only use allowed characters.
- Reorder level, if provided, must be a whole number and cannot be negative.

Implemented in:

- `validateInventoryForm()`
- `validateInventoryQuantityAction()`
- `inventoryService.js`

Why it exists:

Bad inventory data creates broken POS behavior. For example, a product without price should not be sold.

### Low Stock and Expiry Rules

Rule:

- Low stock threshold defaults to 10.
- Near-expiry threshold is 30 days.

Implemented in:

- `inventoryService.js`

Why it exists:

The dashboard and reports can warn staff before stock problems become sales problems.

### Session and Inactivity Rules

Rule:

- A Supabase account uses session locking to avoid active conflicting sessions.
- The app tracks inactivity and can log out idle users.

Implemented in:

- `sessionLockService.js`
- `AuthProvider.jsx`
- `SessionInactivityMonitor.jsx`
- `10_auth_session_locking.sql`
- `18_auth_inventory_hardening.sql` stale lock update

Why it exists:

POS systems are sensitive because users can perform sales and inventory changes. Session control reduces account-sharing and unattended-session risk.

### Error, Loading, and Empty States

The app uses shared components for user feedback:

- `Loader`
- `EmptyState`
- `NoticeBanner`

This is used across Dashboard, POS, Inventory, Reports, Products, and Users.

Why it exists:

Users need clear feedback when data is loading, missing, invalid, or unavailable.

### Cache Strategy

Several services use short-lived in-memory/resource cache helpers:

- Branch cache: about 5 minutes
- Profile directory cache: about 2 minutes
- Inventory/product/report cache: about 1 minute
- Sales cache: about 30 seconds

Implemented in:

- `shared/utils/resourceCache.js`
- Individual service files

Why it exists:

It reduces repeated identical Supabase calls while keeping data reasonably fresh.

## 7. Database and Table Usage Summary

### `profiles`

Purpose:

Stores app-specific user information connected to Supabase Auth users.

Important data:

- `id`
- `username`
- `full_name`
- `role_key`
- `branch_id`
- `status`

Used by:

- Login/session restore
- Role-based access
- Users page
- Dashboard employee counts
- Sales history cashier filtering

Read/write behavior:

- Read during login and directory loading.
- Updated by admins.
- Inserted/upserted when employee accounts are created.

Relationship:

- `profiles.id` matches `auth.users.id`.
- Employee profiles can point to `branches.id`.

### `branches`

Purpose:

Stores business branch information.

Important data:

- `id`
- `code`
- `name`
- `status`
- `manager_name`
- `contact_number`
- `address`
- `opening_date`
- `notes`

Used by:

- POS branch selection
- Inventory branch scope
- User assignment
- Dashboard branch counts
- Reports/sales filters

Read/write behavior:

- Read by most modules.
- Inserted by admins through Users page.

Relationship:

- Employees belong to branches through `profiles.branch_id`.
- Products and sales are tied to branches.

### `products`

Purpose:

Stores product catalog and active inventory stock.

Important data:

- `id`
- `branch_id`
- `branch`
- `barcode`
- `category`
- `product_name`
- `net_weight`
- `price`
- `stock_quantity`
- `expiration_date`
- `is_active`

Used by:

- POS product selling
- Inventory management
- Product review
- Reports low-stock data
- Checkout inventory deduction

Read/write behavior:

- Read often.
- Inserted, updated, and deleted by admins.
- Stock can be updated by employees within allowed branch scope.
- Stock is deducted by checkout RPC.

Relationship:

- `sale_items.product_id` points back to products when a product is sold.

### `sales`

Purpose:

Stores one row per completed checkout.

Important data:

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
- `submitted_at`
- `notes`

Used by:

- Sales history
- Reports
- Dashboard sales summary
- Transaction details

Read/write behavior:

- Inserted during checkout.
- Read by sales history and reports.

Relationship:

- One sale has many `sale_items`.

### `sale_items`

Purpose:

Stores each line item inside a completed sale.

Important data:

- `id`
- `sale_id`
- `product_id`
- `inventory_item_id`
- `item_name`
- `quantity`
- `unit_price`
- `line_total`

Used by:

- Transaction details
- Receipt preview
- Reports top items and items sold
- Sales history detail view

Read/write behavior:

- Inserted during checkout.
- Read after loading sales.

Relationship:

- Each sale item belongs to one `sales` row.
- Product line items may point to `products`.
- Service fee line items usually have no product ID.

### `product_catalog_view`

Purpose:

Provides a product review view for the Products page.

Used by:

- `productService.getProductCatalog()`

Read/write behavior:

- Read-only from the frontend.
- Updates happen against `products`.

### `inventory_catalog_view`

Purpose:

Provides a normalized inventory/product view for POS and Inventory.

Used by:

- `productService.getProducts()`
- `inventoryService.getInventoryItems()`

Read/write behavior:

- Read-only from the frontend.
- Updates happen against `products`.

### `private.active_session_locks`

Purpose:

Tracks which session currently owns a user's account lock.

Used by:

- Login session locking
- AuthProvider heartbeat
- Logout release

Read/write behavior:

- Managed through RPC functions.
- Not accessed directly by frontend table queries.

### Legacy or Compatibility Tables

SQL history includes `categories` and `inventory_items`, but the current frontend logic primarily uses the flattened `products` table plus catalog views. Some compatibility fields such as `inventory_item_id` still appear in frontend normalization because older data shapes and sale item references may still exist.

This means the current practical source of truth is:

- Product catalog and inventory stock: `products`
- Sales header: `sales`
- Sales lines: `sale_items`
- Users and roles: `profiles`
- Branches: `branches`

## 8. How the Whole System Works in Simple Terms

Think of the system as a restaurant sales desk connected to a secure online notebook.

The React app is the screen that the cashier or admin uses. Supabase is the secure notebook where the real records are stored.

When a user logs in, Supabase Auth checks the email and password. After that, the app reads the user's profile to know if the user is an admin or employee. If the user is an employee, the app also learns which branch the employee belongs to.

After login, the user enters the main app. The sidebar shows only the pages that the user's role is allowed to use. Admins see more pages because they manage the business. Employees see the pages they need for daily work.

On the Dashboard, the app gathers summary data from branches, products, sales, sale items, and profiles. It turns that data into simple cards such as sales total, transaction count, low-stock items, and active staff.

In Inventory, the app loads product stock from Supabase. Admins can add or edit products. Employees can adjust stock for their own branch, but the database prevents them from secretly changing product details such as price or name.

In POS, the app loads products for the selected or assigned branch. The cashier clicks products to add them to a cart. The app checks stock so the cashier cannot add more than what is available. The payment panel calculates subtotal, discount, service fees, total, cash received, and change.

When checkout is submitted, the app sends the sale to Supabase through a special database function. This function is important because it saves the sale and deducts stock together. If something is wrong, the whole checkout fails instead of saving only half of the work.

After checkout, the sale appears in Sales History. The sale header is stored in `sales`, and the individual sold items are stored in `sale_items`. Reports then use those records to calculate totals, top products, cashier performance, and low-stock warnings.

The Users page lets admins create employees and branches. Employee creation uses a Supabase Edge Function because creating real Auth users requires a secret service-role key. That key stays on the Supabase server side and is not exposed in the browser.

In short:

1. React displays the pages.
2. Services organize the app's data requests.
3. Supabase Auth verifies users.
4. Supabase Database stores business records.
5. Supabase RLS and RPC functions protect important operations.
6. The UI updates after each successful response.

The system is production-oriented because important rules are checked in more than one place. The frontend gives quick feedback to users, while Supabase protects the real database records.

## Current Implementation Notes and Limitations

These notes are useful for Capstone defense because they explain what the system currently supports and what is intentionally limited.

- The system does not use a traditional REST API server. The React app communicates with Supabase directly through service files.
- Employee account creation is the main server-side exception because it uses the `admin-create-user` Edge Function.
- Checkout supports cash payment only at the moment.
- Reports are calculated from sales and inventory data. They are not stored in a separate reports table.
- Product categories are currently stored mainly as text on `products.category`; there is not an active normalized category-management table in frontend use.
- The codebase still has a local fallback mode using local storage when Supabase is disabled. Production should use Supabase.
- The frontend uses short-lived caches, so some screens may briefly show cached data before refreshed data arrives.
- The Supabase service-role key must only exist in Supabase/Vercel server-side environments or Edge Function secrets, never in frontend `VITE_` variables.
