-- Real account profile seed.
--
-- Target Auth users:
-- 1. tomjatn@gmail.com
-- 2. otamsomats@gmail.com
-- 3. tomjoshua9@gmail.com
--
-- Run this only after:
-- 1. creating or confirming the Auth users in Supabase Dashboard if email confirmation is enabled
-- 2. running 04_auth_profiles_rollout.sql

begin;

update public.profiles
set
  username = 'tomjatn',
  full_name = 'Tomjatn Admin',
  role_key = 'admin',
  branch_id = null,
  status = 'active',
  updated_at = now()
where id = (
  select id
  from auth.users
  where email = 'tomjatn@gmail.com'
);

update public.profiles
set
  username = 'otamsomats',
  full_name = 'Otamsomats Employee',
  role_key = 'employee',
  branch_id = 1,
  status = 'active',
  updated_at = now()
where id = (
  select id
  from auth.users
  where email = 'otamsomats@gmail.com'
);

update public.profiles
set
  username = 'tomjoshua9',
  full_name = 'Tomjoshua9 Employee',
  role_key = 'employee',
  branch_id = 2,
  status = 'active',
  updated_at = now()
where id = (
  select id
  from auth.users
  where email = 'tomjoshua9@gmail.com'
);

commit;

select
  profile.id,
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
