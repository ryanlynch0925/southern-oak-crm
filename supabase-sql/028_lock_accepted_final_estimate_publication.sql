-- 028_lock_accepted_final_estimate_publication.sql
-- Prevents publishing a new final estimate version after one has already been accepted.

begin;

create or replace function public.publish_final_estimate(
  p_estimate_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  estimate_record record;
  publication_now timestamptz;
  georgia_business_date date;
  next_version integer;
  publication_id uuid;
  plain_access_token text;
  access_token_hash text;
  raw_customer_name text;
  raw_customer_email text;
  raw_project_address text;
  raw_project_type text;
  raw_scope_description text;
  raw_total_amount text;
  raw_deposit_type text;
  raw_deposit_value text;
  raw_payment_terms text;
  raw_scheduling_terms text;
  raw_exclusions text;
  raw_expires_at text;
  parsed_total_amount numeric(12, 2);
  parsed_deposit_value numeric(12, 2);
  parsed_deposit_amount numeric(12, 2);
  parsed_expires_at timestamptz;
  parsed_expiration_date date;
  normalized_customer_name text;
  normalized_customer_email text;
  normalized_project_address text;
  normalized_project_type text;
  normalized_scope_description text;
  normalized_deposit_type text;
  normalized_payment_terms text;
  normalized_scheduling_terms text;
  normalized_exclusions text;
begin
  if not public.can_manage_operations() then
    raise exception 'FINAL_ESTIMATE_FORBIDDEN: You do not have permission to publish final estimates.';
  end if;

  if p_estimate_id is null then
    raise exception 'FINAL_ESTIMATE_VALIDATION: Estimate ID is required.';
  end if;

  select
    e.id,
    e.customer_id,
    e.job_address,
    e.job_type,
    e.description,
    c.first_name,
    c.last_name,
    c.company_name,
    c.email,
    c.street_address,
    c.city,
    c.state,
    c.zip_code
  into estimate_record
  from public.estimates e
  join public.customers c
    on c.id = e.customer_id
  where e.id = p_estimate_id
  for update;

  if not found then
    raise exception 'FINAL_ESTIMATE_NOT_FOUND: The estimate could not be found.';
  end if;

  if exists (
    select 1
    from public.estimate_publications ep
    where ep.estimate_id = p_estimate_id
      and (
        ep.status = 'accepted'
        or ep.decision = 'accepted'
      )
  ) then
    raise exception 'FINAL_ESTIMATE_VALIDATION: This final estimate has already been accepted and is locked. Revisions require a future controlled revision or change-order workflow.';
  end if;

  raw_customer_name := nullif(trim(coalesce(p_payload ->> 'customer_name', '')), '');
  raw_customer_email := nullif(trim(coalesce(p_payload ->> 'customer_email', '')), '');
  raw_project_address := nullif(trim(coalesce(p_payload ->> 'project_address', '')), '');
  raw_project_type := nullif(trim(coalesce(p_payload ->> 'project_type', '')), '');
  raw_scope_description := nullif(trim(coalesce(p_payload ->> 'scope_description', '')), '');
  raw_total_amount := nullif(trim(coalesce(p_payload ->> 'total_amount', '')), '');
  raw_deposit_type := lower(coalesce(nullif(trim(coalesce(p_payload ->> 'deposit_type', '')), ''), 'none'));
  raw_deposit_value := nullif(trim(coalesce(p_payload ->> 'deposit_value', '')), '');
  raw_payment_terms := nullif(trim(coalesce(p_payload ->> 'payment_terms', '')), '');
  raw_scheduling_terms := nullif(trim(coalesce(p_payload ->> 'scheduling_terms', '')), '');
  raw_exclusions := nullif(trim(coalesce(p_payload ->> 'exclusions', '')), '');
  raw_expires_at := nullif(trim(coalesce(p_payload ->> 'expires_at', '')), '');

  normalized_customer_name := coalesce(
    raw_customer_name,
    nullif(trim(coalesce(estimate_record.company_name, '')), ''),
    nullif(trim(concat_ws(' ', estimate_record.first_name, estimate_record.last_name)), '')
  );

  if normalized_customer_name is null then
    raise exception 'FINAL_ESTIMATE_VALIDATION: Customer name is required.';
  end if;

  normalized_customer_email := coalesce(
    raw_customer_email,
    nullif(trim(coalesce(estimate_record.email, '')), '')
  );

  if normalized_customer_email is not null
     and normalized_customer_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  then
    raise exception 'FINAL_ESTIMATE_VALIDATION: Enter a valid customer email address.';
  end if;

  normalized_project_address := coalesce(
    raw_project_address,
    nullif(trim(coalesce(estimate_record.job_address, '')), ''),
    nullif(
      concat_ws(
        ', ',
        nullif(trim(coalesce(estimate_record.street_address, '')), ''),
        nullif(trim(coalesce(estimate_record.city, '')), ''),
        nullif(trim(coalesce(estimate_record.state, '')), ''),
        nullif(trim(coalesce(estimate_record.zip_code, '')), '')
      ),
      ''
    )
  );

  normalized_project_type := coalesce(
    raw_project_type,
    nullif(trim(replace(coalesce(estimate_record.job_type, ''), '_', ' ')), '')
  );

  normalized_scope_description := coalesce(
    raw_scope_description,
    nullif(trim(coalesce(estimate_record.description, '')), '')
  );

  if normalized_scope_description is null then
    raise exception 'FINAL_ESTIMATE_VALIDATION: Scope description is required.';
  end if;

  if raw_total_amount is null or raw_total_amount !~ '^[0-9]+([.][0-9]{1,2})?$' then
    raise exception 'FINAL_ESTIMATE_VALIDATION: Enter a valid final total amount.';
  end if;

  begin
    parsed_total_amount := raw_total_amount::numeric(12, 2);
  exception
    when numeric_value_out_of_range then
      raise exception 'FINAL_ESTIMATE_VALIDATION: Final total is too large.';
  end;

  if parsed_total_amount <= 0 then
    raise exception 'FINAL_ESTIMATE_VALIDATION: Final total must be greater than zero.';
  end if;

  if raw_deposit_type not in ('fixed', 'percentage', 'none') then
    raise exception 'FINAL_ESTIMATE_VALIDATION: Select a valid deposit type.';
  end if;

  normalized_deposit_type := raw_deposit_type;

  if normalized_deposit_type in ('fixed', 'percentage') then
    if raw_deposit_value is null or raw_deposit_value !~ '^[0-9]+([.][0-9]{1,2})?$' then
      raise exception 'FINAL_ESTIMATE_VALIDATION: Enter a valid deposit value.';
    end if;

    begin
      parsed_deposit_value := raw_deposit_value::numeric(12, 2);
    exception
      when numeric_value_out_of_range then
        raise exception 'FINAL_ESTIMATE_VALIDATION: Deposit value is too large.';
    end;
  else
    parsed_deposit_value := null;
  end if;

  if normalized_deposit_type = 'percentage' and parsed_deposit_value > 100 then
    raise exception 'FINAL_ESTIMATE_VALIDATION: Percentage deposits must be 100 or less.';
  end if;

  parsed_deposit_amount := public.calculate_final_estimate_deposit_amount(
    parsed_total_amount,
    normalized_deposit_type,
    parsed_deposit_value
  )::numeric(12, 2);

  if parsed_deposit_amount < 0 then
    raise exception 'FINAL_ESTIMATE_VALIDATION: Deposit amount cannot be negative.';
  end if;

  if parsed_deposit_amount > parsed_total_amount then
    raise exception 'FINAL_ESTIMATE_VALIDATION: Deposit amount cannot exceed the final total.';
  end if;

  normalized_payment_terms := raw_payment_terms;

  if normalized_payment_terms is null then
    raise exception 'FINAL_ESTIMATE_VALIDATION: Payment terms are required.';
  end if;

  normalized_scheduling_terms := raw_scheduling_terms;
  normalized_exclusions := raw_exclusions;

  parsed_expires_at := null;
  if raw_expires_at is not null then
    if raw_expires_at !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'FINAL_ESTIMATE_VALIDATION: Enter a valid expiration date.';
    end if;

    begin
      parsed_expiration_date := raw_expires_at::date;
    exception
      when others then
        raise exception 'FINAL_ESTIMATE_VALIDATION: Enter a valid expiration date.';
    end;

    if to_char(parsed_expiration_date, 'YYYY-MM-DD') <> raw_expires_at then
      raise exception 'FINAL_ESTIMATE_VALIDATION: Enter a valid expiration date.';
    end if;
  end if;

  publication_now := clock_timestamp();
  georgia_business_date := timezone('America/New_York', publication_now)::date;

  if parsed_expiration_date is not null then
    if parsed_expiration_date < georgia_business_date then
      raise exception 'FINAL_ESTIMATE_VALIDATION: Expiration date cannot be in the past.';
    end if;

    parsed_expires_at := (
      ((parsed_expiration_date + 1)::timestamp at time zone 'America/New_York')
      - interval '1 microsecond'
    );
  end if;

  update public.estimates
  set
    final_estimate_customer_name = normalized_customer_name,
    final_estimate_customer_email = normalized_customer_email,
    final_estimate_project_address = normalized_project_address,
    final_estimate_project_type = normalized_project_type,
    final_estimate_scope_description = normalized_scope_description,
    final_estimate_total_amount = parsed_total_amount,
    final_estimate_deposit_type = normalized_deposit_type,
    final_estimate_deposit_value = parsed_deposit_value,
    final_estimate_payment_terms = normalized_payment_terms,
    final_estimate_scheduling_terms = normalized_scheduling_terms,
    final_estimate_exclusions = normalized_exclusions,
    final_estimate_expires_at = parsed_expires_at,
    updated_at = publication_now
  where id = p_estimate_id;

  update public.estimate_publications
  set
    status = 'expired',
    updated_at = publication_now
  where estimate_id = p_estimate_id
    and status = 'published'
    and decision is null
    and revoked_at is null
    and expires_at is not null
    and expires_at < publication_now;

  update public.estimate_publications
  set
    status = 'revoked',
    revoked_at = publication_now,
    updated_at = publication_now
  where estimate_id = p_estimate_id
    and status = 'published'
    and decision is null
    and revoked_at is null
    and (
      expires_at is null
      or expires_at >= publication_now
    );

  select coalesce(max(version_number), 0) + 1
  into next_version
  from public.estimate_publications
  where estimate_id = p_estimate_id;

  plain_access_token := encode(gen_random_bytes(32), 'hex');
  access_token_hash := public.final_estimate_hash_token(plain_access_token);

  insert into public.estimate_publications (
    estimate_id,
    version_number,
    status,
    access_token_hash,
    customer_name,
    customer_email,
    project_address,
    project_type,
    scope_description,
    total_amount,
    deposit_type,
    deposit_value,
    deposit_amount,
    payment_terms,
    scheduling_terms,
    exclusions,
    expires_at,
    published_at,
    published_by
  )
  values (
    p_estimate_id,
    next_version,
    'published',
    access_token_hash,
    normalized_customer_name,
    normalized_customer_email,
    normalized_project_address,
    normalized_project_type,
    normalized_scope_description,
    parsed_total_amount,
    normalized_deposit_type,
    parsed_deposit_value,
    parsed_deposit_amount,
    normalized_payment_terms,
    normalized_scheduling_terms,
    normalized_exclusions,
    parsed_expires_at,
    publication_now,
    auth.uid()
  )
  returning id into publication_id;

  return jsonb_build_object(
    'publication_id', publication_id,
    'version_number', next_version,
    'status', 'published',
    'published_at', publication_now,
    'access_token', plain_access_token
  );
end;
$$;

commit;
