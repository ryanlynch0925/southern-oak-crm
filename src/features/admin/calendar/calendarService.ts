import { supabase } from "../../../lib/supabase";
import type { DatabaseScheduleEventRow, ScheduleEventWritePayload } from "./calendarTypes";

interface SupabaseErrorSummary {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

export class ScheduleServiceError extends Error {
  supabaseError: SupabaseErrorSummary;

  constructor(context: string, error: unknown) {
    const supabaseError = summarizeSupabaseError(error);
    super(`${context}: ${supabaseError.message || "Supabase request failed."}`);
    this.name = "ScheduleServiceError";
    this.supabaseError = supabaseError;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function summarizeSupabaseError(error: unknown): SupabaseErrorSummary {
  if (!isRecord(error)) {
    return {};
  }

  return {
    message: typeof error.message === "string" ? error.message : undefined,
    code: typeof error.code === "string" ? error.code : undefined,
    details: typeof error.details === "string" ? error.details : undefined,
    hint: typeof error.hint === "string" ? error.hint : undefined,
  };
}

function throwScheduleServiceError(context: string, error: unknown): never {
  const serviceError = new ScheduleServiceError(context, error);

  console.error(context, {
    message: serviceError.supabaseError.message,
    code: serviceError.supabaseError.code,
    details: serviceError.supabaseError.details,
    hint: serviceError.supabaseError.hint,
  });

  throw serviceError;
}

const SCHEDULE_SELECT = `
  id,
  job_id,
  crew_id,
  scheduled_date,
  start_time,
  end_time,
  work_order_number,
  builder_step,
  status,
  notes,
  created_at,
  updated_at,
  job:jobs!schedule_events_job_id_fkey (
    id,
    customer_id,
    estimate_id,
    job_name,
    job_address,
    job_type,
    status,
    description,
    notes,
    customer:customers!jobs_customer_id_fkey (
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
  ),
  crew:crews!schedule_events_crew_id_fkey (
    id,
    crew_number,
    crew_name,
    lead_name
  )
`;

function toScheduleRow(data: unknown) {
  return data as DatabaseScheduleEventRow;
}

export async function fetchScheduleEvents() {
  const { data, error } = await supabase
    .from("schedule_events")
    .select(SCHEDULE_SELECT)
    .order("scheduled_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    throwScheduleServiceError("Unable to load calendar", error);
  }

  return (data || []).map(toScheduleRow);
}

export async function createScheduleEvent(payload: ScheduleEventWritePayload) {
  const { data, error } = await supabase
    .from("schedule_events")
    .insert(payload)
    .select(SCHEDULE_SELECT)
    .single();

  if (error) {
    throwScheduleServiceError("Unable to create calendar event", error);
  }

  return toScheduleRow(data);
}

export async function updateScheduleEvent(eventId: string, payload: ScheduleEventWritePayload) {
  const { data, error } = await supabase
    .from("schedule_events")
    .update(payload)
    .eq("id", eventId)
    .select(SCHEDULE_SELECT)
    .single();

  if (error) {
    throwScheduleServiceError(`Unable to update calendar event ${eventId}`, error);
  }

  return toScheduleRow(data);
}

export async function findJobIdByEstimateId(estimateId: string) {
  const { data, error } = await supabase
    .from("jobs")
    .select("id")
    .eq("estimate_id", estimateId)
    .maybeSingle();

  if (error) {
    throwScheduleServiceError(`Unable to locate job for estimate ${estimateId}`, error);
  }

  return data?.id || null;
}
