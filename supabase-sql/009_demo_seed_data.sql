-- 009_demo_seed_data.sql
-- Southern Oak CRM - Demo Seed Data
-- Demo data only. Do not use real customer/payment/job data in dev.

-- Clear demo data in child-to-parent order.
-- Only use this in dev/testing.
delete from public.expenses;
delete from public.payments;
delete from public.invoices;
delete from public.schedule_events;
delete from public.crews;
delete from public.jobs;
delete from public.estimates;
delete from public.customers;

-- Customers
insert into public.customers (
  id,
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
values
(
  '11111111-1111-1111-1111-111111111111',
  'John',
  'Smith',
  null,
  '706-555-0142',
  'john.smith@example.com',
  '123 Test Drive',
  'Thomaston',
  'GA',
  '30286',
  'residential',
  'Demo residential driveway customer.'
),
(
  '22222222-2222-2222-2222-222222222222',
  'Mike',
  'Johnson',
  'Johnson Builders',
  '706-555-0198',
  'mike@johnsonbuilders.example.com',
  '456 Builder Way',
  'Griffin',
  'GA',
  '30223',
  'builder',
  'Demo builder customer.'
),
(
  '33333333-3333-3333-3333-333333333333',
  'Sarah',
  'Davis',
  null,
  '706-555-0177',
  'sarah.davis@example.com',
  '789 Patio Lane',
  'Barnesville',
  'GA',
  '30204',
  'residential',
  'Demo patio estimate customer.'
);

-- Estimates
insert into public.estimates (
  id,
  customer_id,
  job_type,
  job_address,
  description,
  estimated_amount,
  status,
  follow_up_needed,
  notes
)
values
(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'driveway',
  '123 Test Drive, Thomaston, GA 30286',
  'Demo 24x30 concrete driveway estimate.',
  4800.00,
  'accepted',
  false,
  'Accepted demo estimate.'
),
(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '22222222-2222-2222-2222-222222222222',
  'slab',
  '456 Builder Way, Griffin, GA 30223',
  'Demo builder slab estimate.',
  7200.00,
  'pending',
  false,
  'Pending builder estimate.'
),
(
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '33333333-3333-3333-3333-333333333333',
  'patio',
  '789 Patio Lane, Barnesville, GA 30204',
  'Demo stamped patio estimate.',
  3600.00,
  'not_sure',
  true,
  'Customer marked not sure. Needs follow-up site visit.'
);

-- Jobs
-- The accepted estimate trigger may already auto-create a job if the estimate status changed through update.
-- Since seed data inserts the estimate directly as accepted, we manually create the job here.
insert into public.jobs (
  id,
  customer_id,
  estimate_id,
  job_name,
  job_address,
  job_type,
  status,
  description,
  notes
)
values
(
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  '11111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Smith Driveway',
  '123 Test Drive, Thomaston, GA 30286',
  'driveway',
  'scheduled',
  'Demo driveway job created from accepted estimate.',
  'Demo scheduled job.'
),
(
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  '22222222-2222-2222-2222-222222222222',
  null,
  'Johnson Builder Slab',
  '456 Builder Way, Griffin, GA 30223',
  'slab',
  'unscheduled',
  'Demo builder slab job not yet scheduled.',
  'Manual demo job.'
);

-- Crews
insert into public.crews (
  id,
  crew_number,
  crew_name,
  lead_name,
  phone,
  active
)
values
(
  '44444444-4444-4444-4444-444444444444',
  'Crew 1',
  'Flatwork Crew',
  'Demo Lead One',
  '706-555-0101',
  true
),
(
  '55555555-5555-5555-5555-555555555555',
  'Crew 2',
  'Slab Crew',
  'Demo Lead Two',
  '706-555-0102',
  true
);

-- Schedule Events
insert into public.schedule_events (
  id,
  job_id,
  crew_id,
  scheduled_date,
  start_time,
  end_time,
  work_order_number,
  builder_step,
  status,
  notes
)
values
(
  '66666666-6666-6666-6666-666666666666',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  '44444444-4444-4444-4444-444444444444',
  current_date + interval '3 days',
  '08:00',
  '14:00',
  'WO-1001',
  'residential_job',
  'scheduled',
  'Demo residential driveway scheduled.'
),
(
  '77777777-7777-7777-7777-777777777777',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  '55555555-5555-5555-5555-555555555555',
  current_date + interval '5 days',
  '07:30',
  '12:00',
  'WO-1002',
  'form_slab',
  'scheduled',
  'Demo builder slab form step.'
);

-- Invoices
insert into public.invoices (
  id,
  job_id,
  customer_id,
  invoice_number,
  invoice_date,
  due_date,
  subtotal,
  tax_amount,
  total_amount,
  status,
  notes
)
values
(
  '88888888-8888-8888-8888-888888888888',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  '11111111-1111-1111-1111-111111111111',
  'INV-1001',
  current_date,
  current_date + interval '15 days',
  4800.00,
  0.00,
  4800.00,
  'sent',
  'Demo driveway invoice.'
),
(
  '99999999-9999-9999-9999-999999999999',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  '22222222-2222-2222-2222-222222222222',
  'INV-1002',
  current_date,
  current_date + interval '30 days',
  7200.00,
  0.00,
  7200.00,
  'draft',
  'Demo builder invoice.'
);

-- Payments
-- Payment trigger should update INV-1001 to partial.
insert into public.payments (
  id,
  invoice_id,
  payment_date,
  amount,
  payment_method,
  reference_number,
  notes
)
values
(
  '12121212-1212-1212-1212-121212121212',
  '88888888-8888-8888-8888-888888888888',
  current_date,
  2400.00,
  'check',
  'CHK-1001',
  'Demo deposit payment.'
);

-- Expenses
insert into public.expenses (
  id,
  job_id,
  expense_date,
  category,
  vendor,
  description,
  amount,
  payment_method,
  notes
)
values
(
  '13131313-1313-1313-1313-131313131313',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  current_date,
  'material',
  'Demo Concrete Supplier',
  'Concrete/materials for Smith Driveway demo job.',
  1150.00,
  'card',
  'Demo job-specific expense.'
),
(
  '14141414-1414-1414-1414-141414141414',
  null,
  current_date,
  'fuel',
  'Demo Gas Station',
  'Fuel for weekly job travel.',
  85.00,
  'card',
  'Demo general business fuel expense.'
),
(
  '15151515-1515-1515-1515-151515151515',
  null,
  current_date,
  'software',
  'Demo Software Vendor',
  'Monthly website/CRM software cost demo.',
  25.00,
  'card',
  'Demo general software expense.'
);