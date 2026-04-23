begin;

alter table public.branches
  add column if not exists notes text;

commit;
