begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  full_name text,
  role_key text not null default 'employee' check (role_key in ('admin', 'employee')),
  branch_id integer references public.branches (id) on update cascade on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  alter column role_key set default 'employee',
  alter column status set default 'active',
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.profiles
  drop constraint if exists profiles_role_key_check;

alter table public.profiles
  add constraint profiles_role_key_check
  check (role_key in ('admin', 'employee'));

alter table public.profiles
  drop constraint if exists profiles_status_check;

alter table public.profiles
  add constraint profiles_status_check
  check (status in ('active', 'inactive'));

create index if not exists idx_profiles_branch_id
  on public.profiles (branch_id);

create index if not exists idx_profiles_role_key
  on public.profiles (role_key);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    username,
    full_name,
    role_key,
    branch_id,
    status,
    created_at,
    updated_at
  )
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'username', '')), ''),
    nullif(
      trim(
        coalesce(
          new.raw_user_meta_data ->> 'full_name',
          new.raw_user_meta_data ->> 'name',
          split_part(coalesce(new.email, ''), '@', 1)
        )
      ),
      ''
    ),
    case
      when coalesce(new.raw_app_meta_data ->> 'role_key', '') in ('admin', 'employee')
        then new.raw_app_meta_data ->> 'role_key'
      else 'employee'
    end,
    case
      when coalesce(new.raw_app_meta_data ->> 'branch_id', '') ~ '^\d+$'
        then (new.raw_app_meta_data ->> 'branch_id')::integer
      else null
    end,
    case
      when coalesce(new.raw_app_meta_data ->> 'status', '') in ('active', 'inactive')
        then new.raw_app_meta_data ->> 'status'
      else 'active'
    end,
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (id) do update
    set
      username = coalesce(nullif(excluded.username, ''), public.profiles.username),
      full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

insert into public.profiles (
  id,
  username,
  full_name,
  role_key,
  branch_id,
  status,
  created_at,
  updated_at
)
select
  auth_user.id,
  nullif(trim(coalesce(auth_user.raw_user_meta_data ->> 'username', '')), ''),
  nullif(
    trim(
      coalesce(
        auth_user.raw_user_meta_data ->> 'full_name',
        auth_user.raw_user_meta_data ->> 'name',
        split_part(coalesce(auth_user.email, ''), '@', 1)
      )
    ),
    ''
  ),
  case
    when coalesce(auth_user.raw_app_meta_data ->> 'role_key', '') in ('admin', 'employee')
      then auth_user.raw_app_meta_data ->> 'role_key'
    else 'employee'
  end,
  case
    when coalesce(auth_user.raw_app_meta_data ->> 'branch_id', '') ~ '^\d+$'
      then (auth_user.raw_app_meta_data ->> 'branch_id')::integer
    else null
  end,
  case
    when coalesce(auth_user.raw_app_meta_data ->> 'status', '') in ('active', 'inactive')
      then auth_user.raw_app_meta_data ->> 'status'
    else 'active'
  end,
  coalesce(auth_user.created_at, now()),
  now()
from auth.users as auth_user
left join public.profiles as profile
  on profile.id = auth_user.id
where profile.id is null;

create or replace function public.current_user_is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role_key = 'admin'
      and status = 'active'
  );
$$;

revoke all on function public.current_user_is_admin() from public;
grant execute on function public.current_user_is_admin() to authenticated;

do $$
begin
  if exists (
    select 1
    from pg_proc as proc
    inner join pg_namespace as namespace
      on namespace.oid = proc.pronamespace
    where proc.proname = 'set_updated_at'
      and namespace.nspname = 'public'
  ) then
    drop trigger if exists set_profiles_updated_at on public.profiles;

    create trigger set_profiles_updated_at
      before update on public.profiles
      for each row execute function public.set_updated_at();
  end if;
end
$$;

grant select, update on public.profiles to authenticated;

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
  on public.profiles
  for select
  to authenticated
  using (public.current_user_is_admin());

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles
  for update
  to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

commit;
