-- 025_final_estimate_publications.sql
-- Final estimate draft fields, immutable publications, and secure customer review RPCs.

alter table public.estimates
  add column if not exists final_estimate_customer_name text,
  add column if not exists final_estimate_customer_email text,
  add column if not exists final_estimate_project_address text,
  add column if not exists final_estimate_project_type text,
  add column if not exists final_estimate_scope_description text,
  add column if not exists final_estimate_total_amount numeric(12, 2),
  add column if not exists final_estimate_deposit_type text,
  add column if not exists final_estimate_deposit_value numeric(12, 2),
  add column if not exists final_estimate_payment_terms text,
  add column if not exists final_estimate_scheduling_terms text,
  add column if not exists final_estimate_exclusions text,
  add column if not exists final_estimate_expires_at timestamptz;

alter table public.estimates
  drop constraint if exists estimates_final_estimate_total_amount_check,
  drop constraint if exists estimates_final_estimate_deposit_type_check,
  drop constraint if exists estimates_final_estimate_deposit_value_check,
  drop constraint if exists estimates_final_estimate_percentage_deposit_check;

alter table public.estimates
  add constraint estimates_final_estimate_total_amount_check
  check (
    final_estimate_total_amount is null
    or final_estimate_total_amount > 0
  ),
  add constraint estimates_final_estimate_deposit_type_check
  check (
    final_estimate_deposit_type is null
    or final_estimate_deposit_type in ('fixed', 'percentage', 'none')
  ),
  add constraint estimates_final_estimate_deposit_value_check
  check (
    final_estimate_deposit_value is null
    or final_estimate_deposit_value >= 0
  ),
  add constraint estimates_final_estimate_percentage_deposit_check
  check (
    final_estimate_deposit_type is distinct from 'percentage'
    or final_estimate_deposit_value is null
    or final_estimate_deposit_value <= 100
  );

