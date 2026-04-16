# Frontend Application

This folder contains the live React frontend for the Samgyupsal POS and Inventory Monitoring System.

## Stack

- React 19
- React Router
- Vite
- Supabase JS client
- Axios fallback client for older demo endpoints

## Main Runtime Areas

- `src/app/` - app bootstrap, router, top-level layout, and auth provider
- `src/features/` - domain-owned pages, services, components, and styles
- `src/shared/` - reusable UI, API adapters, utilities, storage helpers, and mock data
- `supabase/sql/` - SQL files used to initialize and migrate the Supabase schema

## Environment Variables

See [`frontend/.env.example`](../../frontend/.env.example).

Key values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_AUTH_ENABLED`
- `VITE_SUPABASE_DEFAULT_BRANCH_ID`
- `VITE_SUPABASE_SYNC_INVENTORY_ON_SALE`

## Scripts

```powershell
npm run dev
npm run lint
npm run build
npm run preview
```

## Data Modes

The app prefers Supabase when it is configured. If Supabase is unavailable, some screens can still fall back to:

- the legacy Axios contract
- browser `localStorage`
- seeded mock data

That fallback behavior exists to keep demos resilient, but Supabase is the intended primary data source.
