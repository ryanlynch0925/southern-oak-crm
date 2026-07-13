-- 013_extend_estimates_and_public_submission.sql

-- =========================================================
-- 1. Extend the estimates table for the website estimator
-- =========================================================

alter table public.estimates
  add column if not exists length_ft numeric,
  add column if not exists width_ft numeric,
  add column if not exists square_feet numeric,
  add column if not exists thickness_in numeric,

  add column if not exists finish_type text,
  add column if not exists tear_out text,
  add column if not exists grading text,
  add column if not exists site_access text,
  add column if not exists desired_timeline text,

  add column if not exists rough_estimate_low numeric,
  add column if not exists rough_estimate_high numeric,
  add column if not exists final_quote_amount numeric,

  add column if not exists follow_up_date date,

  add column if not exists estimate_decision text,
  add column if not exists decision_question text,
  add column if not exists decision_at timestamptz,
  add column if not exists decision_feedback_reason text,
  add column if not exists decision_feedback_comment text,

  add column if not exists admin_notes text,

  add column if not exists attachments jsonb
    not null default '[]'::jsonb,

  add column if not exists notifications jsonb
    not null default '[]'::jsonb,

  add column if not exists source text
    not null default 'website';


-- =========================================================
-- 2. Helpful indexes
-- =========================================================

create index if not exists estimates_customer_id_idx
  on public.estimates(customer_id);

create index if not exists estimates_status_idx
  on public.estimates(status);

create index if not exists estimates_submitted_at_idx
  on public.estimates(submitted_at desc);

create index if not exists estimates_follow_up_date_idx
  on public.estimates(follow_up_date);


-- =========================================================
-- 3. Public estimate submission function
--
-- Anonymous visitors receive EXECUTE permission on this
-- function only. They do not receive direct table access.
-- =========================================================

create or replace function public.submit_public_estimate(
  payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_customer_id uuid;
  new_estimate_id uuid;

  submitted_name text;
  submitted_first_name text;
  submitted_last_name text;
  submitted_job_address text;
begin
  submitted_name :=
    nullif(trim(payload ->> 'name'), '');

  submitted_first_name :=
    coalesce(
      nullif(trim(payload ->> 'first_name'), ''),
      submitted_name
    );

  submitted_last_name :=
    nullif(trim(payload ->> 'last_name'), '');

  if submitted_first_name is null then
    raise exception 'Customer name is required.';
  end if;

  if nullif(trim(payload ->> 'job_type'), '') is null then
    raise exception 'Job type is required.';
  end if;

  submitted_job_address :=
    coalesce(
      nullif(trim(payload ->> 'job_address'), ''),
      nullif(
        concat_ws(
          ', ',
          nullif(trim(payload ->> 'street_address'), ''),
          nullif(trim(payload ->> 'city'), ''),
          nullif(trim(payload ->> 'state'), ''),
          nullif(trim(payload ->> 'zip_code'), '')
        ),
        ''
      )
    );

  insert into public.customers (
    first_name,
    last_name,
    company_name,
    phone,
    email,
    street_address,
    city,
    state,
    zip_code,
    customer_type,
    notes
  )
  values (
    submitted_first_name,
    submitted_last_name,
    nullif(trim(payload ->> 'company_name'), ''),
    nullif(trim(payload ->> 'phone'), ''),
    nullif(trim(payload ->> 'email'), ''),
    nullif(trim(payload ->> 'street_address'), ''),
    nullif(trim(payload ->> 'city'), ''),
    coalesce(
      nullif(trim(payload ->> 'state'), ''),
      'GA'
    ),
    nullif(trim(payload ->> 'zip_code'), ''),
    coalesce(
      nullif(trim(payload ->> 'customer_type'), ''),
      'residential'
    ),
    nullif(trim(payload ->> 'customer_notes'), '')
  )
  returning id into new_customer_id;

  insert into public.estimates (
    customer_id,
    job_type,
    job_address,
    description,

    estimated_amount,
    status,
    follow_up_needed,

    length_ft,
    width_ft,
    square_feet,
    thickness_in,

    finish_type,
    tear_out,
    grading,
    site_access,
    desired_timeline,

    rough_estimate_low,
    rough_estimate_high,
    final_quote_amount,

    estimate_decision,
    decision_question,
    decision_at,
    decision_feedback_reason,
    decision_feedback_comment,

    notes,
    attachments,
    notifications,
    source
  )
  values (
    new_customer_id,
    trim(payload ->> 'job_type'),
    submitted_job_address,
    nullif(trim(payload ->> 'description'), ''),

    nullif(payload ->> 'estimated_amount', '')::numeric,
    'pending',
    false,

    nullif(payload ->> 'length_ft', '')::numeric,
    nullif(payload ->> 'width_ft', '')::numeric,
    nullif(payload ->> 'square_feet', '')::numeric,
    nullif(payload ->> 'thickness_in', '')::numeric,

    nullif(trim(payload ->> 'finish_type'), ''),
    nullif(trim(payload ->> 'tear_out'), ''),
    nullif(trim(payload ->> 'grading'), ''),
    nullif(trim(payload ->> 'site_access'), ''),
    nullif(trim(payload ->> 'desired_timeline'), ''),

    nullif(payload ->> 'rough_estimate_low', '')::numeric,
    nullif(payload ->> 'rough_estimate_high', '')::numeric,
    nullif(payload ->> 'final_quote_amount', '')::numeric,

    nullif(trim(payload ->> 'estimate_decision'), ''),
    nullif(trim(payload ->> 'decision_question'), ''),
    nullif(payload ->> 'decision_at', '')::timestamptz,
    nullif(
      trim(payload ->> 'decision_feedback_reason'),
      ''
    ),
    nullif(
      trim(payload ->> 'decision_feedback_comment'),
      ''
    ),

    nullif(trim(payload ->> 'notes'), ''),

    coalesce(
      payload -> 'attachments',
      '[]'::jsonb
    ),

    coalesce(
      payload -> 'notifications',
      '[]'::jsonb
    ),

    coalesce(
      nullif(trim(payload ->> 'source'), ''),
      'website'
    )
  )
  returning id into new_estimate_id;

  return new_estimate_id;
end;
$$;


-- =========================================================
-- 4. Restrict access to the function
-- =========================================================

revoke all
on function public.submit_public_estimate(jsonb)
from public;

grant execute
on function public.submit_public_estimate(jsonb)
to anon, authenticated;