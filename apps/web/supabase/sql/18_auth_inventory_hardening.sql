-- Production hardening for the auth-enabled Supabase rollout.
--
-- Run after:
--   - 04_auth_profiles_rollout.sql
--   - 09_auth_role_policies.sql
--   - 10_auth_session_locking.sql
--   - 16_products_barcode_category_quality.sql
--
-- Purpose:
--   1. Keep employee product writes limited to stock_quantity even if someone
--      bypasses the frontend UI and calls the Supabase Data API directly.
--   2. Make the documented one-device session-lock stale timeout effective.

begin;

do $$
begin
  if to_regprocedure('private.current_user_is_admin()') is null
     or to_regprocedure('private.current_user_is_active()') is null then
    raise exception
      'Run 04_auth_profiles_rollout.sql and 09_auth_role_policies.sql before 18_auth_inventory_hardening.sql.';
  end if;
end
$$;

create or replace function public.enforce_employee_product_stock_only()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  -- SQL editor, service-role, and other trusted server contexts do not carry
  -- the authenticated browser role and are left to normal database privileges.
  if coalesce(auth.role(), '') <> 'authenticated' then
    return new;
  end if;

  if private.current_user_is_admin() then
    return new;
  end if;

  if not private.current_user_is_active() then
    raise exception 'Only active accounts can update product stock.'
      using errcode = '42501';
  end if;

  if (to_jsonb(new) - 'stock_quantity') is distinct from
     (to_jsonb(old) - 'stock_quantity') then
    raise exception 'Employee accounts can only update stock quantity for assigned-branch products.'
      using errcode = '42501';
  end if;

  if new.stock_quantity < 0 then
    raise exception 'Stock quantity cannot be negative.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_employee_product_stock_only() from public;

drop trigger if exists zz_enforce_employee_product_stock_only on public.products;
create trigger zz_enforce_employee_product_stock_only
  before update on public.products
  for each row
  execute function public.enforce_employee_product_stock_only();

do $$
begin
  if to_regclass('private.active_session_locks') is null
     or to_regprocedure('private.current_session_id()') is null then
    raise notice
      'Skipping session-lock stale timeout update because 10_auth_session_locking.sql has not been applied.';
    return;
  end if;

  execute $function$
    create or replace function private.claim_session_lock()
    returns boolean
    language plpgsql
    security definer
    set search_path = public, private
    as $inner$
    declare
      current_user_id uuid := auth.uid();
      current_session_id uuid := private.current_session_id();
      locked_session_id uuid;
      locked_heartbeat_at timestamptz;
      locked_session_exists boolean := false;
      lock_is_stale boolean := false;
    begin
      if current_user_id is null or current_session_id is null then
        return false;
      end if;

      select session_id, heartbeat_at
      into locked_session_id, locked_heartbeat_at
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

      lock_is_stale := locked_heartbeat_at < now() - interval '5 minutes';

      select exists (
        select 1
        from auth.sessions
        where id = locked_session_id
          and user_id = current_user_id
      )
      into locked_session_exists;

      if locked_session_exists and not lock_is_stale then
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
    $inner$;
  $function$;

  revoke all on function private.claim_session_lock() from public;
  revoke all on function private.claim_session_lock() from authenticated;
  grant execute on function private.claim_session_lock() to authenticated;
end
$$;

commit;