create table if not exists public.estimate_publications (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates(id) on delete restrict,
  version_number integer not null,
  status text not null default 'draft',
  access_token_hash text not null,
  customer_name text not null,
  customer_email text,
  project_address text,
  project_type text,
  scope_description text not null,
  total_amount numeric(12, 2) not null,
  deposit_type text,
  deposit_value numeric(12, 2),
  deposit_amount numeric(12, 2),
  payment_terms text,
  scheduling_terms text,
  exclusions text,
  expires_at timestamptz,
  published_at timestamptz not null default now(),
  published_by uuid references public.profiles(id) on delete set null,
  viewed_at timestamptz,
  decision text,
  decision_name text,
  decision_email text,
  decision_at timestamptz,
  acceptance_statement text,
  declined_reason text,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.estimate_publications
  add column if not exists estimate_id uuid,
  add column if not exists version_number integer,
  add column if not exists status text,
  add column if not exists access_token_hash text,
  add column if not exists customer_name text,
  add column if not exists customer_email text,
  add column if not exists project_address text,
  add column if not exists project_type text,
  add column if not exists scope_description text,
  add column if not exists total_amount numeric(12, 2),
  add column if not exists deposit_type text,
  add column if not exists deposit_value numeric(12, 2),
  add column if not exists deposit_amount numeric(12, 2),
  add column if not exists payment_terms text,
  add column if not exists scheduling_terms text,
  add column if not exists exclusions text,
  add column if not exists expires_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid,
  add column if not exists viewed_at timestamptz,
  add column if not exists decision text,
  add column if not exists decision_name text,
  add column if not exists decision_email text,
  add column if not exists decision_at timestamptz,
  add column if not exists acceptance_statement text,
  add column if not exists declined_reason text,
  add column if not exists revoked_at timestamptz,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

alter table public.estimate_publications
  drop constraint if exists estimate_publications_estimate_id_fkey,
  drop constraint if exists estimate_publications_published_by_fkey;

alter table public.estimate_publications
  add constraint estimate_publications_estimate_id_fkey
  foreign key (estimate_id)
  references public.estimates(id)
  on delete restrict,
  add constraint estimate_publications_published_by_fkey
  foreign key (published_by)
  references public.profiles(id)
  on delete set null;

with publication_repair as (
  select clock_timestamp() as repair_now
)
update public.estimate_publications
set
  status = 'expired',
  updated_at = publication_repair.repair_now
from publication_repair
where status = 'published'
  and decision is null
  and revoked_at is null
  and expires_at is not null
  and expires_at < publication_repair.repair_now;

alter table public.estimate_publications
  drop constraint if exists estimate_publications_version_number_check,
  drop constraint if exists estimate_publications_status_check,
  drop constraint if exists estimate_publications_decision_check,
  drop constraint if exists estimate_publications_deposit_type_check,
  drop constraint if exists estimate_publications_total_amount_check,
  drop constraint if exists estimate_publications_deposit_amount_check,
  drop constraint if exists estimate_publications_deposit_value_check,
  drop constraint if exists estimate_publications_deposit_consistency_check,
  drop constraint if exists estimate_publications_status_decision_alignment_check,
  drop constraint if exists estimate_publications_revocation_alignment_check,
  drop constraint if exists estimate_publications_expiration_alignment_check,
  drop constraint if exists estimate_publications_decision_audit_check,
  drop constraint if exists estimate_publications_percentage_deposit_check,
  drop constraint if exists estimate_publications_audit_chronology_check;

alter table public.estimate_publications
  add constraint estimate_publications_version_number_check
  check (version_number > 0),
  add constraint estimate_publications_status_check
  check (
    status in (
      'draft',
      'published',
      'accepted',
      'declined',
      'expired',
      'revoked'
    )
  ),
  add constraint estimate_publications_decision_check
  check (
    decision is null
    or decision in ('accepted', 'declined')
  ),
  add constraint estimate_publications_deposit_type_check
  check (
    deposit_type is null
    or deposit_type in ('fixed', 'percentage', 'none')
  ),
  add constraint estimate_publications_total_amount_check
  check (total_amount > 0),
  add constraint estimate_publications_deposit_amount_check
  check (
    deposit_amount is null
    or (
      deposit_amount >= 0
      and deposit_amount <= total_amount
    )
  ),
  add constraint estimate_publications_deposit_value_check
  check (
    deposit_value is null
    or deposit_value >= 0
  ),
  add constraint estimate_publications_deposit_consistency_check
  check (
    (
      deposit_type is null
      and deposit_value is null
      and coalesce(deposit_amount, 0) = 0
    )
    or (
      deposit_type = 'none'
      and coalesce(deposit_value, 0) = 0
      and coalesce(deposit_amount, 0) = 0
    )
    or (
      deposit_type = 'fixed'
      and deposit_value is not null
      and deposit_amount is not null
      and deposit_amount = deposit_value
      and deposit_amount >= 0
      and deposit_amount <= total_amount
    )
    or (
      deposit_type = 'percentage'
      and deposit_value is not null
      and deposit_value >= 0
      and deposit_value <= 100
      and deposit_amount is not null
      and deposit_amount = round((total_amount * deposit_value) / 100, 2)
      and deposit_amount >= 0
      and deposit_amount <= total_amount
    )
  ),
  add constraint estimate_publications_status_decision_alignment_check
  check (
    (
      status = 'accepted'
      and decision = 'accepted'
    )
    or (
      status = 'declined'
      and decision = 'declined'
    )
    or (
      status in ('draft', 'published', 'expired', 'revoked')
      and decision is null
    )
  ),
  add constraint estimate_publications_revocation_alignment_check
  check (
    (
      status = 'revoked'
      and revoked_at is not null
    )
    or (
      status <> 'revoked'
      and revoked_at is null
    )
  ),
  add constraint estimate_publications_expiration_alignment_check
  check (
    status <> 'expired'
    or (
      expires_at is not null
      and decision is null
      and revoked_at is null
    )
  ),
  add constraint estimate_publications_decision_audit_check
  check (
    (
      decision is null
      and decision_at is null
      and nullif(btrim(coalesce(decision_name, '')), '') is null
      and nullif(btrim(coalesce(decision_email, '')), '') is null
      and nullif(btrim(coalesce(acceptance_statement, '')), '') is null
      and nullif(btrim(coalesce(declined_reason, '')), '') is null
    )
    or (
      decision = 'accepted'
      and decision_at is not null
      and nullif(btrim(coalesce(decision_name, '')), '') is not null
      and nullif(btrim(coalesce(acceptance_statement, '')), '') is not null
      and nullif(btrim(coalesce(declined_reason, '')), '') is null
    )
    or (
      decision = 'declined'
      and decision_at is not null
      and nullif(btrim(coalesce(decision_name, '')), '') is not null
      and nullif(btrim(coalesce(acceptance_statement, '')), '') is null
    )
  ),
  add constraint estimate_publications_percentage_deposit_check
  check (
    deposit_type is distinct from 'percentage'
    or deposit_value is null
    or deposit_value <= 100
  ),
  add constraint estimate_publications_audit_chronology_check
  check (
    (expires_at is null or expires_at >= published_at)
    and (viewed_at is null or viewed_at >= published_at)
    and (decision_at is null or decision_at >= published_at)
    and (revoked_at is null or revoked_at >= published_at)
  );

drop index if exists public.estimate_publications_estimate_version_unique_idx;
drop index if exists public.estimate_publications_access_token_hash_unique_idx;
drop index if exists public.estimate_publications_estimate_id_idx;
drop index if exists public.estimate_publications_status_idx;
drop index if exists public.estimate_publications_published_at_idx;
drop index if exists public.estimate_publications_one_active_publication_idx;

create unique index estimate_publications_estimate_version_unique_idx
  on public.estimate_publications (estimate_id, version_number);

create unique index estimate_publications_access_token_hash_unique_idx
  on public.estimate_publications (access_token_hash);

create unique index estimate_publications_one_active_publication_idx
  on public.estimate_publications (estimate_id)
  where status = 'published'
    and decision is null
    and revoked_at is null;

create index estimate_publications_estimate_id_idx
  on public.estimate_publications (estimate_id);

create index estimate_publications_status_idx
  on public.estimate_publications (status);

create index estimate_publications_published_at_idx
  on public.estimate_publications (published_at desc);

alter table public.estimate_publications enable row level security;

drop policy if exists "Operational users can view estimate publications" on public.estimate_publications;

create policy "Operational users can view estimate publications"
on public.estimate_publications
for select
to authenticated
using (public.can_manage_operations());

revoke all on table public.estimate_publications from public;
revoke all on table public.estimate_publications from anon;
revoke all on table public.estimate_publications from authenticated;
grant select on table public.estimate_publications to authenticated;

drop trigger if exists set_estimate_publications_updated_at on public.estimate_publications;

create trigger set_estimate_publications_updated_at
before update on public.estimate_publications
for each row
execute function public.set_updated_at();

create or replace function public.final_estimate_hash_token(raw_token text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(digest(coalesce(raw_token, ''), 'sha256'), 'hex');
$$;

create or replace function public.calculate_final_estimate_deposit_amount(
  final_total numeric,
  final_deposit_type text,
  final_deposit_value numeric
)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
begin
  if final_deposit_type = 'fixed' then
    return round(coalesce(final_deposit_value, 0), 2);
  end if;

  if final_deposit_type = 'percentage' then
    return round((coalesce(final_total, 0) * coalesce(final_deposit_value, 0)) / 100, 2);
  end if;

  return 0;
end;
$$;

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

create or replace function public.get_public_final_estimate(
  p_access_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  publication_record public.estimate_publications%rowtype;
  target_publication_id uuid;
  hashed_access_token text;
  effective_viewed_at timestamptz;
  lookup_now timestamptz;
  updated_rows integer := 0;
begin
  if nullif(trim(coalesce(p_access_token, '')), '') is null then
    raise exception 'FINAL_ESTIMATE_INVALID: This final estimate link is invalid.';
  end if;

  hashed_access_token := public.final_estimate_hash_token(trim(p_access_token));

  select *
  into publication_record
  from public.estimate_publications
  where access_token_hash = hashed_access_token
  for update;

  if not found then
    raise exception 'FINAL_ESTIMATE_INVALID: This final estimate link is invalid.';
  end if;

  lookup_now := clock_timestamp();
  target_publication_id := publication_record.id;

  if publication_record.revoked_at is not null or publication_record.status = 'revoked' then
    raise exception 'FINAL_ESTIMATE_REVOKED: This final estimate link has been revoked.';
  end if;

  if publication_record.status = 'expired'
     or (
       publication_record.status = 'published'
       and publication_record.decision is null
       and publication_record.revoked_at is null
       and publication_record.expires_at is not null
       and publication_record.expires_at < lookup_now
     )
  then
    if publication_record.status = 'published' then
      update public.estimate_publications
      set
        status = 'expired',
        updated_at = lookup_now
      where id = target_publication_id
        and status = 'published'
        and decision is null
        and revoked_at is null
        and expires_at is not null
        and expires_at < lookup_now
      returning * into publication_record;

      get diagnostics updated_rows = row_count;

      if updated_rows = 0 then
        select *
        into publication_record
        from public.estimate_publications
        where id = target_publication_id;

        if not found then
          raise exception 'FINAL_ESTIMATE_INVALID: This final estimate link is invalid.';
        end if;
      end if;
    end if;

    if publication_record.revoked_at is not null or publication_record.status = 'revoked' then
      raise exception 'FINAL_ESTIMATE_REVOKED: This final estimate link has been revoked.';
    end if;

    if publication_record.status = 'expired'
       or (
         publication_record.status = 'published'
         and publication_record.decision is null
         and publication_record.revoked_at is null
         and publication_record.expires_at is not null
         and publication_record.expires_at < lookup_now
       )
    then
      return jsonb_build_object(
        'status', 'expired',
        'decision', null
      );
    end if;
  end if;

  if publication_record.status not in ('published', 'accepted', 'declined') then
    raise exception 'FINAL_ESTIMATE_INVALID: This final estimate link is invalid.';
  end if;

  effective_viewed_at := publication_record.viewed_at;

  if effective_viewed_at is null then
    update public.estimate_publications
    set
      viewed_at = lookup_now
    where id = target_publication_id
      and viewed_at is null
    returning viewed_at into effective_viewed_at;

    if effective_viewed_at is null then
      select viewed_at
      into effective_viewed_at
      from public.estimate_publications
      where id = target_publication_id;
    end if;
  end if;

  return jsonb_build_object(
    'status', publication_record.status,
    'decision', publication_record.decision,
    'customer_name', publication_record.customer_name,
    'project_address', publication_record.project_address,
    'project_type', publication_record.project_type,
    'scope_description', publication_record.scope_description,
    'total_amount', publication_record.total_amount,
    'deposit_type', publication_record.deposit_type,
    'deposit_value', publication_record.deposit_value,
    'deposit_amount', coalesce(publication_record.deposit_amount, 0),
    'payment_terms', publication_record.payment_terms,
    'scheduling_terms', publication_record.scheduling_terms,
    'exclusions', publication_record.exclusions,
    'expires_at', publication_record.expires_at,
    'published_at', publication_record.published_at,
    'viewed_at', coalesce(effective_viewed_at, publication_record.viewed_at),
    'decision_at', publication_record.decision_at,
    'version_number', publication_record.version_number
  );
end;
$$;

create or replace function public.submit_final_estimate_decision(
  p_access_token text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  publication_record public.estimate_publications%rowtype;
  hashed_access_token text;
  target_publication_id uuid;
  requested_decision text;
  submitted_decision_name text;
  submitted_decision_email text;
  submitted_declined_reason text;
  agreement_confirmed boolean;
  amount_acknowledged boolean;
  deposit_acknowledged boolean;
  decision_now timestamptz;
  generated_acceptance_statement text;
  updated_rows integer := 0;
begin
  if nullif(trim(coalesce(p_access_token, '')), '') is null then
    raise exception 'FINAL_ESTIMATE_INVALID: This final estimate link is invalid.';
  end if;

  hashed_access_token := public.final_estimate_hash_token(trim(p_access_token));

  select *
  into publication_record
  from public.estimate_publications
  where access_token_hash = hashed_access_token
  for update;

  if not found then
    raise exception 'FINAL_ESTIMATE_INVALID: This final estimate link is invalid.';
  end if;

  decision_now := clock_timestamp();
  target_publication_id := publication_record.id;

  if publication_record.revoked_at is not null or publication_record.status = 'revoked' then
    raise exception 'FINAL_ESTIMATE_REVOKED: This final estimate link has been revoked.';
  end if;

  if publication_record.status = 'expired'
     or (
       publication_record.status = 'published'
       and publication_record.decision is null
       and publication_record.revoked_at is null
       and publication_record.expires_at is not null
       and publication_record.expires_at < decision_now
     )
  then
    if publication_record.status = 'published' then
      update public.estimate_publications
      set
        status = 'expired',
        updated_at = decision_now
      where id = target_publication_id
        and status = 'published'
        and decision is null
        and revoked_at is null
        and expires_at is not null
        and expires_at < decision_now
      returning * into publication_record;

      get diagnostics updated_rows = row_count;

      if updated_rows = 0 then
        select *
        into publication_record
        from public.estimate_publications
        where id = target_publication_id;

        if not found then
          raise exception 'FINAL_ESTIMATE_INVALID: This final estimate link is invalid.';
        end if;
      end if;
    end if;

    if publication_record.revoked_at is not null or publication_record.status = 'revoked' then
      raise exception 'FINAL_ESTIMATE_REVOKED: This final estimate link has been revoked.';
    end if;

    if publication_record.status = 'expired'
       or (
         publication_record.status = 'published'
         and publication_record.decision is null
         and publication_record.revoked_at is null
         and publication_record.expires_at is not null
         and publication_record.expires_at < decision_now
       )
    then
      return jsonb_build_object(
        'status', 'expired',
        'decision', null
      );
    end if;
  end if;

  if publication_record.decision is not null
     or publication_record.status in ('accepted', 'declined')
  then
    raise exception 'FINAL_ESTIMATE_ALREADY_DECIDED: This final estimate has already received a decision.';
  end if;

  if publication_record.status <> 'published' then
    raise exception 'FINAL_ESTIMATE_INVALID: This final estimate is no longer available.';
  end if;

  requested_decision := lower(coalesce(nullif(trim(coalesce(p_payload ->> 'decision', '')), ''), ''));

  if requested_decision not in ('accepted', 'declined') then
    raise exception 'FINAL_ESTIMATE_VALIDATION: Choose accept or decline before submitting.';
  end if;

  submitted_decision_name := nullif(trim(coalesce(p_payload ->> 'decision_name', '')), '');

  if submitted_decision_name is null then
    raise exception 'FINAL_ESTIMATE_VALIDATION: Enter your full name before submitting.';
  end if;

  submitted_decision_email := nullif(trim(coalesce(p_payload ->> 'decision_email', '')), '');

  if submitted_decision_email is not null
     and submitted_decision_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  then
    raise exception 'FINAL_ESTIMATE_VALIDATION: Enter a valid email address or leave it blank.';
  end if;

  submitted_declined_reason := nullif(trim(coalesce(p_payload ->> 'declined_reason', '')), '');

  agreement_confirmed := lower(coalesce(p_payload ->> 'agreement_confirmed', 'false')) = 'true';
  amount_acknowledged := lower(coalesce(p_payload ->> 'amount_acknowledged', 'false')) = 'true';
  deposit_acknowledged := lower(coalesce(p_payload ->> 'deposit_acknowledged', 'false')) = 'true';

  if requested_decision = 'accepted' then
    if not agreement_confirmed then
      raise exception 'FINAL_ESTIMATE_VALIDATION: Acceptance requires confirming the approval statement.';
    end if;

    if not amount_acknowledged then
      raise exception 'FINAL_ESTIMATE_VALIDATION: Acceptance requires acknowledging the total amount.';
    end if;

    if not deposit_acknowledged then
      raise exception 'FINAL_ESTIMATE_VALIDATION: Acceptance requires acknowledging the deposit terms.';
    end if;

    generated_acceptance_statement := format(
      'I, %s, approve Southern Oak final estimate version %s, including the displayed scope, total amount of $%s, deposit requirement of $%s, and listed terms.',
      submitted_decision_name,
      publication_record.version_number,
      to_char(publication_record.total_amount, 'FM999,999,999,990.00'),
      to_char(coalesce(publication_record.deposit_amount, 0), 'FM999,999,999,990.00')
    );
  else
    generated_acceptance_statement := null;
  end if;

  update public.estimate_publications
  set
    status = requested_decision,
    decision = requested_decision,
    decision_name = submitted_decision_name,
    decision_email = submitted_decision_email,
    decision_at = decision_now,
    acceptance_statement = generated_acceptance_statement,
    declined_reason = case
      when requested_decision = 'declined'
        then submitted_declined_reason
      else null
    end,
    viewed_at = coalesce(viewed_at, decision_now),
    updated_at = decision_now
  where id = target_publication_id
    and decision is null
    and status = 'published'
    and revoked_at is null
    and (expires_at is null or expires_at >= decision_now)
  returning * into publication_record;

  get diagnostics updated_rows = row_count;

  if updated_rows <> 1 then
    select *
    into publication_record
    from public.estimate_publications
    where id = target_publication_id;

    if not found then
      raise exception 'FINAL_ESTIMATE_INVALID: This final estimate link is invalid.';
    end if;

    if publication_record.revoked_at is not null or publication_record.status = 'revoked' then
      raise exception 'FINAL_ESTIMATE_REVOKED: This final estimate link has been revoked.';
    end if;

    if publication_record.status = 'expired' then
      return jsonb_build_object(
        'status', 'expired',
        'decision', null
      );
    end if;

    if publication_record.status = 'published'
       and publication_record.expires_at is not null
       and publication_record.expires_at < decision_now
    then
      update public.estimate_publications
      set
        status = 'expired',
        updated_at = decision_now
      where id = target_publication_id
        and status = 'published'
        and decision is null
        and revoked_at is null
        and expires_at is not null
        and expires_at < decision_now
      returning * into publication_record;

      get diagnostics updated_rows = row_count;

      if updated_rows = 0 then
        select *
        into publication_record
        from public.estimate_publications
        where id = target_publication_id;

        if not found then
          raise exception 'FINAL_ESTIMATE_INVALID: This final estimate link is invalid.';
        end if;
      end if;

      if publication_record.revoked_at is not null or publication_record.status = 'revoked' then
        raise exception 'FINAL_ESTIMATE_REVOKED: This final estimate link has been revoked.';
      end if;

      if publication_record.status = 'expired'
         or (
           publication_record.status = 'published'
           and publication_record.decision is null
           and publication_record.revoked_at is null
           and publication_record.expires_at is not null
           and publication_record.expires_at < decision_now
         )
      then
        return jsonb_build_object(
          'status', 'expired',
          'decision', null
        );
      end if;
    end if;

    if publication_record.decision is not null
       or publication_record.status in ('accepted', 'declined')
    then
      raise exception 'FINAL_ESTIMATE_ALREADY_DECIDED: This final estimate has already received a decision.';
    end if;

    raise exception 'FINAL_ESTIMATE_INVALID: This final estimate is no longer available.';
  end if;

  return jsonb_build_object(
    'status', publication_record.status,
    'decision', publication_record.decision,
    'decision_at', publication_record.decision_at,
    'decision_name', publication_record.decision_name,
    'decision_email', publication_record.decision_email
  );
end;
$$;

create or replace function public.revoke_final_estimate_publication(
  p_publication_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  publication_record public.estimate_publications%rowtype;
  target_publication_id uuid;
  revoke_now timestamptz;
  updated_rows integer := 0;
begin
  if not public.is_admin() then
    raise exception 'FINAL_ESTIMATE_FORBIDDEN: You do not have permission to revoke final estimate links.';
  end if;

  select *
  into publication_record
  from public.estimate_publications
  where id = p_publication_id
  for update;

  if not found then
    raise exception 'FINAL_ESTIMATE_NOT_FOUND: The final estimate publication could not be found.';
  end if;

  revoke_now := clock_timestamp();
  target_publication_id := publication_record.id;

  if publication_record.decision is not null
     or publication_record.status in ('accepted', 'declined')
  then
    raise exception 'FINAL_ESTIMATE_VALIDATION: Accepted or declined publications cannot be revoked.';
  end if;

  if publication_record.status = 'expired'
     or (
       publication_record.status = 'published'
       and publication_record.decision is null
       and publication_record.revoked_at is null
       and publication_record.expires_at is not null
       and publication_record.expires_at < revoke_now
     )
  then
    raise exception 'FINAL_ESTIMATE_VALIDATION: Expired publications cannot be revoked.';
  end if;

  if publication_record.revoked_at is not null or publication_record.status = 'revoked' then
    if publication_record.revoked_at is null then
      update public.estimate_publications
      set
        revoked_at = revoke_now,
        updated_at = revoke_now
      where id = target_publication_id
        and status = 'revoked'
        and revoked_at is null
      returning * into publication_record;

      get diagnostics updated_rows = row_count;

      if updated_rows = 0 then
        select *
        into publication_record
        from public.estimate_publications
        where id = target_publication_id;

        if not found then
          raise exception 'FINAL_ESTIMATE_NOT_FOUND: The final estimate publication could not be found.';
        end if;
      end if;
    end if;

    return jsonb_build_object(
      'publication_id', publication_record.id,
      'status', 'revoked',
      'revoked_at', publication_record.revoked_at
    );
  end if;

  update public.estimate_publications
  set
    status = 'revoked',
    revoked_at = revoke_now,
    updated_at = revoke_now
  where id = target_publication_id
    and status = 'published'
    and decision is null
    and revoked_at is null
    and (
      expires_at is null
      or expires_at >= revoke_now
    )
  returning * into publication_record;

  get diagnostics updated_rows = row_count;

  if updated_rows <> 1 then
    select *
    into publication_record
    from public.estimate_publications
    where id = target_publication_id;

    if not found then
      raise exception 'FINAL_ESTIMATE_NOT_FOUND: The final estimate publication could not be found.';
    end if;

    if publication_record.revoked_at is not null or publication_record.status = 'revoked' then
      if publication_record.revoked_at is null then
        update public.estimate_publications
        set
          revoked_at = revoke_now,
          updated_at = revoke_now
        where id = target_publication_id
          and status = 'revoked'
          and revoked_at is null
        returning * into publication_record;

        get diagnostics updated_rows = row_count;

        if updated_rows = 0 then
          select *
          into publication_record
          from public.estimate_publications
          where id = target_publication_id;

          if not found then
            raise exception 'FINAL_ESTIMATE_NOT_FOUND: The final estimate publication could not be found.';
          end if;
        end if;
      end if;

      return jsonb_build_object(
        'publication_id', publication_record.id,
        'status', 'revoked',
        'revoked_at', publication_record.revoked_at
      );
    end if;

    if publication_record.status = 'expired'
       or (
         publication_record.status = 'published'
         and publication_record.decision is null
         and publication_record.revoked_at is null
         and publication_record.expires_at is not null
         and publication_record.expires_at < revoke_now
       )
    then
      raise exception 'FINAL_ESTIMATE_VALIDATION: Expired publications cannot be revoked.';
    end if;

    if publication_record.decision is not null
       or publication_record.status in ('accepted', 'declined')
    then
      raise exception 'FINAL_ESTIMATE_VALIDATION: Accepted or declined publications cannot be revoked.';
    end if;

    raise exception 'FINAL_ESTIMATE_VALIDATION: Only active published undecided publications can be revoked.';
  end if;

  return jsonb_build_object(
    'publication_id', publication_record.id,
    'status', 'revoked',
    'revoked_at', publication_record.revoked_at
  );
end;
$$;

revoke all on function public.publish_final_estimate(uuid, jsonb) from public;
revoke all on function public.publish_final_estimate(uuid, jsonb) from anon;
revoke all on function public.publish_final_estimate(uuid, jsonb) from authenticated;
revoke all on function public.get_public_final_estimate(text) from public;
revoke all on function public.get_public_final_estimate(text) from anon;
revoke all on function public.get_public_final_estimate(text) from authenticated;
revoke all on function public.submit_final_estimate_decision(text, jsonb) from public;
revoke all on function public.submit_final_estimate_decision(text, jsonb) from anon;
revoke all on function public.submit_final_estimate_decision(text, jsonb) from authenticated;
revoke all on function public.revoke_final_estimate_publication(uuid) from public;
revoke all on function public.revoke_final_estimate_publication(uuid) from anon;
revoke all on function public.revoke_final_estimate_publication(uuid) from authenticated;

grant execute on function public.publish_final_estimate(uuid, jsonb) to authenticated;
grant execute on function public.revoke_final_estimate_publication(uuid) to authenticated;
grant execute on function public.get_public_final_estimate(text) to anon, authenticated;
grant execute on function public.submit_final_estimate_decision(text, jsonb) to anon, authenticated;

revoke all on function public.final_estimate_hash_token(text) from public;
revoke all on function public.final_estimate_hash_token(text) from anon;
revoke all on function public.final_estimate_hash_token(text) from authenticated;
revoke all on function public.calculate_final_estimate_deposit_amount(numeric, text, numeric) from public;
revoke all on function public.calculate_final_estimate_deposit_amount(numeric, text, numeric) from anon;
revoke all on function public.calculate_final_estimate_deposit_amount(numeric, text, numeric) from authenticated;
