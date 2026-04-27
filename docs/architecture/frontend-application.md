# Frontend Application

This folder contains the live React frontend for the Samgyupsal POS and Inventory Monitoring System.

## Stack

- React 19
- React Router
- Vite
- Supabase JS client

## Main Runtime Areas

- `src/app/` - app bootstrap, router, top-level layout, and auth provider
- `src/features/` - domain-owned pages, services, components, and styles
- `src/shared/` - reusable UI, Supabase client setup, utilities, and storage helpers
- `supabase/sql/` - SQL files used to initialize and migrate the Supabase schema

## Environment Variables

See [`apps/web/.env.example`](../../apps/web/.env.example).

Key values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_AUTH_ENABLED`
- `VITE_SUPABASE_DEFAULT_BRANCH_ID`
- `VITE_SUPABASE_CREATE_CHECKOUT_SALE_RPC`
- `VITE_SUPABASE_SYNC_INVENTORY_ON_SALE`

## Scripts

```powershell
npm run dev
npm run lint
npm run build
npm run preview
```

## Data Modes

The app uses Supabase when auth/data mode is enabled. If Supabase mode is disabled for local development, screens read and write only browser `localStorage` state:

- branch and employee state created locally in the browser
- sales history saved locally after checkout
- inventory records created locally from the Inventory page

Supabase mode should fail visibly instead of silently replacing live data with local records. That keeps production usage aligned to the real database source of truth.

