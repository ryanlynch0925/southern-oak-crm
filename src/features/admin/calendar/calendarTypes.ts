export type DatabaseScheduleStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "delayed"
  | "cancelled";

export const ACTIVE_SITE_VISIT_DATABASE_STATUSES: DatabaseScheduleStatus[] = [
  "scheduled",
  "in_progress",
  "delayed",
];

export type CalendarUiStatus =
  | "Scheduled"
  | "In Progress"
  | "Completed"
  | "Delayed"
  | "Cancelled"
  | "Ready to Schedule"
  | "Pending";

export type ScheduleType = "residential" | "builder_slab" | "site_visit";

export interface DatabaseScheduleCustomerRow {
  id: string;
  first_name: string;
  last_name: string | null;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  customer_type: string | null;
  notes: string | null;
}

export interface DatabaseScheduleJobRow {
  id: string;
  customer_id: string;
  estimate_id: string | null;
  builder_id?: string | null;
  purchase_order_number?: string | null;
  job_name: string;
  job_address: string | null;
  job_type: string;
  status: string;
  description: string | null;
  notes: string | null;
  community?: string | null;
  lot_number?: string | null;
  customer: DatabaseScheduleCustomerRow | null;
}

export interface DatabaseScheduleEstimateRow {
  id: string;
  customer_id: string;
  job_address: string | null;
  job_type: string | null;
  description: string | null;
  customer: DatabaseScheduleCustomerRow | null;
}

export interface DatabaseScheduleCrewRow {
  id: string;
  crew_number: string;
  crew_name: string | null;
  lead_name: string | null;
}

export interface DatabaseScheduleEventRow {
  id: string;
  job_id: string | null;
  estimate_id: string | null;
  crew_id: string | null;
  scheduled_date: string;
  start_time: string | null;
  end_time: string | null;
  work_order_number: string | null;
  builder_step: string | null;
  status: DatabaseScheduleStatus;
  notes: string | null;
  last_reschedule_reason?: string | null;
  last_rescheduled_at?: string | null;
  last_rescheduled_by?: string | null;
  created_at: string;
  updated_at: string | null;
  job: DatabaseScheduleJobRow | null;
  estimate: DatabaseScheduleEstimateRow | null;
  crew: DatabaseScheduleCrewRow | null;
}

export interface CalendarEvent {
  id: string;
  databaseId: string;
  jobId: string;
  estimate_database_id?: string;
  phaseId: string;
  schedule_type: ScheduleType;
  type_label: string;
  title: string;
  customer_name: string;
  builder_name: string;
  job_type: string;
  address: string;
  community: string;
  lot_number: string;
  work_order_number: string;
  date: string;
  time: string;
  end_time: string;
  crew_id: string;
  crew_number: string;
  capacity_used: number;
  counts_toward_crew: boolean;
  status: CalendarUiStatus;
  phase_label: string;
  color: string;
  notes: string;
}

export interface ScheduleCalendarPhase {
  id: string;
  databaseId: string;
  scheduleEventDatabaseId?: string;
  phase_key: string;
  phase_label: string;
  responsible_party: string;
  counts_toward_crew: boolean;
  scheduled_date: string;
  scheduled_time: string;
  end_time?: string;
  crew_id: string;
  work_order_number: string;
  day_capacity_used: number;
  estimated_duration: number;
  status: CalendarUiStatus;
  notes: string;
  last_reschedule_reason?: string;
  last_rescheduled_at?: string;
  last_rescheduled_by?: string;
}

export interface ScheduleCalendarJob {
  id: string;
  databaseId: string;
  job_database_id: string;
  estimate_database_id: string;
  schedule_type: ScheduleType;
  name: string;
  customer_name: string;
  builder_name: string;
  builder_color: string;
  community: string;
  lot_number: string;
  job_type: string;
  job_address: string;
  scheduled_date: string;
  scheduled_time: string;
  estimated_duration: number;
  day_capacity_used: number;
  crew_id: string;
  work_order_number: string;
  status: CalendarUiStatus;
  notes: string;
  last_reschedule_reason?: string;
  last_rescheduled_at?: string;
  last_rescheduled_by?: string;
  phases: ScheduleCalendarPhase[];
}

export interface ScheduleEventWritePayload {
  job_id?: string;
  estimate_id?: string;
  crew_id?: string | null;
  scheduled_date?: string;
  start_time?: string | null;
  end_time?: string | null;
  work_order_number?: string | null;
  builder_step?: string | null;
  status?: DatabaseScheduleStatus;
  notes?: string | null;
  reschedule_reason?: string | null;
}
