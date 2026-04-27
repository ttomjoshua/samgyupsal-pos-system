-- Data-only cleanup for Samgyupsal POS.
-- Purpose: remove operational rehearsal rows while preserving schema, auth users,
-- public profiles, branch reference records, RLS policies, grants, functions,
-- views, and table/column definitions.
--
-- Run this in the Supabase SQL Editor or through a privileged Postgres session.
-- It intentionally does not drop, rename, create, or alter tables/columns.
--
-- Supabase SQL Editor note:
-- This script avoids temp tables because SQL Editor connection/transaction
-- behavior can make temp-table lifetime unreliable.

begin;

do $$
declare
  table_name text;
  current_table_name text;
  sequence_name text;
  before_rows bigint;
  after_rows bigint;
  cleanup_action text;
  verification_note text;
  audit_rows jsonb := '[]'::jsonb;
begin
  foreach table_name in array array[
    'branches',
    'profiles',
    'products',
    'sales',
    'sale_items',
    'categories',
    'inventory_items',
    'products_legacy',
    'sale_items_legacy',
    'private.active_session_locks'
  ]
  loop
    if table_name = 'private.active_session_locks' then
      if to_regclass(table_name) is not null then
        execute 'select count(*) from private.active_session_locks'
        into before_rows;
      else
        before_rows := null;
      end if;
    elsif to_regclass(format('public.%I', table_name)) is not null then
      execute format('select count(*) from public.%I', table_name)
      into before_rows;
    else
      before_rows := null;
    end if;

    cleanup_action := case
      when table_name in ('branches', 'profiles') then 'preserve rows'
      when table_name in ('sale_items', 'sales') then 'delete transactional rows'
      when table_name = 'products' then 'delete active catalog/inventory rows'
      when table_name in ('categories', 'inventory_items') then 'delete legacy normalized rows if table remains'
      when table_name in ('products_legacy', 'sale_items_legacy') then 'delete obsolete legacy rows if table remains'
      when table_name = 'private.active_session_locks' then 'delete ephemeral session-lock rows'
      else 'inspect only'
    end;

    audit_rows := audit_rows || jsonb_build_array(
      jsonb_build_object(
        'table_name', table_name,
        'before_rows', before_rows,
        'cleanup_action', cleanup_action
      )
    );
  end loop;

  -- Delete children before parents. This avoids relying on CASCADE behavior and
  -- keeps the cleanup explicit. Some legacy tables may not exist in cleaned
  -- projects, so every delete is guarded dynamically.
  if to_regclass('public.sale_items') is not null then
    execute 'delete from public.sale_items';
  end if;

  if to_regclass('public.sales') is not null then
    execute 'delete from public.sales';
  end if;

  if to_regclass('public.inventory_items') is not null then
    execute 'delete from public.inventory_items';
  end if;

  -- In the current flattened model, products are the branch catalog and stock
  -- source of truth. Removing them leaves branches/profiles/auth intact for
  -- fresh future catalog inserts.
  if to_regclass('public.products') is not null then
    execute 'delete from public.products';
  end if;

  if to_regclass('public.categories') is not null then
    execute 'delete from public.categories';
  end if;

  if to_regclass('public.sale_items_legacy') is not null then
    execute 'delete from public.sale_items_legacy';
  end if;

  if to_regclass('public.products_legacy') is not null then
    execute 'delete from public.products_legacy';
  end if;

  if to_regclass('private.active_session_locks') is not null then
    execute 'delete from private.active_session_locks';
  end if;

  -- Preserve public.branches and public.profiles rows. They are reference/auth
  -- linkage data used for login, role scope, and branch assignment.

  -- Reset identity/serial counters only for tables we emptied. Branch/profile
  -- counters are deliberately not reset because their rows are preserved.
  foreach table_name in array array[
    'sale_items',
    'sales',
    'products',
    'inventory_items',
    'categories',
    'sale_items_legacy',
    'products_legacy'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      select pg_get_serial_sequence(format('public.%I', table_name), 'id')
      into sequence_name;

      if sequence_name is not null then
        execute format('select setval(%L, 1, false)', sequence_name);
      end if;
    end if;
  end loop;

  audit_rows := (
    select jsonb_agg(
      row_data || jsonb_build_object(
        'after_rows',
        case
          when row_data->>'table_name' = 'private.active_session_locks'
            and to_regclass('private.active_session_locks') is not null
            then (select count(*) from private.active_session_locks)
          when row_data->>'table_name' <> 'private.active_session_locks'
            and to_regclass(format('public.%I', row_data->>'table_name')) is not null
            then (
              select count_result
              from (
                select null::bigint as count_result
              ) as placeholder
            )
          else null
        end,
        'verification_note',
        case
          when row_data->>'table_name' in ('branches', 'profiles') then 'preserved'
          when row_data->>'before_rows' is null then 'table not present'
          else 'expected zero after cleanup'
        end
      )
    )
    from jsonb_array_elements(audit_rows) as row_data
  );

  -- Fill dynamic public table after-counts. This is separate because dynamic
  -- table names cannot be safely counted inside a static SELECT expression.
  for current_table_name in
    select row_data->>'table_name'
    from jsonb_array_elements(audit_rows) as row_data
    where row_data->>'table_name' <> 'private.active_session_locks'
  loop
    if to_regclass(format('public.%I', current_table_name)) is not null then
      execute format('select count(*) from public.%I', current_table_name)
      into after_rows;
    else
      after_rows := null;
    end if;

    audit_rows := (
      select jsonb_agg(
        case
          when row_data->>'table_name' = current_table_name then
            row_data || jsonb_build_object('after_rows', after_rows)
          else
            row_data
        end
      )
      from jsonb_array_elements(audit_rows) as row_data
    );
  end loop;

  if to_regclass('private.active_session_locks') is not null then
    execute 'select count(*) from private.active_session_locks'
    into after_rows;
  else
    after_rows := null;
  end if;

  audit_rows := (
    select jsonb_agg(
      case
        when row_data->>'table_name' = 'private.active_session_locks' then
          row_data || jsonb_build_object('after_rows', after_rows)
        else
          row_data
      end
    )
    from jsonb_array_elements(audit_rows) as row_data
  );

  perform set_config('app.cleanup_audit', audit_rows::text, true);
end $$;

select
  audit.table_name,
  audit.before_rows,
  audit.after_rows,
  audit.cleanup_action,
  audit.verification_note
from jsonb_to_recordset(current_setting('app.cleanup_audit', true)::jsonb) as audit(
  table_name text,
  before_rows bigint,
  after_rows bigint,
  cleanup_action text,
  verification_note text
)
order by
  case audit.table_name
    when 'branches' then 1
    when 'profiles' then 2
    when 'sale_items' then 3
    when 'sales' then 4
    when 'products' then 5
    when 'inventory_items' then 6
    when 'categories' then 7
    when 'sale_items_legacy' then 8
    when 'products_legacy' then 9
    when 'private.active_session_locks' then 10
    else 99
  end;

-- For a dry run, change the final COMMIT to ROLLBACK before running.
commit;
