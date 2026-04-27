begin;

with obsolete_auth_users as (
  -- Add obsolete Auth user emails here before running this template.
  -- Example: select 'employee@example.com'::text as email
  select null::text as email
  where false
)
update public.profiles as profile
set
  status = 'inactive',
  username = coalesce(nullif(profile.username, ''), 'retired-user'),
  updated_at = now()
from auth.users as auth_user
where auth_user.id = profile.id
  and auth_user.email in (select email from obsolete_auth_users);

commit;

with obsolete_auth_users as (
  select null::text as email
  where false
)
select
  auth_user.email,
  profile.username,
  profile.role_key,
  profile.status
from public.profiles as profile
left join auth.users as auth_user
  on auth_user.id = profile.id
where auth_user.email in (select email from obsolete_auth_users)
order by auth_user.email asc;
