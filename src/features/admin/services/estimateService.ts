import { supabase } from "../../../lib/supabase";
import type { DatabaseEstimateWithCustomer, EstimateUpdatePayload } from "../estimates/estimateUtils";

interface SupabaseErrorSummary {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  status?: number;
}

export class EstimateServiceError extends Error {
  supabaseError: SupabaseErrorSummary;
  originalError: unknown;

  constructor(context: string, originalError: unknown) {
    const supabaseError = summarizeSupabaseError(originalError);
    super(`${context}: ${supabaseError.message || "Supabase request failed."}`);
    this.name = "EstimateServiceError";
    this.supabaseError = supabaseError;
    this.originalError = originalError;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function readNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" ? value : undefined;
}

function summarizeSupabaseError(error: unknown): SupabaseErrorSummary {
  if (!isRecord(error)) {
    return {};
  }

  return {
    code: readString(error, "code"),
    message: readString(error, "message"),
    details: readString(error, "details"),
    hint: readString(error, "hint"),
    status: readNumber(error, "status") || readNumber(error, "statusCode"),
  };
}

function throwEstimateServiceError(context: string, error: unknown): never {
  const serviceError = new EstimateServiceError(context, error);

  console.error(context, {
    code: serviceError.supabaseError.code,
    message: serviceError.supabaseError.message,
    details: serviceError.supabaseError.details,
    hint: serviceError.supabaseError.hint,
    status: serviceError.supabaseError.status,
  });

  throw serviceError;
}

const ESTIMATE_SELECT = `
  id,
  customer_id,
  job_type,
  job_address,
  description,
  estimated_amount,
  status,
  follow_up_needed,
  submitted_at,
  accepted_at,
  declined_at,
  notes,
  created_at,
  updated_at,
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
  follow_up_date,
  estimate_decision,
  decision_question,
  decision_at,
  decision_feedback_reason,
  decision_feedback_comment,
  admin_notes,
  attachments,
  notifications,
  source,
  customer:customers (
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
    notes,
    created_at,
    updated_at
  )
`;

function toEstimateRecord(data: unknown): DatabaseEstimateWithCustomer {
  return data as DatabaseEstimateWithCustomer;
}

export async function fetchEstimates(): Promise<DatabaseEstimateWithCustomer[]> {
  const { data, error } = await supabase
    .from("estimates")
    .select(ESTIMATE_SELECT)
    .order("submitted_at", { ascending: false });

  if (error) {
    throwEstimateServiceError("Unable to load estimates", error);
  }

  return (data || []).map(toEstimateRecord);
}

export async function fetchEstimateById(estimateId: string): Promise<DatabaseEstimateWithCustomer> {
  const { data, error } = await supabase
    .from("estimates")
    .select(ESTIMATE_SELECT)
    .eq("id", estimateId)
    .single();

  if (error) {
    throwEstimateServiceError(`Unable to load estimate ${estimateId}`, error);
  }

  return toEstimateRecord(data);
}

export async function updateEstimate(
  estimateId: string,
  payload: EstimateUpdatePayload
): Promise<DatabaseEstimateWithCustomer> {
  const { data, error } = await supabase
    .from("estimates")
    .update(payload)
    .eq("id", estimateId)
    .select(ESTIMATE_SELECT)
    .single();

  if (error) {
    throwEstimateServiceError(`Unable to update estimate ${estimateId}`, error);
  }

  return toEstimateRecord(data);
}
