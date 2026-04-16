# Samgyupsal POS System

React + Vite frontend for the capstone POS and inventory system, deployed on Vercel and backed primarily by Supabase.

## Repo Structure

- `frontend/` - live React application and operational Supabase assets
- `backend/` - reserved for a future trusted backend or admin automation layer
- `documentation/` - canonical project documentation, rollout guides, and diagrams
- `vercel.json` - root deployment config that builds and serves the Vite app from `frontend/`

## Current Architecture

- Frontend: React 19, React Router, Vite
- Data layer: Supabase Auth + Supabase Postgres
- Fallback mode: small Axios contract plus `localStorage` for demo resilience
- Hosting: Vercel

Important: there is no implemented custom API server in `backend/` yet. The browser currently talks directly to Supabase for the active data flow.

## Local Setup

1. Install dependencies in `frontend/`
2. Copy `frontend/.env.example` to `frontend/.env`
3. Fill in your Supabase environment variables
4. Run the frontend:

```powershell
npm run dev
```

## Useful Commands

```powershell
npm run dev
npm run lint
npm run build
```

## Database Setup

Run the SQL files in the order documented in `documentation/supabase/sql-run-order.md`.

## Documentation

- App architecture: `documentation/architecture/frontend-application.md`
- Supabase integration: `documentation/supabase/frontend-integration.md`
- SQL rollout order: `documentation/supabase/sql-run-order.md`
- Frontend handoff: `documentation/handoff/frontend-team-handoff.md`

## Deployment

Vercel should deploy from the repository root. The root config redirects build/install work into `frontend/` and serves `frontend/dist`.
