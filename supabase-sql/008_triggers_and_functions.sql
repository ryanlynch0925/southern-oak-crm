-- 008_triggers_and_functions.sql
-- Southern Oak CRM - Triggers and Automation Functions

-- Generic function to update updated_at automatically.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profiles updated_at trigger
drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- Customers updated_at trigger
drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at
before update on public.customers
for each row
execute function public.set_updated_at();

-- Estimates updated_at trigger
drop trigger if exists set_estimates_updated_at on public.estimates;
create trigger set_estimates_updated_at
before update on public.estimates
for each row
execute function public.set_updated_at();

-- Jobs updated_at trigger
drop trigger if exists set_jobs_updated_at on public.jobs;
create trigger set_jobs_updated_at
before update on public.jobs
for each row
execute function public.set_updated_at();

-- Crews updated_at trigger
drop trigger if exists set_crews_updated_at on public.crews;
create trigger set_crews_updated_at
before update on public.crews
for each row
execute function public.set_updated_at();

-- Schedule events updated_at trigger
drop trigger if exists set_schedule_events_updated_at on public.schedule_events;
create trigger set_schedule_events_updated_at
before update on public.schedule_events
for each row
execute function public.set_updated_at();

-- Invoices updated_at trigger
drop trigger if exists set_invoices_updated_at on public.invoices;
create trigger set_invoices_updated_at
before update on public.invoices
for each row
execute function public.set_updated_at();

-- Payments updated_at trigger
drop trigger if exists set_payments_updated_at on public.payments;
create trigger set_payments_updated_at
before update on public.payments
for each row
execute function public.set_updated_at();

-- Expenses updated_at trigger
drop trigger if exists set_expenses_updated_at on public.expenses;
create trigger set_expenses_updated_at
before update on public.expenses
for each row
execute function public.set_updated_at();


-- Function:
-- Automatically sets accepted_at or declined_at based on estimate status.
create or replace function public.set_estimate_decision_dates()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    new.accepted_at = now();
  end if;

  if new.status = 'declined' and old.status is distinct from 'declined' then
    new.declined_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists set_estimate_decision_dates_trigger on public.estimates;
create trigger set_estimate_decision_dates_trigger
before update on public.estimates
for each row
execute function public.set_estimate_decision_dates();


-- Function:
-- Automatically creates a job when an estimate changes to accepted.
-- This prevents duplicate jobs by checking if a job already exists for that estimate.
create or replace function public.create_job_from_accepted_estimate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted'
     and old.status is distinct from 'accepted'
     and not exists (
       select 1
       from public.jobs
       where estimate_id = new.id
     )
  then
    insert into public.jobs (
      customer_id,
      estimate_id,
      job_name,
      job_address,
      job_type,
      status,
      description,
      notes
    )
    values (
      new.customer_id,
      new.id,
      initcap(replace(new.job_type, '_', ' ')) || ' Job',
      new.job_address,
      new.job_type,
      'unscheduled',
      new.description,
      'Auto-created from accepted estimate.'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists create_job_from_accepted_estimate_trigger on public.estimates;
create trigger create_job_from_accepted_estimate_trigger
after update on public.estimates
for each row
execute function public.create_job_from_accepted_estimate();


-- Function:
-- Updates invoice status based on payments.
-- This keeps invoices marked as draft/sent/partial/paid based on payment totals.
create or replace function public.update_invoice_status_from_payments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_invoice_id uuid;
  invoice_total numeric(12, 2);
  paid_total numeric(12, 2);
begin
  target_invoice_id = coalesce(new.invoice_id, old.invoice_id);

  select total_amount
  into invoice_total
  from public.invoices
  where id = target_invoice_id;

  select coalesce(sum(amount), 0)
  into paid_total
  from public.payments
  where invoice_id = target_invoice_id;

  update public.invoices
  set status =
    case
      when paid_total <= 0 then status
      when paid_total < invoice_total then 'partial'
      when paid_total >= invoice_total then 'paid'
      else status
    end,
    updated_at = now()
  where id = target_invoice_id;

  return null;
end;
$$;

drop trigger if exists update_invoice_status_after_payment_insert on public.payments;
create trigger update_invoice_status_after_payment_insert
after insert on public.payments
for each row
execute function public.update_invoice_status_from_payments();

drop trigger if exists update_invoice_status_after_payment_update on public.payments;
create trigger update_invoice_status_after_payment_update
after update on public.payments
for each row
execute function public.update_invoice_status_from_payments();

drop trigger if exists update_invoice_status_after_payment_delete on public.payments;
create trigger update_invoice_status_after_payment_delete
after delete on public.payments
for each row
execute function public.update_invoice_status_from_payments();