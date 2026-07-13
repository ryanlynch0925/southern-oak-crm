-- 015_role_permissions.sql
-- Role permissions:
-- - owner: full system access
-- - admin: full operational access
-- - office: estimates, customers, scheduling, payments, and invoices
-- - field: view-only calendar/scheduled-work access

-- Expand allowed application roles.
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('owner', 'admin', 'office', 'field'));

-- Central role helpers for RLS policies.
create or replace function public.has_app_role(allowed_roles text[])
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = any(allowed_roles)
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.has_app_role(array['owner']);
$$;

-- Preserve existing public.is_admin() semantics for full-access users.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.has_app_role(array['owner', 'admin']);
$$;

create or replace function public.can_manage_operations()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.has_app_role(array['owner', 'admin', 'office']);
$$;

create or replace function public.can_view_calendar()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.has_app_role(array['owner', 'admin', 'office', 'field']);
$$;

create or replace function public.can_manage_calendar()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.has_app_role(array['owner', 'admin', 'office']);
$$;

-- Prevent users from self-creating or self-changing their app role.
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Owners can manage profiles" on public.profiles;

create policy "Owners can manage profiles"
on public.profiles
for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

grant select on table public.profiles to authenticated;
grant insert, update, delete on table public.profiles to authenticated;

-- Base table grants. RLS below narrows what each app role can actually do.
grant select, insert, update, delete on table public.customers to authenticated;
grant select, insert, update, delete on table public.estimates to authenticated;
grant select, insert, update, delete on table public.jobs to authenticated;
grant select, insert, update, delete on table public.schedule_events to authenticated;
grant select, insert, update, delete on table public.crews to authenticated;
grant select, insert, update, delete on table public.builders to authenticated;
grant select, insert, update, delete on table public.invoices to authenticated;
grant select, insert, update, delete on table public.payments to authenticated;
grant select, insert, update, delete on table public.expenses to authenticated;

grant select on table public.schedule_calendar_view to authenticated;
grant select on table public.invoice_payment_summary to authenticated;
grant select on table public.finance_dashboard_summary to authenticated;
grant select on table public.estimate_dashboard_summary to authenticated;
grant select on table public.job_dashboard_summary to authenticated;
grant select on table public.customer_type_summary to authenticated;

-- Make reporting views respect caller RLS on underlying tables where supported.
alter view public.schedule_calendar_view set (security_invoker = true);
alter view public.invoice_payment_summary set (security_invoker = true);
alter view public.finance_dashboard_summary set (security_invoker = true);
alter view public.estimate_dashboard_summary set (security_invoker = true);
alter view public.job_dashboard_summary set (security_invoker = true);
alter view public.customer_type_summary set (security_invoker = true);

-- Customers: office can manage, field can only see customers attached to scheduled work.
drop policy if exists "Owners and admins can view customers" on public.customers;
drop policy if exists "Owners and admins can insert customers" on public.customers;
drop policy if exists "Owners and admins can update customers" on public.customers;
drop policy if exists "Owners and admins can delete customers" on public.customers;

create policy "Operational users can view customers"
on public.customers
for select
to authenticated
using (
  public.can_manage_operations()
  or (
    public.has_app_role(array['field'])
    and exists (
      select 1
      from public.jobs j
      join public.schedule_events se
        on se.job_id = j.id
      where j.customer_id = customers.id
    )
  )
);

create policy "Operational users can create customers"
on public.customers
for insert
to authenticated
with check (public.can_manage_operations());

create policy "Operational users can update customers"
on public.customers
for update
to authenticated
using (public.can_manage_operations())
with check (public.can_manage_operations());

create policy "Full access users can delete customers"
on public.customers
for delete
to authenticated
using (public.is_admin());

-- Estimates: office can manage; field has no estimate administration access.
drop policy if exists "Owners and admins can view estimates" on public.estimates;
drop policy if exists "Owners and admins can insert estimates" on public.estimates;
drop policy if exists "Owners and admins can update estimates" on public.estimates;
drop policy if exists "Owners and admins can delete estimates" on public.estimates;

create policy "Operational users can view estimates"
on public.estimates
for select
to authenticated
using (public.can_manage_operations());

create policy "Operational users can create estimates"
on public.estimates
for insert
to authenticated
with check (public.can_manage_operations());

create policy "Operational users can update estimates"
on public.estimates
for update
to authenticated
using (public.can_manage_operations())
with check (public.can_manage_operations());

create policy "Full access users can delete estimates"
on public.estimates
for delete
to authenticated
using (public.is_admin());

-- Jobs: field can view jobs that have scheduled calendar events only.
drop policy if exists "Owners and admins can view jobs" on public.jobs;
drop policy if exists "Owners and admins can insert jobs" on public.jobs;
drop policy if exists "Owners and admins can update jobs" on public.jobs;
drop policy if exists "Owners and admins can delete jobs" on public.jobs;

