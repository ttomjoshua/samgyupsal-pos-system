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

create index if not exists idx_profiles_branch_id
  on public.profiles (branch_id);

create index if not exists idx_profiles_role_key
  on public.profiles (role_key);

commit;
