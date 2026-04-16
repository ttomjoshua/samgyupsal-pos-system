# Frontend Team Handoff

This file captures the current frontend integration status, known demo-safe deviations, and the clearest next steps for the capstone team.

## Final Integration Checklist

| Item | Status | Notes |
| --- | --- | --- |
| Folder separation | Pass | `frontend/` contains the live app, `documentation/` contains project docs, and `backend/` remains reserved for future trusted services. |
| Reusable modal | Pass | Inventory dialogs and receipt preview use the shared `Modal` component. The live POS flow intentionally keeps checkout inline in the summary panel. |
| Validation | Pass | Shared validation is centralized in `src/shared/utils/validation.js`. |
| Receipt preview | Partial | Cashier can review the latest receipt after a successful checkout. Pre-confirmation receipt preview is not active in the live POS flow. |
| Inventory form | Pass | Admin can add, edit, stock in, and adjust stock from the inventory page. |
| Feedback | Pass | Loading, empty, success, warning, and error states are visible through `Loader`, `EmptyState`, and `NoticeBanner`. |
| Role-based flow | Pass | Admin and employee navigation are separated by role-aware routes and sidebar visibility. |
| Testing | Partial | `npm run build` passes. Manual demo rehearsal is ready, but browser E2E tests are not implemented. |

## Important Warnings Before Demo

- The live cashier checkout flow is intentionally inline inside the summary panel.
- Receipt preview happens after successful checkout, not before final confirmation.
- Demo sales and demo inventory now persist in browser localStorage. Repeated rehearsals will keep changing totals and stock until the local demo data is reset.
- Inventory auto-deduction only affects inventory records that can be matched to sold POS items.
- Payment method is intentionally limited to `Cash` only.

## Beginner Mistakes Already Avoided

- Validation logic is shared through `src/shared/utils/validation.js` instead of being duplicated in every page.
- Inventory popups and receipt preview use one shared modal shell instead of unrelated one-off overlays.
- Checkout blocks empty cart submission and blocks insufficient cash for cash payments.
- Inventory forms reset when dialogs close, which keeps the admin flow cleaner between rehearsals.
- Frontend demo data is kept in the frontend app instead of being mixed into backend setup.
- Sale payload field names are kept aligned with the current frontend contract:
  - `cashier_id`
  - `payment_method`
  - `subtotal`
  - `discount`
  - `total_amount`
  - `cash_received`
  - `change_amount`
  - `items`

## Manual QA And Demo Script

### Demo accounts

- `admin / admin123`
- `cashier.main / cashier123`
- `cashier.north / cashier123`

### Cashier flow

1. Log in as `cashier.main`.
2. Confirm that only the POS-related navigation is visible.
3. Search for a product or click a category, then add items to the cart.
4. Increase or decrease quantity and confirm that totals update immediately.
5. Enter cash received in the summary panel.
6. Complete checkout and confirm that the success banner appears.
7. Open `View Last Receipt` and verify items, totals, and payment details.
8. Revisit reports later as admin and confirm that totals, top items, and cashier performance reflect the demo sale.

### Admin flow

1. Log in as `admin`.
2. Open the inventory page.
3. Click `Add Product` and submit one invalid attempt to show validation.
4. Save one valid product and confirm that the inventory table updates.
5. Edit an existing product, then use `Stock In` or `Adjust Stock`.
6. Open the reports page and confirm that summary cards and tables load cleanly.
7. Explain that successful POS demo sales now update matching inventory items and the reports snapshot in demo mode.

## Suggested Next Continuation

Recommended order from the current project state:

1. Add a safe admin-only `Reset Demo Data` action for localStorage-backed sales and inventory rehearsal.
2. Add receipt printing and print-specific CSS.
3. Improve cashier ergonomics with search polish, category shortcuts, and keyboard-friendly actions.
4. Expand the dashboard with owner-focused widgets and charts.
5. Add logout/session polish and route guard refinements.
6. Add browser-level frontend tests or a stricter manual QA checklist if the team wants a stronger final defense.

## Commit Message Examples

- `docs: add frontend team handoff and demo checklist`
- `feat: persist demo sales and sync reports with cashier flow`
- `feat: persist inventory updates and admin inventory actions`
- `style: polish resilient empty, loading, and notice states`