create policy "Calendar users can view scheduled jobs"
on public.jobs
for select
to authenticated
using (
  public.can_manage_calendar()
  or (
    public.has_app_role(array['field'])
    and exists (
      select 1
      from public.schedule_events se
      where se.job_id = jobs.id
    )
  )
);

create policy "Calendar managers can create jobs"
on public.jobs
for insert
to authenticated
with check (public.can_manage_calendar());

create policy "Calendar managers can update jobs"
on public.jobs
for update
to authenticated
using (public.can_manage_calendar())
with check (public.can_manage_calendar());

create policy "Full access users can delete jobs"
on public.jobs
for delete
to authenticated
using (public.is_admin());

-- Schedule events: field is SELECT-only.
drop policy if exists "Owners and admins can view schedule events" on public.schedule_events;
drop policy if exists "Owners and admins can insert schedule events" on public.schedule_events;
drop policy if exists "Owners and admins can update schedule events" on public.schedule_events;
drop policy if exists "Owners and admins can delete schedule events" on public.schedule_events;

create policy "Calendar users can view schedule events"
on public.schedule_events
for select
to authenticated
using (public.can_view_calendar());

create policy "Calendar managers can create schedule events"
on public.schedule_events
for insert
to authenticated
with check (public.can_manage_calendar());

create policy "Calendar managers can update schedule events"
on public.schedule_events
for update
to authenticated
using (public.can_manage_calendar())
with check (public.can_manage_calendar());

create policy "Calendar managers can delete schedule events"
on public.schedule_events
for delete
to authenticated
using (public.can_manage_calendar());

-- Crews: field can view crew assignment labels only; no writes.
drop policy if exists "Owners and admins can view crews" on public.crews;
drop policy if exists "Owners and admins can insert crews" on public.crews;
drop policy if exists "Owners and admins can update crews" on public.crews;
drop policy if exists "Owners and admins can delete crews" on public.crews;
drop policy if exists "Authenticated users can view crews" on public.crews;
drop policy if exists "Authenticated users can create crews" on public.crews;
drop policy if exists "Authenticated users can update crews" on public.crews;

create policy "Calendar users can view crews"
on public.crews
for select
to authenticated
using (public.can_view_calendar());

create policy "Calendar managers can create crews"
on public.crews
for insert
to authenticated
with check (public.can_manage_calendar());

create policy "Calendar managers can update crews"
on public.crews
for update
to authenticated
using (public.can_manage_calendar())
with check (public.can_manage_calendar());

create policy "Full access users can delete crews"
on public.crews
for delete
to authenticated
using (public.is_admin());

-- Builders: remove broad authenticated write access from field users.
drop policy if exists "Authenticated users can view builders" on public.builders;
drop policy if exists "Authenticated users can create builders" on public.builders;
drop policy if exists "Authenticated users can update builders" on public.builders;

create policy "Operational users can view builders"
on public.builders
for select
to authenticated
using (public.can_manage_operations());

create policy "Full access users can create builders"
on public.builders
for insert
to authenticated
with check (public.is_admin());

create policy "Full access users can update builders"
on public.builders
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Invoices and payments: office can manage these. Expenses stay owner/admin.
drop policy if exists "Owners and admins can view invoices" on public.invoices;
drop policy if exists "Owners and admins can insert invoices" on public.invoices;
drop policy if exists "Owners and admins can update invoices" on public.invoices;
drop policy if exists "Owners and admins can delete invoices" on public.invoices;
drop policy if exists "Owners and admins can view payments" on public.payments;
drop policy if exists "Owners and admins can insert payments" on public.payments;
drop policy if exists "Owners and admins can update payments" on public.payments;
drop policy if exists "Owners and admins can delete payments" on public.payments;

create policy "Operational users can view invoices"
on public.invoices
for select
to authenticated
using (public.can_manage_operations());

create policy "Operational users can create invoices"
on public.invoices
for insert
to authenticated
with check (public.can_manage_operations());

create policy "Operational users can update invoices"
on public.invoices
for update
to authenticated
using (public.can_manage_operations())
with check (public.can_manage_operations());

create policy "Full access users can delete invoices"
on public.invoices
for delete
to authenticated
using (public.is_admin());

create policy "Operational users can view payments"
on public.payments
for select
to authenticated
using (public.can_manage_operations());

create policy "Operational users can create payments"
on public.payments
for insert
to authenticated
with check (public.can_manage_operations());

create policy "Operational users can update payments"
on public.payments
for update
to authenticated
using (public.can_manage_operations())
with check (public.can_manage_operations());

create policy "Full access users can delete payments"
on public.payments
for delete
to authenticated
using (public.is_admin());
