-- Read-only audit for accepted estimates that do not currently have a linked job.
-- Run deliberately outside migration 027 when reviewing historical data quality.

select
  e.id as estimate_id,
  e.customer_id,
  e.status,
  e.workflow_status,
  e.accepted_at,
  e.declined_at,
  e.updated_at
from public.estimates e
left join public.jobs j
  on j.estimate_id = e.id
where e.status = 'accepted'
group by
  e.id,
  e.customer_id,
  e.status,
  e.workflow_status,
  e.accepted_at,
  e.declined_at,
  e.updated_at
having count(j.id) = 0
order by e.updated_at desc nulls last, e.id;
