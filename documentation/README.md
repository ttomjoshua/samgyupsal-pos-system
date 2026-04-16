# Documentation Index

This folder is the canonical home for project-facing documentation that explains architecture, handoff, rollout, and database operations.

## Sections

- `architecture/`
  - `frontend-application.md` - React app structure, runtime behavior, and local setup
- `handoff/`
  - `frontend-team-handoff.md` - demo guidance, QA notes, and continuation priorities
- `supabase/`
  - `frontend-integration.md` - frontend-to-Supabase contract and env expectations
  - `sql-run-order.md` - SQL and Edge Function rollout order
  - `auth-rollout-checklist.md` - step-by-step Auth rollout checklist
  - `auth-account-handoff.md` - first-admin bootstrap and account handoff guidance
- `mermaid/`
  - deployment, ERD, and network diagrams

Operational SQL files and Edge Functions still live in `frontend/supabase/`, because they are runtime assets rather than narrative documentation.
