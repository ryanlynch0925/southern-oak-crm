import { supabase } from "../../../lib/supabase";
import type {
  DatabaseJobRow,
  JobBuilderReference,
} from "../jobs/jobUtils";

interface SupabaseErrorSummary {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

export interface JobUpdatePayload {
  status?: "unscheduled" | "scheduled" | "in_progress" | "completed" | "delayed" | "cancelled";
  notes?: string | null;
  job_name?: string;
  job_address?: string | null;
  description?: string | null;
}

export interface BuilderJobDraft {
  builder: JobBuilderReference & {
    phone?: string;
  };
  community: string;
  lotNumber: string;
  jobAddress: string;
  notes: string;
}

export class JobServiceError extends Error {
  supabaseError: SupabaseErrorSummary;

  constructor(context: string, error: unknown) {
    const supabaseError = summarizeSupabaseError(error);
    super(`${context}: ${supabaseError.message || "Supabase request failed."}`);
    this.name = "JobServiceError";
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

function isMissingBuilderJobFieldsError(error: unknown) {
  const summary = summarizeSupabaseError(error);
  const text = `${summary.message || ""} ${summary.details || ""}`.toLowerCase();
  return text.includes("builder_id") || text.includes("community") || text.includes("lot_number");
}

function throwJobServiceError(context: string, error: unknown): never {
  const serviceError = new JobServiceError(context, error);

  console.error(context, {
    message: serviceError.supabaseError.message,
    code: serviceError.supabaseError.code,
    details: serviceError.supabaseError.details,
    hint: serviceError.supabaseError.hint,
  });

  throw serviceError;
}

const JOB_SELECT_WITH_BUILDER_FIELDS = `
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
  created_at,
  updated_at,
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
  ),
  schedule_events:schedule_events!schedule_events_job_id_fkey (
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
    updated_at
  )
`;

const JOB_SELECT_LEGACY = `
  id,
  customer_id,
  estimate_id,
  job_name,
  job_address,
  job_type,
  status,
  description,
  notes,
  created_at,
  updated_at,
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
  ),
  schedule_events:schedule_events!schedule_events_job_id_fkey (
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
    updated_at
  )
`;

function toJobRow(data: unknown) {
  return data as DatabaseJobRow;
}

async function runJobsSelect(selectClause: string) {
  return supabase
    .from("jobs")
    .select(selectClause)
    .order("created_at", { ascending: false });
}

export async function fetchJobs() {
  const builderFieldResponse = await runJobsSelect(JOB_SELECT_WITH_BUILDER_FIELDS);

  if (!builderFieldResponse.error) {
    return (builderFieldResponse.data || []).map(toJobRow);
  }

  if (!isMissingBuilderJobFieldsError(builderFieldResponse.error)) {
    throwJobServiceError("Unable to load jobs", builderFieldResponse.error);
  }

  const legacyResponse = await runJobsSelect(JOB_SELECT_LEGACY);

  if (legacyResponse.error) {
    throwJobServiceError("Unable to load jobs", legacyResponse.error);
  }

  return (legacyResponse.data || []).map(toJobRow);
}

export async function fetchJobById(jobId: string) {
  const builderFieldResponse = await supabase
    .from("jobs")
    .select(JOB_SELECT_WITH_BUILDER_FIELDS)
    .eq("id", jobId)
    .single();

  if (!builderFieldResponse.error) {
    return toJobRow(builderFieldResponse.data);
  }

  if (!isMissingBuilderJobFieldsError(builderFieldResponse.error)) {
    throwJobServiceError(`Unable to load job ${jobId}`, builderFieldResponse.error);
  }

  const legacyResponse = await supabase
    .from("jobs")
    .select(JOB_SELECT_LEGACY)
    .eq("id", jobId)
    .single();

  if (legacyResponse.error) {
    throwJobServiceError(`Unable to load job ${jobId}`, legacyResponse.error);
  }

  return toJobRow(legacyResponse.data);
}

export async function updateJob(jobId: string, payload: JobUpdatePayload) {
  const { error } = await supabase
    .from("jobs")
    .update(payload)
    .eq("id", jobId)
    .select("id")
    .single();

  if (error) {
    throwJobServiceError(`Unable to update job ${jobId}`, error);
  }

  return fetchJobById(jobId);
}

async function findOrCreateBuilderCustomer(builder: BuilderJobDraft["builder"]) {
  const { data: existingCustomer, error: lookupError } = await supabase
    .from("customers")
    .select("id")
    .eq("customer_type", "builder")
    .eq("company_name", builder.name)
    .maybeSingle();

  if (lookupError) {
    throwJobServiceError(`Unable to locate builder customer for ${builder.name}`, lookupError);
  }

  if (existingCustomer?.id) {
    return existingCustomer.id;
  }

  const { data: createdCustomer, error: createError } = await supabase
    .from("customers")
    .insert({
      first_name: builder.name,
      last_name: null,
      company_name: builder.name,
      phone: builder.phone || null,
      customer_type: "builder",
      notes: null,
    })
    .select("id")
    .single();

  if (createError) {
    throwJobServiceError(`Unable to create builder customer for ${builder.name}`, createError);
  }

  return createdCustomer.id;
}

export async function createBuilderJob(draft: BuilderJobDraft) {
  if (!draft.builder.databaseId) {
    throw new Error("The selected builder is missing its database ID, so the builder job cannot be created.");
  }

  const customerId = await findOrCreateBuilderCustomer(draft.builder);

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      customer_id: customerId,
      estimate_id: null,
      builder_id: draft.builder.databaseId,
      job_name: `${draft.builder.name}${draft.lotNumber ? ` Lot ${draft.lotNumber}` : " Builder Job"}`,
      job_address: draft.jobAddress.trim() || null,
      job_type: "slab",
      status: "unscheduled",
      description: "Builder slab workflow",
      notes: draft.notes.trim() || null,
      community: draft.community.trim() || null,
      lot_number: draft.lotNumber.trim() || null,
    })
    .select(JOB_SELECT_WITH_BUILDER_FIELDS)
    .single();

  if (error) {
    if (isMissingBuilderJobFieldsError(error)) {
      throw new Error("Builder job fields are not available yet. Run supabase-sql/018_builder_job_fields.sql in Supabase before creating builder jobs.");
    }

    throwJobServiceError(`Unable to create builder job for ${draft.builder.name}`, error);
  }

  return toJobRow(data);
}
