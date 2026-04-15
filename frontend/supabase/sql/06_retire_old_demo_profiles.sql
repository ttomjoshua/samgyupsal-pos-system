begin;

update public.profiles
set
  status = 'inactive',
  username = coalesce(nullif(username, ''), 'retired-demo-user'),
  updated_at = now()
where id in (
  select id
  from auth.users
  where email in (
    'admin.demo.capstonepos@gmail.com',
    'cashier.main.demo.capstonepos@gmail.com',
    'cashier.north.demo.capstonepos@gmail.com'
  )
);

commit;

select
  auth_user.email,
  profile.username,
  profile.role_key,
  profile.status
from public.profiles as profile
left join auth.users as auth_user
  on auth_user.id = profile.id
where auth_user.email in (
  'admin.demo.capstonepos@gmail.com',
  'cashier.main.demo.capstonepos@gmail.com',
  'cashier.north.demo.capstonepos@gmail.com'
)
order by auth_user.email asc;
