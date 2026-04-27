# Supabase Auth Account Handoff

Use this as a template for the first real admin bootstrap.

## First admin bootstrap

1. Open `Supabase Dashboard > Authentication > Users`
2. Create the first admin account manually
3. Confirm the account there as well if your project requires email confirmation
4. Run [`apps/web/supabase/sql/05_auth_profile_seed_template.sql`](../../apps/web/supabase/sql/05_auth_profile_seed_template.sql) and set that user to `admin`
5. Log in as that admin in the frontend
6. Create employee accounts from the Users page through the secured `admin-create-user` Edge Function

## Recommended fields to keep in your private handoff sheet

- employee full name
- employee email
- profile username
- assigned branch
- temporary first password
- status

Do not commit real passwords or real account lists into this repo.

## Retiring unwanted bootstrap accounts

If you still have obsolete Auth users from earlier rehearsals, delete them manually from:

- `Supabase Dashboard > Authentication > Users`

## Optional safety step

If you want to block old seeded profiles inside the app before deleting those Auth users, run:

- [`apps/web/supabase/sql/06_retire_obsolete_profiles_template.sql`](../../apps/web/supabase/sql/06_retire_obsolete_profiles_template.sql)

This does not delete Auth users, but it marks the old seeded profiles inactive so they cannot pass the frontend profile status checks.

