# Supabase Auth Account Handoff

These are the target real accounts the frontend is now prepared to use:

## Admin
- Email: `tomjatn@gmail.com`
- Password: `password123`
- Profile username: `tomjatn`

## Employees
- Email: `otamsomats@gmail.com`
- Password: `password123`
- Profile username: `otamsomats`

- Email: `tomjoshua9@gmail.com`
- Password: `password123`
- Profile username: `tomjoshua9`

## Current limitation

Automatic signup from the browser hit Supabase email rate limiting during setup.

That means the safe next step is:

1. Open `Supabase Dashboard > Authentication > Users`
2. Create these three users manually if they do not exist yet
3. Confirm them there as well if your project requires email confirmation
4. Run [`sql/05_auth_profile_seed_template.sql`](./sql/05_auth_profile_seed_template.sql)

## Old demo accounts

These old demo accounts should be deleted manually from `Authentication > Users`:

- `admin.demo.capstonepos@gmail.com`
- `cashier.main.demo.capstonepos@gmail.com`
- `cashier.north.demo.capstonepos@gmail.com`

## Optional safety step

If you want to block any old seeded demo profiles inside the app before deleting those Auth users, run:

- [`sql/06_retire_old_demo_profiles.sql`](./sql/06_retire_old_demo_profiles.sql)

This does not delete Auth users, but it marks the old demo profiles inactive so they cannot pass the frontend profile status checks.
