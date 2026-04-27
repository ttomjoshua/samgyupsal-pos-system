# Samgyupsal POS System

Samgyupsal POS and inventory monitoring system, deployed on Vercel and backed primarily by Supabase.

## Repository Structure

- `apps/web/` - live React + Vite application and operational Supabase assets
- `docs/` - canonical project documentation, rollout guides, and diagrams
- `vercel.json` - root deployment config that installs, builds, and serves `apps/web/`

## Architecture Summary

- Web app: React 19, React Router, Vite
- Data layer: Supabase Auth + Supabase Postgres
- Local state: `localStorage` is used only for unsynced browser state when Supabase auth is disabled
- Hosting: Vercel

Important: there is no custom API server in this repository. The browser talks directly to Supabase for the active data flow and uses the trusted Supabase Edge Function for admin user creation.

## Local Setup

1. Install dependencies in `apps/web/`
2. Copy `apps/web/.env.example` to `apps/web/.env`
3. Fill in your Supabase environment variables
4. Run the web app:

```powershell
npm run dev
```

## Useful Commands

```powershell
npm run dev
npm run build
npm run lint
npm run test
```

Root scripts intentionally target the web app so the primary deployable stays obvious:

- `npm run dev:web`
- `npm run build:web`
- `npm run lint:web`
- `npm run test:web`

## Database Setup

Run the SQL files in the order documented in `docs/supabase/sql-run-order.md`.

## Documentation

- App architecture: `docs/architecture/frontend-application.md`
- Supabase integration: `docs/supabase/frontend-integration.md`
- SQL rollout order: `docs/supabase/sql-run-order.md`

## Deployment

Vercel should deploy from the repository root. The root config installs `apps/web`, builds `apps/web`, and serves `apps/web/dist`.

The repository should have one active Git-connected Vercel project for automatic deployments:

- Project: `samgyupsal-pos-system`
- Root Directory: repository root `/`
- Production domain: `samgyupsal.vercel.app`

Do not keep the old nested `frontend` Vercel project connected to the same GitHub repository. That duplicate project was the source of the deployment confusion.
