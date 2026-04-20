# Supabase Auth Rollout Checklist

Use this when switching the frontend from local demo login to real Supabase Auth.

## What is already done in code

- the frontend now supports Supabase browser sessions
- the login screen now expects `email/password` when `VITE_SUPABASE_AUTH_ENABLED=true`
- route guards now wait for Supabase session restore before redirecting
- the app now expects a matching `public.profiles` row for every real auth user
- the Users page now reads and updates employee/admin directory data from `public.profiles`
- the repo now includes a secure `admin-create-user` Edge Function for admin-created employee accounts
- the frontend is ready to use the authenticated session-lock RPCs for one-device login enforcement

## Human steps still required

### 1. Run the auth rollout SQL

In Supabase SQL Editor, run:

- [`frontend/supabase/sql/04_auth_profiles_rollout.sql`](../../frontend/supabase/sql/04_auth_profiles_rollout.sql)

This creates:

- the `auth.users -> public.profiles` trigger
- the admin helper function
- the `profiles` RLS policies
- a backfill for existing auth users

### 2. Run the session-locking SQL

In Supabase SQL Editor, run:

- [`frontend/supabase/sql/10_auth_session_locking.sql`](../../frontend/supabase/sql/10_auth_session_locking.sql)

This creates:

- the private one-device session lock table
- the authenticated RPCs used by the frontend:
  - `claim_session_lock()`
  - `validate_session_lock()`
  - `release_session_lock()`

### 3. Deploy the admin-create-user Edge Function

Deploy:

- `functions/admin-create-user/index.ts`

This function:

- verifies the caller JWT on the server
- confirms the caller is an active admin from `public.profiles`
- creates the Auth user with the server-side admin API
- upserts the matching `public.profiles` row

### 4. Create the first real admin Auth user

In Supabase Dashboard:

- go to `Authentication`
- open `Users`
- create the first admin account

Use a real email address that you can recognize in the seed step.

### 5. Assign the first admin role and branch scope

Open:

- [`frontend/supabase/sql/05_auth_profile_seed_template.sql`](../../frontend/supabase/sql/05_auth_profile_seed_template.sql)

Before running it:

- replace the sample emails with the real auth-user emails you created
- keep branch ids aligned with the `branches` table

Then run the file in SQL Editor.

### 6. Restart the frontend dev server

If `npm run dev` is already running, stop it and start it again so Vite picks up the latest env/auth changes.

### 7. Verify the auth data

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

### 8. Verify the frontend login and employee creation

In the app:

- log in with the admin email/password
- confirm that logging into the same account on a second device is blocked
- confirm admin routes are visible
- open the Users page
- create one employee account from the secured form
- confirm that the new employee appears in the directory
- log out
- log in with the employee email/password
- confirm only the POS route is visible

## Important caution

The browser still must not create Auth users directly.

That means:

- branch management is real
- operational data is real
- login is real
- employee directory editing is real
- employee account creation is real only through the trusted Edge Function
- the first admin account still needs a manual bootstrap step
