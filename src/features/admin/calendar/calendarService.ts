import { supabase } from "../../../lib/supabase";
import type { DatabaseScheduleEventRow, ScheduleEventWritePayload } from "./calendarTypes";

interface SupabaseErrorSummary {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

export interface ProfileDisplayNameRow {
  id: string;
  full_name: string | null;
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

const SCHEDULE_SELECT_WITH_PURCHASE_ORDER = `
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
  last_reschedule_reason,
  last_rescheduled_at,
  last_rescheduled_by,
  created_at,
  updated_at,
  job:jobs!schedule_events_job_id_fkey (
    id,
    customer_id,
    estimate_id,
    builder_id,
    purchase_order_number,
    job_name,
    job_address,
    job_type,
    status,
    description,
    notes,
    community,
    lot_number,
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

const SCHEDULE_SELECT_LEGACY = `
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
  last_reschedule_reason,
  last_rescheduled_at,
  last_rescheduled_by,
  created_at,
  updated_at,
  job:jobs!schedule_events_job_id_fkey (
    id,
    customer_id,
    estimate_id,
    builder_id,
    job_name,
    job_address,
    job_type,
    status,
    description,
    notes,
    community,
    lot_number,
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

function isMissingPurchaseOrderNumberError(error: unknown) {
  const summary = summarizeSupabaseError(error);
  const text = `${summary.message || ""} ${summary.details || ""}`.toLowerCase();
  return summary.code === "42703" && text.includes("purchase_order_number");
}

async function fetchScheduleRowsWithFallback(eventId?: string) {
  const runSelect = (selectClause: string) => {
    const query = supabase
      .from("schedule_events")
      .select(selectClause);

    if (eventId) {
      return query.eq("id", eventId).single();
    }

    return query
      .order("scheduled_date", { ascending: true })
      .order("start_time", { ascending: true });
  };

  const purchaseOrderResponse = await runSelect(SCHEDULE_SELECT_WITH_PURCHASE_ORDER);

  if (!purchaseOrderResponse.error) {
    return purchaseOrderResponse.data;
  }

  if (!isMissingPurchaseOrderNumberError(purchaseOrderResponse.error)) {
    throw purchaseOrderResponse.error;
  }

  const legacyResponse = await runSelect(SCHEDULE_SELECT_LEGACY);

  if (legacyResponse.error) {
    throw legacyResponse.error;
  }

  return legacyResponse.data;
}

export async function fetchScheduleEvents() {
  try {
    const data = await fetchScheduleRowsWithFallback();
    return (data || []).map(toScheduleRow);
  } catch (error) {
    throwScheduleServiceError("Unable to load calendar", error);
  }
}

async function fetchScheduleEventById(eventId: string) {
  try {
    const data = await fetchScheduleRowsWithFallback(eventId);
    return toScheduleRow(data);
  } catch (error) {
    throwScheduleServiceError(`Unable to load calendar event ${eventId}`, error);
  }
}

export async function createScheduleEvent(payload: ScheduleEventWritePayload) {
  const { data, error } = await supabase
    .from("schedule_events")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throwScheduleServiceError("Unable to create calendar event", error);
  }

  return fetchScheduleEventById(data.id);
}

export async function updateScheduleEvent(eventId: string, payload: ScheduleEventWritePayload) {
  const { error } = await supabase
    .from("schedule_events")
    .update(payload)
    .eq("id", eventId)
    .select("id")
    .single();

  if (error) {
    throwScheduleServiceError(`Unable to update calendar event ${eventId}`, error);
  }

  return fetchScheduleEventById(eventId);
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

export async function fetchProfileDisplayNames(userIds: string[]) {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return [] as ProfileDisplayNameRow[];
  }

  const { data, error } = await supabase.rpc("get_profile_display_names", {
    user_ids: userIds,
  });

  if (error) {
    throwScheduleServiceError("Unable to load profile display names", error);
  }

  return (data || []) as ProfileDisplayNameRow[];
}
