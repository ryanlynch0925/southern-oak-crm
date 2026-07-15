-- 024_customer_reuse_on_estimate.sql
-- Reuses an existing customer during public estimate submission only when
-- email or normalized phone yields a single high-confidence match.

begin;

create or replace function public.normalize_customer_phone_for_match(phone_input text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  digits_only text;
begin
  digits_only := regexp_replace(coalesce(phone_input, ''), '[^0-9]+', '', 'g');
  digits_only := nullif(digits_only, '');

  if digits_only is null then
    return null;
  end if;

  if char_length(digits_only) = 11 and left(digits_only, 1) = '1' then
    return right(digits_only, 10);
  end if;

  return digits_only;
end;
$$;

revoke all
on function public.normalize_customer_phone_for_match(text)
from public, anon, authenticated;

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
  submitted_email text;
  submitted_phone text;
  normalized_submitted_email text;
  normalized_submitted_phone text;
  email_matching_customer_count integer := 0;
  email_matched_customer_id uuid;
  phone_matching_customer_count integer := 0;
  phone_matched_customer_id uuid;
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

  submitted_email :=
    nullif(trim(payload ->> 'email'), '');

  submitted_phone :=
    nullif(trim(payload ->> 'phone'), '');

  normalized_submitted_email :=
    case
      when submitted_email is null then null
      else lower(submitted_email)
    end;

  normalized_submitted_phone :=
    public.normalize_customer_phone_for_match(submitted_phone);

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

  if normalized_submitted_email is not null then
    select count(*)
    into email_matching_customer_count
    from public.customers c
    where lower(trim(coalesce(c.email, ''))) = normalized_submitted_email;

    if email_matching_customer_count > 1 then
      raise exception 'Multiple customers match the submitted email address. Customer reuse cannot be determined safely.';
    elsif email_matching_customer_count = 1 then
      select c.id
      into email_matched_customer_id
      from public.customers c
      where lower(trim(coalesce(c.email, ''))) = normalized_submitted_email
      limit 1;
    end if;
  end if;

  if normalized_submitted_phone is not null then
    select count(*)
    into phone_matching_customer_count
    from public.customers c
    where public.normalize_customer_phone_for_match(c.phone) = normalized_submitted_phone;

    if phone_matching_customer_count > 1 then
      raise exception 'Multiple customers match the submitted phone number. Customer reuse cannot be determined safely.';
    elsif phone_matching_customer_count = 1 then
      select c.id
      into phone_matched_customer_id
      from public.customers c
      where public.normalize_customer_phone_for_match(c.phone) = normalized_submitted_phone
      limit 1;
    end if;
  end if;

  if email_matching_customer_count = 1
     and phone_matching_customer_count = 1
     and email_matched_customer_id is distinct from phone_matched_customer_id
  then
    raise exception 'Submitted email and phone match different customer records. Customer reuse cannot be determined safely.';
  end if;

  if email_matching_customer_count = 1 then
    new_customer_id := email_matched_customer_id;
  elsif phone_matching_customer_count = 1 then
    new_customer_id := phone_matched_customer_id;
  else
    new_customer_id := null;
  end if;

  if new_customer_id is null then
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
      submitted_phone,
      submitted_email,
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
  end if;

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

revoke all
on function public.submit_public_estimate(jsonb)
from public;

grant execute
on function public.submit_public_estimate(jsonb)
to anon, authenticated;

commit;
