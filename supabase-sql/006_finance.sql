-- 006_finance.sql
-- Southern Oak CRM - Finance Tables
-- Includes invoices, payments, and expenses.

-- Invoices connect to jobs and customers.
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),

  job_id uuid references public.jobs(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete cascade,

  invoice_number text unique,
  invoice_date date not null default current_date,
  due_date date,

  subtotal numeric(12, 2) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,

  status text not null default 'draft',

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- Payments connect to invoices.
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),

  invoice_id uuid not null references public.invoices(id) on delete cascade,

  payment_date date not null default current_date,
  amount numeric(12, 2) not null,

  payment_method text,
  reference_number text,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- Expenses can connect to a job, but they do not have to.
-- This lets the owner track both job-specific expenses and general business expenses.
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),

  job_id uuid references public.jobs(id) on delete set null,

  expense_date date not null default current_date,
  category text not null default 'other',

  vendor text,
  description text not null,

  amount numeric(12, 2) not null,

  payment_method text,
  receipt_url text,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- Restrict invoice status values.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'invoices_status_check'
  ) then
    alter table public.invoices
    add constraint invoices_status_check
    check (
      status in (
        'draft',
        'sent',
        'partial',
        'paid',
        'overdue',
        'cancelled'
      )
    );
  end if;
end $$;

-- Restrict expense category values.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'expenses_category_check'
  ) then
    alter table public.expenses
    add constraint expenses_category_check
    check (
      category in (
        'material',
        'labor',
        'fuel',
        'equipment',
        'subcontractor',
        'dump_fee',
        'office',
        'software',
        'insurance',
        'general',
        'other'
      )
    );
  end if;
end $$;

-- Prevent negative invoice/payment/expense amounts.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'invoices_amounts_nonnegative_check'
  ) then
    alter table public.invoices
    add constraint invoices_amounts_nonnegative_check
    check (
      subtotal >= 0
      and tax_amount >= 0
      and total_amount >= 0
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payments_amount_positive_check'
  ) then
    alter table public.payments
    add constraint payments_amount_positive_check
    check (amount > 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'expenses_amount_positive_check'
  ) then
    alter table public.expenses
    add constraint expenses_amount_positive_check
    check (amount > 0);
  end if;
end $$;

-- Enable Row Level Security.
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;

-- Invoice policies

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'invoices'
      and policyname = 'Owners and admins can view invoices'
  ) then
    create policy "Owners and admins can view invoices"
    on public.invoices
    for select
    to authenticated
    using (public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'invoices'
      and policyname = 'Owners and admins can insert invoices'
  ) then
    create policy "Owners and admins can insert invoices"
    on public.invoices
    for insert
    to authenticated
    with check (public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'invoices'
      and policyname = 'Owners and admins can update invoices'
  ) then
    create policy "Owners and admins can update invoices"
    on public.invoices
    for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'invoices'
      and policyname = 'Owners and admins can delete invoices'
  ) then
    create policy "Owners and admins can delete invoices"
    on public.invoices
    for delete
    to authenticated
    using (public.is_admin());
  end if;
end $$;

-- Payment policies

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payments'
      and policyname = 'Owners and admins can view payments'
  ) then
    create policy "Owners and admins can view payments"
    on public.payments
    for select
    to authenticated
    using (public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payments'
      and policyname = 'Owners and admins can insert payments'
  ) then
    create policy "Owners and admins can insert payments"
    on public.payments
    for insert
    to authenticated
    with check (public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payments'
      and policyname = 'Owners and admins can update payments'
  ) then
    create policy "Owners and admins can update payments"
    on public.payments
    for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payments'
      and policyname = 'Owners and admins can delete payments'
  ) then
    create policy "Owners and admins can delete payments"
    on public.payments
    for delete
    to authenticated
    using (public.is_admin());
  end if;
end $$;

-- Expense policies

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'expenses'
      and policyname = 'Owners and admins can view expenses'
  ) then
    create policy "Owners and admins can view expenses"
    on public.expenses
    for select
    to authenticated
    using (public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'expenses'
      and policyname = 'Owners and admins can insert expenses'
  ) then
    create policy "Owners and admins can insert expenses"
    on public.expenses
    for insert
    to authenticated
    with check (public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'expenses'
      and policyname = 'Owners and admins can update expenses'
  ) then
    create policy "Owners and admins can update expenses"
    on public.expenses
    for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'expenses'
      and policyname = 'Owners and admins can delete expenses'
  ) then
    create policy "Owners and admins can delete expenses"
    on public.expenses
    for delete
    to authenticated
    using (public.is_admin());
  end if;
end $$;