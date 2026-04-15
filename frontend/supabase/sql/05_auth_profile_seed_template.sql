-- Real account profile seed.
--
-- Target Auth users:
-- 1. admin@example.com
-- 2. cashier.stalucia@example.com
-- 3. cashier.dollar@example.com
--
-- Run this only after:
-- 1. creating or confirming the Auth users in Supabase Dashboard if email confirmation is enabled
-- 2. running 04_auth_profiles_rollout.sql

begin;

update public.profiles
set
  username = 'admin.user',
  full_name = 'Admin User',
  role_key = 'admin',
  branch_id = null,
  status = 'active',
  updated_at = now()
where id = (
  select id
  from auth.users
  where email = 'admin@example.com'
);

update public.profiles
set
  username = 'cashier.stalucia',
  full_name = 'Sta. Lucia Cashier',
  role_key = 'employee',
  branch_id = 1,
  status = 'active',
  updated_at = now()
where id = (
  select id
  from auth.users
  where email = 'cashier.stalucia@example.com'
);

update public.profiles
set
  username = 'cashier.dollar',
  full_name = 'Dollar Cashier',
  role_key = 'employee',
  branch_id = 2,
  status = 'active',
  updated_at = now()
where id = (
  select id
  from auth.users
  where email = 'cashier.dollar@example.com'
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
