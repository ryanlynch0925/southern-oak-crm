-- 023_customer_lifecycle.sql
-- Adds customer lifecycle state for read/write customer management.

begin;

alter table public.customers
  add column if not exists is_active boolean;

update public.customers
set is_active = true
where is_active is null;

alter table public.customers
  alter column is_active set default true,
  alter column is_active set not null;

create index if not exists customers_is_active_idx
on public.customers(is_active);

commit;
