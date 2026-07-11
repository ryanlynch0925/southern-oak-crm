-- 010_test_queries.sql
-- Southern Oak CRM - Test Queries

select *
from public.customers
order by created_at desc;

select *
from public.estimates
order by created_at desc;

select *
from public.jobs
order by created_at desc;

select *
from public.schedule_calendar_view
order by scheduled_date asc;

select *
from public.invoice_payment_summary;

select *
from public.finance_dashboard_summary;

select *
from public.estimate_dashboard_summary;

select *
from public.job_dashboard_summary;

select *
from public.customer_type_summary;