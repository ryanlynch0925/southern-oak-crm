-- 007_views_and_reports.sql
-- Southern Oak CRM - Dashboard Views and Reports
-- These views make the frontend dashboard easier to build.

-- Invoice payment summary
-- Shows each invoice, how much has been paid, and remaining balance.
create or replace view public.invoice_payment_summary as
select
  i.id as invoice_id,
  i.customer_id,
  i.job_id,
  i.invoice_number,
  i.invoice_date,
  i.due_date,
  i.total_amount,
  i.status,
  coalesce(sum(p.amount), 0) as amount_paid,
  i.total_amount - coalesce(sum(p.amount), 0) as balance_due
from public.invoices i
left join public.payments p
  on p.invoice_id = i.id
group by
  i.id,
  i.customer_id,
  i.job_id,
  i.invoice_number,
  i.invoice_date,
  i.due_date,
  i.total_amount,
  i.status;

-- Finance dashboard summary
-- One-row view for total revenue, unpaid balance, expenses, and profit.
create or replace view public.finance_dashboard_summary as
select
  coalesce((
    select sum(amount)
    from public.payments
  ), 0) as total_revenue,

  coalesce((
    select sum(balance_due)
    from public.invoice_payment_summary
  ), 0) as unpaid_balance,

  coalesce((
    select sum(amount)
    from public.expenses
  ), 0) as total_expenses,

  coalesce((
    select sum(amount)
    from public.payments
  ), 0)
  -
  coalesce((
    select sum(amount)
    from public.expenses
  ), 0) as net_profit;

-- Estimate dashboard summary
-- Counts estimate statuses for the admin dashboard.
create or replace view public.estimate_dashboard_summary as
select
  count(*) as total_estimates,

  count(*) filter (
    where status = 'pending'
  ) as pending_estimates,

  count(*) filter (
    where status = 'accepted'
  ) as accepted_estimates,

  count(*) filter (
    where status = 'declined'
  ) as declined_estimates,

  count(*) filter (
    where status = 'not_sure'
  ) as not_sure_estimates,

  count(*) filter (
    where follow_up_needed = true
  ) as follow_up_needed
from public.estimates;

-- Job dashboard summary
-- Counts jobs by current status.
create or replace view public.job_dashboard_summary as
select
  count(*) as total_jobs,

  count(*) filter (
    where status = 'unscheduled'
  ) as unscheduled_jobs,

  count(*) filter (
    where status = 'scheduled'
  ) as scheduled_jobs,

  count(*) filter (
    where status = 'in_progress'
  ) as in_progress_jobs,

  count(*) filter (
    where status = 'completed'
  ) as completed_jobs,

  count(*) filter (
    where status = 'delayed'
  ) as delayed_jobs,

  count(*) filter (
    where status = 'cancelled'
  ) as cancelled_jobs
from public.jobs;

-- Customer split summary
-- Useful for builder vs residential chart.
create or replace view public.customer_type_summary as
select
  customer_type,
  count(*) as customer_count
from public.customers
group by customer_type
order by customer_type;

-- Schedule calendar view
-- Gives the frontend a cleaner calendar-ready dataset.
create or replace view public.schedule_calendar_view as
select
  se.id as schedule_event_id,
  se.scheduled_date,
  se.start_time,
  se.end_time,
  se.status as schedule_status,
  se.work_order_number,
  se.builder_step,

  j.id as job_id,
  j.job_name,
  j.job_address,
  j.job_type,
  j.status as job_status,

  c.id as customer_id,
  c.first_name,
  c.last_name,
  c.company_name,
  c.phone,
  c.email,

  cr.id as crew_id,
  cr.crew_number,
  cr.crew_name,
  cr.lead_name
from public.schedule_events se
join public.jobs j
  on j.id = se.job_id
join public.customers c
  on c.id = j.customer_id
left join public.crews cr
  on cr.id = se.crew_id;