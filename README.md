# Samgyupsal POS System

Samgyupsal POS and inventory monitoring system, deployed on Vercel and backed primarily by Supabase.

## Repository Structure

- `apps/web/` - live React + Vite application and operational Supabase assets
- `apps/api/` - reserved for a future trusted backend or admin automation layer
- `docs/` - canonical project documentation, rollout guides, and diagrams
- `vercel.json` - root deployment config that installs, builds, and serves `apps/web/`

## Architecture Summary

- Web app: React 19, React Router, Vite
- Data layer: Supabase Auth + Supabase Postgres
- Fallback mode: small Axios contract plus `localStorage` for demo resilience
- Hosting: Vercel

Important: there is no implemented custom API server in `apps/api/` yet. The browser currently talks directly to Supabase for the active data flow.

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
- Frontend handoff: `docs/handoff/frontend-team-handoff.md`

## Deployment

Vercel should deploy from the repository root. The root config installs `apps/web`, builds `apps/web`, and serves `apps/web/dist`.

The repository should have one active Git-connected Vercel project for automatic deployments:

- Project: `samgyupsal-pos-system`
- Root Directory: repository root `/`
- Production domain: `samgyupsal.vercel.app`

Do not keep the old nested `frontend` Vercel project connected to the same GitHub repository. That duplicate project was the source of the deployment confusion.
