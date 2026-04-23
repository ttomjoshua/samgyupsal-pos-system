begin;

create schema if not exists private;

grant usage on schema private to authenticated;

create table if not exists private.active_session_locks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  session_id uuid not null,
  claimed_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now()
);

alter table private.active_session_locks enable row level security;

delete from private.active_session_locks as session_lock
where not exists (
  select 1
  from auth.sessions as auth_session
  where auth_session.id = session_lock.session_id
    and auth_session.user_id = session_lock.user_id
);

revoke all on private.active_session_locks from public;
revoke all on private.active_session_locks from authenticated;

create or replace function private.current_session_id()
returns uuid
language sql
security definer
set search_path = public, private
stable
as $$
  select case
    when nullif(auth.jwt() ->> 'session_id', '') ~* '^[0-9a-f-]{36}$'
      then (auth.jwt() ->> 'session_id')::uuid
    else null
  end;
$$;

revoke all on function private.current_session_id() from public;
revoke all on function private.current_session_id() from authenticated;

create or replace function private.claim_session_lock()
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  current_session_id uuid := private.current_session_id();
  locked_session_id uuid;
  locked_session_exists boolean := false;
begin
  if current_user_id is null or current_session_id is null then
    return false;
  end if;

  select session_id
  into locked_session_id
  from private.active_session_locks
  where user_id = current_user_id
  for update;

  if not found then
    insert into private.active_session_locks (
      user_id,
      session_id,
      claimed_at,
      heartbeat_at
    )
    values (
      current_user_id,
      current_session_id,
      now(),
      now()
    );

    return true;
  end if;

  if locked_session_id = current_session_id then
    update private.active_session_locks
    set heartbeat_at = now()
    where user_id = current_user_id;

    return true;
  end if;

  select exists (
    select 1
    from auth.sessions
    where id = locked_session_id
      and user_id = current_user_id
  )
  into locked_session_exists;

  if locked_session_exists then
    return false;
  end if;

  update private.active_session_locks
  set
    session_id = current_session_id,
    claimed_at = now(),
    heartbeat_at = now()
  where user_id = current_user_id;

  return true;
end;
$$;

create or replace function private.validate_session_lock()
returns boolean
language sql
security definer
set search_path = public, private
as $$
  select private.claim_session_lock();
$$;

create or replace function private.release_session_lock()
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id uuid := auth.uid();
  current_session_id uuid := private.current_session_id();
begin
  if current_user_id is null or current_session_id is null then
    return true;
  end if;

  delete from private.active_session_locks
  where user_id = current_user_id
    and session_id = current_session_id;

  return true;
end;
$$;

revoke all on function private.claim_session_lock() from public;
revoke all on function private.claim_session_lock() from authenticated;
revoke all on function private.validate_session_lock() from public;
revoke all on function private.validate_session_lock() from authenticated;
revoke all on function private.release_session_lock() from public;
revoke all on function private.release_session_lock() from authenticated;

grant execute on function private.claim_session_lock() to authenticated;
grant execute on function private.validate_session_lock() to authenticated;
grant execute on function private.release_session_lock() to authenticated;

create or replace function public.claim_session_lock()
returns boolean
language sql
security invoker
set search_path = public, private
as $$
  select private.claim_session_lock();
$$;

create or replace function public.validate_session_lock()
returns boolean
language sql
security invoker
set search_path = public, private
as $$
  select private.validate_session_lock();
$$;

create or replace function public.release_session_lock()
returns boolean
language sql
security invoker
set search_path = public, private
as $$
  select private.release_session_lock();
$$;

revoke all on function public.claim_session_lock() from public;
revoke all on function public.validate_session_lock() from public;
revoke all on function public.release_session_lock() from public;

grant execute on function public.claim_session_lock() to authenticated;
grant execute on function public.validate_session_lock() to authenticated;
grant execute on function public.release_session_lock() to authenticated;

commit;
