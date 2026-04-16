# Supabase Auth Account Handoff

Use this as a template for the first real admin bootstrap.

## First admin bootstrap

1. Open `Supabase Dashboard > Authentication > Users`
2. Create the first admin account manually
3. Confirm the account there as well if your project requires email confirmation
4. Run [`frontend/supabase/sql/05_auth_profile_seed_template.sql`](../../frontend/supabase/sql/05_auth_profile_seed_template.sql) and set that user to `admin`
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

## Old demo accounts

If you still have demo Auth users from earlier rehearsals, delete them manually from:

- `Supabase Dashboard > Authentication > Users`

## Optional safety step

If you want to block any old seeded demo profiles inside the app before deleting those Auth users, run:

- [`frontend/supabase/sql/06_retire_old_demo_profiles.sql`](../../frontend/supabase/sql/06_retire_old_demo_profiles.sql)

This does not delete Auth users, but it marks the old demo profiles inactive so they cannot pass the frontend profile status checks.
