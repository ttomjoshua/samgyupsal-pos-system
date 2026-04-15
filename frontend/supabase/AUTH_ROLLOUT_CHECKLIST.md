# Supabase Auth Rollout Checklist

Use this when switching the frontend from local demo login to real Supabase Auth.

## What is already done in code

- the frontend now supports Supabase browser sessions
- the login screen now expects `email/password` when `VITE_SUPABASE_AUTH_ENABLED=true`
- route guards now wait for Supabase session restore before redirecting
- the app now expects a matching `public.profiles` row for every real auth user
- the Users page now reads and updates employee/admin directory data from `public.profiles`

## Human steps still required

### 1. Run the auth rollout SQL

In Supabase SQL Editor, run:

- [`sql/04_auth_profiles_rollout.sql`](./sql/04_auth_profiles_rollout.sql)

This creates:

- the `auth.users -> public.profiles` trigger
- the admin helper function
- the `profiles` RLS policies
- a backfill for existing auth users

### 2. Create the first real Auth users

In Supabase Dashboard:

- go to `Authentication`
- open `Users`
- create the first admin account
- create at least one cashier/employee account

Use real email addresses that you can recognize in the seed step.

### 3. Assign roles and branch scope

Open:

- [`sql/05_auth_profile_seed_template.sql`](./sql/05_auth_profile_seed_template.sql)

Before running it:

- replace the sample emails with the real auth-user emails you created
- keep branch ids aligned with the `branches` table

Then run the file in SQL Editor.

### 4. Restart the frontend dev server

If `npm run dev` is already running, stop it and start it again so Vite picks up the latest env/auth changes.

### 5. Verify the auth data

Run this in SQL Editor:

```sql
select
  auth_user.email,
  profile.username,
  profile.full_name,
  profile.role_key,
  profile.branch_id,
  profile.status
from public.profiles as profile
left join auth.users as auth_user
  on auth_user.id = profile.id
order by profile.created_at desc;
```

You should see:

- one `admin`
- one or more `employee`
- branch ids for employee accounts
- `active` status

### 6. Verify the frontend login

In the app:

- log in with the admin email/password
- confirm admin routes are visible
- log out
- log in with the employee email/password
- confirm only the POS route is visible

## Important caution

The Users page can now manage real `profiles`, but it still does not create real Supabase Auth users from the browser.

That means:

- branch management is real
- operational data is real
- login is real
- employee directory editing is real
- new Auth-user creation is still awaiting a secure backend, Edge Function, or manual Dashboard flow
