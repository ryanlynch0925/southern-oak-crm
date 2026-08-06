import type { EstimateDecisionKey } from "../../estimates/estimateTypes";
import type {
  FinalEstimateDraft,
  FinalEstimatePublicationSummary,
  FinalEstimatePublicationStatus,
} from "../../estimates/finalEstimateTypes";
import { ACTIVE_SITE_VISIT_DATABASE_STATUSES } from "../calendar/calendarTypes";
import {
  getFinalEstimateExpirationInputValue,
  normalizeFinalEstimateDepositType,
  toNullableCurrencyNumber,
} from "../../estimates/finalEstimateTypes";
import type {
  SiteVisitAppointment,
  Ticket,
  TicketNotification,
  TicketStatus,
} from "../../tickets/ticketTypes";

export type EstimateDatabaseStatus = "pending" | "accepted" | "declined" | "not_sure" | string;
export type EstimateWorkflowStatus =
  | "new_request"
  | "needs_review"
  | "rough_estimate_sent"
  | "interested"
  | "site_visit_requested"
  | "follow_up_needed"
  | "lead_declined"
  | "site_visit_needed"
  | "site_visit_scheduled"
  | "site_visit_completed"
  | "final_quote_sent"
  | "estimate_accepted"
  | "ready_to_schedule"
  | "won"
  | "lost"
  | string;

export interface DatabaseCustomer {
  id: string;
  first_name: string | null;
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
  created_at: string | null;
  updated_at: string | null;
}

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface DatabaseEstimateWithCustomer {
  id: string;
  customer_id: string;
  job_type: string | null;
  job_address: string | null;
  description: string | null;
  estimated_amount: number | string | null;
  status: EstimateDatabaseStatus | null;
  workflow_status: EstimateWorkflowStatus | null;
  follow_up_needed: boolean | null;
  submitted_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  length_ft: number | string | null;
  width_ft: number | string | null;
  square_feet: number | string | null;
  thickness_in: number | string | null;
  finish_type: string | null;
  tear_out: string | null;
  grading: string | null;
  site_access: string | null;
  desired_timeline: string | null;
  rough_estimate_low: number | string | null;
  rough_estimate_high: number | string | null;
  final_quote_amount: number | string | null;
  follow_up_date: string | null;
  estimate_decision: EstimateDecisionKey | string | null;
  decision_question: string | null;
  decision_at: string | null;
  decision_feedback_reason: string | null;
  decision_feedback_comment: string | null;
  admin_notes: string | null;
  attachments: JsonValue | undefined;
  notifications: JsonValue | undefined;
  source: string | null;
  final_estimate_customer_name: string | null;
  final_estimate_customer_email: string | null;
  final_estimate_project_address: string | null;
  final_estimate_project_type: string | null;
  final_estimate_scope_description: string | null;
  final_estimate_total_amount: number | string | null;
  final_estimate_deposit_type: string | null;
  final_estimate_deposit_value: number | string | null;
  final_estimate_payment_terms: string | null;
  final_estimate_scheduling_terms: string | null;
  final_estimate_exclusions: string | null;
  final_estimate_expires_at: string | null;
  estimate_publications?:
    | DatabaseEstimatePublication[]
    | null;
  site_visit_schedule_events?:
    | DatabaseEstimateSiteVisitScheduleEvent[]
    | null;
  linked_jobs?:
    | DatabaseEstimateLinkedJob[]
    | null;
  customer: DatabaseCustomer | DatabaseCustomer[] | null;
}

export interface DatabaseEstimatePublication {
  id: string;
  version_number: number | string | null;
  status: string | null;
  customer_name: string | null;
  customer_email: string | null;
  project_address: string | null;
  project_type: string | null;
  scope_description: string | null;
  total_amount: number | string | null;
  deposit_type: string | null;
  deposit_value: number | string | null;
  deposit_amount: number | string | null;
  payment_terms: string | null;
  scheduling_terms: string | null;
  exclusions: string | null;
  expires_at: string | null;
  published_at: string | null;
  viewed_at: string | null;
  decision: string | null;
  decision_name: string | null;
  decision_email: string | null;
  decision_at: string | null;
  acceptance_statement: string | null;
  declined_reason: string | null;
  revoked_at: string | null;
}

export interface DatabaseScheduleCrewSummary {
  id: string;
  crew_number: string | null;
  crew_name: string | null;
  lead_name: string | null;
}

export interface DatabaseEstimateSiteVisitScheduleEvent {
  id: string;
  estimate_id: string | null;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  crew: DatabaseScheduleCrewSummary | null;
}

export interface DatabaseEstimateLinkedJob {
  id: string;
  status: string | null;
}

export interface EstimateUpdatePayload {
  status?: EstimateDatabaseStatus;
  workflow_status?: EstimateWorkflowStatus;
  follow_up_needed?: boolean;
  follow_up_date?: string | null;
  final_quote_amount?: number | null;
  admin_notes?: string | null;
  estimate_decision?: EstimateDecisionKey | null;
  final_estimate_customer_name?: string | null;
  final_estimate_customer_email?: string | null;
  final_estimate_project_address?: string | null;
  final_estimate_project_type?: string | null;
  final_estimate_scope_description?: string | null;
  final_estimate_total_amount?: number | null;
  final_estimate_deposit_type?: string | null;
  final_estimate_deposit_value?: number | null;
  final_estimate_payment_terms?: string | null;
  final_estimate_scheduling_terms?: string | null;
  final_estimate_exclusions?: string | null;
  final_estimate_expires_at?: string | null;
}

const TICKET_STATUS_TO_WORKFLOW_STATUS: Record<string, EstimateWorkflowStatus> = {
  "New Request": "new_request",
  "Needs Review": "needs_review",
  "Rough Estimate Sent": "rough_estimate_sent",
  Interested: "interested",
  "Site Visit Requested": "site_visit_requested",
  "Follow Up Needed": "follow_up_needed",
  Declined: "lead_declined",
  "Site Visit Needed": "site_visit_needed",
  "Site Visit Scheduled": "site_visit_scheduled",
  Scheduled: "site_visit_scheduled",
  "Site Visit Completed": "site_visit_completed",
  "Final Quote Sent": "final_quote_sent",
  "Estimate Accepted": "estimate_accepted",
  "Ready to Schedule": "ready_to_schedule",
  Won: "won",
  Lost: "lost",
};

const WORKFLOW_STATUS_TO_TICKET_STATUS: Record<string, TicketStatus> = {
  new_request: "New Request",
  needs_review: "Needs Review",
  rough_estimate_sent: "Rough Estimate Sent",
  interested: "Interested",
  site_visit_requested: "Site Visit Requested",
  follow_up_needed: "Follow Up Needed",
  lead_declined: "Declined",
  site_visit_needed: "Site Visit Needed",
  site_visit_scheduled: "Site Visit Scheduled",
  site_visit_completed: "Site Visit Completed",
  final_quote_sent: "Final Quote Sent",
  estimate_accepted: "Estimate Accepted",
  ready_to_schedule: "Ready to Schedule",
  won: "Won",
  lost: "Lost",
};

export function mapTicketStatusToWorkflowStatus(
  status: string,
  fallback: EstimateWorkflowStatus = "new_request"
): EstimateWorkflowStatus {
  return TICKET_STATUS_TO_WORKFLOW_STATUS[status] || fallback;
}

function normalizeEstimateStatusValue(
  value: EstimateDatabaseStatus | null | undefined
): EstimateDatabaseStatus | null {
  const normalizedValue = String(value || "").trim().toLowerCase();
  return normalizedValue || null;
}

function normalizeWorkflowStatus(
  value: EstimateWorkflowStatus | null | undefined
): EstimateWorkflowStatus | null {
  const normalizedValue = String(value || "").trim().toLowerCase();
  return normalizedValue || null;
}

function resolveDisplayWorkflowStatus(
  estimate: DatabaseEstimateWithCustomer,
  hasActiveSiteVisitAppointment: boolean
): EstimateWorkflowStatus | null {
  const explicitWorkflowStatus = normalizeWorkflowStatus(estimate.workflow_status);

  if (!explicitWorkflowStatus || !WORKFLOW_STATUS_TO_TICKET_STATUS[explicitWorkflowStatus]) {
    return null;
  }

  if (hasActiveSiteVisitAppointment) {
    return "site_visit_scheduled";
  }

  if (
    explicitWorkflowStatus === "estimate_accepted"
    && normalizeEstimateStatusValue(estimate.status) !== "accepted"
  ) {
    return null;
  }

  return explicitWorkflowStatus;
}

function hasAcceptedFinalEstimate(estimate: DatabaseEstimateWithCustomer) {
  const publications = Array.isArray(estimate.estimate_publications)
    ? estimate.estimate_publications
    : [];

  return publications.some((publication) =>
    normalizeText(publication.status).toLowerCase() === "accepted"
    || normalizeText(publication.decision).toLowerCase() === "accepted"
  );
}

function hasFinalEstimatePublication(estimate: DatabaseEstimateWithCustomer) {
  return Array.isArray(estimate.estimate_publications)
    && estimate.estimate_publications.length > 0;
}

function hasLinkedJobReadyState(estimate: DatabaseEstimateWithCustomer) {
  return Array.isArray(estimate.linked_jobs)
    && estimate.linked_jobs.some((job) => normalizeText(job.id) !== "");
}

function inferLegacyWorkflowStatus(
  estimate: DatabaseEstimateWithCustomer,
  hasActiveSiteVisitAppointment: boolean
): EstimateWorkflowStatus {
  const estimateStatus = normalizeEstimateStatusValue(estimate.status);
  const estimateDecision = normalizeDecision(estimate.estimate_decision);
  const customerRequestedSiteVisit = estimateDecision === "yes";

  if (hasActiveSiteVisitAppointment) return "site_visit_scheduled";
  if (hasAcceptedFinalEstimate(estimate)) return "estimate_accepted";
  if (hasLinkedJobReadyState(estimate)) return "ready_to_schedule";
  if (hasFinalEstimatePublication(estimate) || estimate.final_quote_amount != null) return "final_quote_sent";
  if (estimateStatus === "accepted" && customerRequestedSiteVisit) return "site_visit_requested";
  if (estimateStatus === "accepted") return "interested";
  if (customerRequestedSiteVisit) return "site_visit_requested";
  if (estimateDecision === "no") return "follow_up_needed";
  if (estimateStatus === "declined") return "lost";
  if (estimateStatus === "not_sure") return "follow_up_needed";
  if (estimate.follow_up_needed || estimate.follow_up_date) return "follow_up_needed";

  return "new_request";
}

export function mapEstimateStatusToTicketStatus(estimate: DatabaseEstimateWithCustomer): TicketStatus {
  const canonicalEstimateStatus = normalizeEstimateStatusValue(estimate.status);

  if (canonicalEstimateStatus === "accepted") {
    return "Estimate Accepted";
  }

  if (canonicalEstimateStatus === "declined") {
    return "Lost";
  }

  if (canonicalEstimateStatus === "not_sure") {
    return "Follow Up Needed";
  }

  const customer = getCustomer(estimate);
  const activeSiteVisitAppointment = getActiveSiteVisitAppointment(estimate, customer);
  const recognizedWorkflowStatus = resolveDisplayWorkflowStatus(
    estimate,
    !!activeSiteVisitAppointment
  );
  const effectiveWorkflowStatus = recognizedWorkflowStatus || inferLegacyWorkflowStatus(
    estimate,
    !!activeSiteVisitAppointment
  );

  return WORKFLOW_STATUS_TO_TICKET_STATUS[effectiveWorkflowStatus] || "New Request";
}

function toNumber(value: number | string | null | undefined): number {
  if (value == null || value === "") return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toNullableNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeText(value: string | null | undefined, fallback = ""): string {
  return value?.trim() || fallback;
}

function getCustomer(estimate: DatabaseEstimateWithCustomer): DatabaseCustomer | null {
  if (Array.isArray(estimate.customer)) return estimate.customer[0] || null;
  return estimate.customer || null;
}

function humanizeText(value: string | null | undefined) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .trim();
}

function buildCustomerName(customer: DatabaseCustomer | null): string {
  if (!customer) return "Unknown Customer";

  const personName = [customer.first_name, customer.last_name]
    .map(part => part?.trim())
    .filter(Boolean)
    .join(" ");

  return normalizeText(customer.company_name) || personName || "Unknown Customer";
}

function buildCity(customer: DatabaseCustomer | null): string {
  if (!customer) return "";
  return [customer.city, customer.state].map(part => part?.trim()).filter(Boolean).join(", ");
}

function buildStateZip(customer: DatabaseCustomer | null) {
  if (!customer) return "";

  return [customer.state, customer.zip_code]
    .map(part => part?.trim())
    .filter(Boolean)
    .join(" ");
}

function buildFullCustomerAddress(customer: DatabaseCustomer | null) {
  if (!customer) return "";

  const cityStateZip = [customer.city?.trim(), buildStateZip(customer)]
    .filter(Boolean)
    .join(", ");

  return [customer.street_address?.trim(), cityStateZip]
    .filter(Boolean)
    .join(", ");
}

function isUsableFinalEstimateProjectAddress(
  value: string | null | undefined,
  customer: DatabaseCustomer | null
) {
  const normalizedValue = normalizeText(value).toLowerCase();

  if (!normalizedValue) {
    return false;
  }

  const customerCity = normalizeText(customer?.city).toLowerCase();
  const customerCityState = buildCity(customer).toLowerCase();
  const customerCityStateZip = [
    normalizeText(customer?.city),
    buildStateZip(customer),
  ]
    .filter(Boolean)
    .join(", ")
    .toLowerCase();
  const customerState = normalizeText(customer?.state).toLowerCase();
  const customerZip = normalizeText(customer?.zip_code).toLowerCase();

  return normalizedValue !== customerCity
    && normalizedValue !== customerCityState
    && normalizedValue !== customerCityStateZip
    && normalizedValue !== customerState
    && normalizedValue !== customerZip;
}

function formatThickness(value: number | string | null): string {
  const numeric = toNullableNumber(value);
  return numeric == null ? "N/A" : `${numeric}"`;
}

function normalizeDecision(value: EstimateDecisionKey | string | null): EstimateDecisionKey | null {
  return value === "yes" || value === "no" ? value : null;
}

function normalizeTimeValue(value: string | null | undefined) {
  return value ? value.slice(0, 5) : "";
}

function buildEstimateProjectAddress(
  estimate: DatabaseEstimateWithCustomer,
  customer: DatabaseCustomer | null
) {
  if (isUsableFinalEstimateProjectAddress(estimate.final_estimate_project_address, customer)) {
    return normalizeText(estimate.final_estimate_project_address);
  }

  if (isUsableFinalEstimateProjectAddress(estimate.job_address, customer)) {
    return normalizeText(estimate.job_address);
  }

  return buildFullCustomerAddress(customer);
}

function buildCrewLabel(crew: DatabaseScheduleCrewSummary | null) {
  if (!crew) {
    return "";
  }

  const crewNumber = normalizeText(crew.crew_number);
  const crewName = normalizeText(crew.crew_name);
  const leadName = normalizeText(crew.lead_name);

  return crewName
    || (crewNumber ? `Crew ${crewNumber}` : "")
    || leadName;
}

function getSiteVisitScheduleEvents(estimate: DatabaseEstimateWithCustomer) {
  return Array.isArray(estimate.site_visit_schedule_events)
    ? estimate.site_visit_schedule_events
    : [];
}

function isActiveSiteVisitScheduleEvent(event: DatabaseEstimateSiteVisitScheduleEvent) {
  return ACTIVE_SITE_VISIT_DATABASE_STATUSES.includes(
    normalizeText(event.status).toLowerCase() as typeof ACTIVE_SITE_VISIT_DATABASE_STATUSES[number]
  );
}

function getActiveSiteVisitAppointment(
  estimate: DatabaseEstimateWithCustomer,
  customer: DatabaseCustomer | null
): SiteVisitAppointment | null {
  const activeEvent = [...getSiteVisitScheduleEvents(estimate)]
    .filter(isActiveSiteVisitScheduleEvent)
    .sort((first, second) => {
      const firstKey = `${normalizeText(first.scheduled_date)} ${normalizeTimeValue(first.start_time)}`;
      const secondKey = `${normalizeText(second.scheduled_date)} ${normalizeTimeValue(second.start_time)}`;
      return secondKey.localeCompare(firstKey);
    })[0];

  if (!activeEvent) {
    return null;
  }

  return {
    eventId: activeEvent.id,
    estimateDatabaseId: estimate.id,
    customerName: buildCustomerName(customer),
    projectAddress: buildEstimateProjectAddress(estimate, customer),
    projectType: normalizeText(
      estimate.final_estimate_project_type,
      humanizeText(estimate.job_type) || "Site Visit"
    ),
    scheduledDate: normalizeText(activeEvent.scheduled_date),
    startTime: normalizeTimeValue(activeEvent.start_time),
    endTime: normalizeTimeValue(activeEvent.end_time),
    crewId: normalizeText(activeEvent.crew?.id),
    crewLabel: buildCrewLabel(activeEvent.crew),
    notes: normalizeText(activeEvent.notes),
    status: normalizeText(activeEvent.status, "scheduled"),
    createdAt: normalizeText(activeEvent.created_at, normalizeText(activeEvent.updated_at)),
  };
}

function decisionLabel(value: EstimateDecisionKey | null): string {
  if (value === "yes") return "Yes / Interested";
  if (value === "no") return "No / Follow Up Needed";
  return "Awaiting decision";
}

function normalizeJsonArray(value: JsonValue | undefined): JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function extractAttachments(value: JsonValue | undefined): string[] {
  return normalizeJsonArray(value)
    .map(item => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const name = item.name;
        return typeof name === "string" ? name : "";
      }
      return "";
    })
    .filter(Boolean);
}

function extractNotifications(value: JsonValue | undefined): TicketNotification[] {
  return normalizeJsonArray(value)
    .map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as { [key: string]: JsonValue };
      return {
        id: typeof record.id === "string" ? record.id : `notification-${index}`,
        type: typeof record.type === "string" ? record.type : "lead_notification",
        title: typeof record.title === "string" ? record.title : "Lead notification",
        message: typeof record.message === "string" ? record.message : "",
        createdAt: typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString(),
      };
    })
    .filter((notification): notification is TicketNotification => !!notification && !!notification.message);
}

function mapFinalEstimateDraft(
  estimate: DatabaseEstimateWithCustomer,
  customer: DatabaseCustomer | null
): FinalEstimateDraft {
  const savedProjectAddress = normalizeText(estimate.final_estimate_project_address);
  const estimateJobAddress = normalizeText(estimate.job_address);
  const customerProjectAddress = buildFullCustomerAddress(customer);

  return {
    customerName: normalizeText(
      estimate.final_estimate_customer_name,
      buildCustomerName(customer)
    ),
    customerEmail: normalizeText(
      estimate.final_estimate_customer_email,
      normalizeText(customer?.email)
    ),
    projectAddress: isUsableFinalEstimateProjectAddress(savedProjectAddress, customer)
      ? savedProjectAddress
      : isUsableFinalEstimateProjectAddress(estimateJobAddress, customer)
        ? estimateJobAddress
        : customerProjectAddress,
    projectType: normalizeText(
      estimate.final_estimate_project_type,
      humanizeText(estimate.job_type) || "Concrete Project"
    ),
    scopeDescription: normalizeText(
      estimate.final_estimate_scope_description,
      normalizeText(estimate.description, normalizeText(estimate.notes))
    ),
    totalAmount: toNullableCurrencyNumber(
      estimate.final_estimate_total_amount ?? estimate.final_quote_amount
    ),
    depositType: normalizeFinalEstimateDepositType(
      estimate.final_estimate_deposit_type
    ),
    depositValue: toNullableCurrencyNumber(
      estimate.final_estimate_deposit_value
    ),
    paymentTerms: normalizeText(estimate.final_estimate_payment_terms),
    schedulingTerms: normalizeText(estimate.final_estimate_scheduling_terms),
    exclusions: normalizeText(estimate.final_estimate_exclusions),
    expiresAt: getFinalEstimateExpirationInputValue(estimate.final_estimate_expires_at),
  };
}

function normalizeFinalEstimatePublicationStatus(
  value: unknown
): FinalEstimatePublicationStatus {
  if (
    value === "draft"
    || value === "published"
    || value === "accepted"
    || value === "declined"
    || value === "not_sure"
    || value === "expired"
    || value === "revoked"
  ) {
    return value;
  }

  return "draft";
}

function normalizeFinalEstimateDecision(
  value: unknown
): FinalEstimatePublicationSummary["decision"] {
  if (value === "accepted" || value === "declined" || value === "not_sure") {
    return value;
  }

  return null;
}

function mapEstimatePublications(
  estimate: DatabaseEstimateWithCustomer
): FinalEstimatePublicationSummary[] {
  const publications = Array.isArray(estimate.estimate_publications)
    ? estimate.estimate_publications
    : [];

  return [...publications]
    .map((publication) => ({
      id: publication.id,
      versionNumber: Number(publication.version_number || 0),
      status: normalizeFinalEstimatePublicationStatus(publication.status),
      customerName: normalizeText(publication.customer_name),
      customerEmail: normalizeText(publication.customer_email),
      projectAddress: normalizeText(publication.project_address),
      projectType: normalizeText(publication.project_type),
      scopeDescription: normalizeText(publication.scope_description),
      totalAmount: Number(publication.total_amount || 0),
      depositType: normalizeFinalEstimateDepositType(publication.deposit_type),
      depositValue: toNullableCurrencyNumber(publication.deposit_value),
      depositAmount: Number(publication.deposit_amount || 0),
      paymentTerms: normalizeText(publication.payment_terms),
      schedulingTerms: normalizeText(publication.scheduling_terms),
      exclusions: normalizeText(publication.exclusions),
      expiresAt: normalizeText(publication.expires_at),
      publishedAt: normalizeText(publication.published_at),
      viewedAt: normalizeText(publication.viewed_at),
      decision: normalizeFinalEstimateDecision(publication.decision),
      decisionName: normalizeText(publication.decision_name),
      decisionEmail: normalizeText(publication.decision_email),
      decisionAt: normalizeText(publication.decision_at),
      acceptanceStatement: normalizeText(publication.acceptance_statement),
      declinedReason: normalizeText(publication.declined_reason),
      revokedAt: normalizeText(publication.revoked_at),
    }))
    .sort((first, second) => second.versionNumber - first.versionNumber);
}

function displayTicketId(databaseId: string): string {
  return `T-${databaseId.slice(0, 8).toUpperCase()}`;
}

export function databaseEstimateToTicket(estimate: DatabaseEstimateWithCustomer): Ticket {
  const customer = getCustomer(estimate);
  const decision = normalizeDecision(estimate.estimate_decision);
  const submittedAt = estimate.submitted_at || estimate.created_at || new Date().toISOString();
  const siteVisitAppointment = getActiveSiteVisitAppointment(estimate, customer);
  const recognizedWorkflowStatus = resolveDisplayWorkflowStatus(
    estimate,
    !!siteVisitAppointment
  );
  const inferredWorkflowStatus = inferLegacyWorkflowStatus(estimate, !!siteVisitAppointment);
  const workflowStatus = recognizedWorkflowStatus || inferredWorkflowStatus;
  const customerStatus = normalizeEstimateStatusValue(estimate.status);
  const status = mapEstimateStatusToTicketStatus(estimate);
  const history = [
    { s: "New Request", d: submittedAt, n: "Submitted via website" },
  ];

  if (status !== "New Request") {
    const siteVisitScheduledLabel = siteVisitAppointment?.scheduledDate
      ? `Site visit scheduled for ${siteVisitAppointment.scheduledDate}${siteVisitAppointment.startTime ? ` at ${siteVisitAppointment.startTime}` : ""}.`
      : "Current estimate status from Supabase";
    history.push({
      s: status,
      d: siteVisitAppointment?.createdAt || estimate.updated_at || estimate.decision_at || submittedAt,
      n: status === "Site Visit Scheduled" ? siteVisitScheduledLabel : "Current estimate status from Supabase",
    });
  }

  return {
    id: displayTicketId(estimate.id),
    databaseId: estimate.id,
    customerDatabaseId: estimate.customer_id,
    at: submittedAt,
    name: buildCustomerName(customer),
    phone: normalizeText(customer?.phone),
    email: normalizeText(customer?.email),
    addr: normalizeText(customer?.street_address, normalizeText(estimate.job_address)),
    city: buildCity(customer),
    jobAddress: normalizeText(estimate.job_address),
    customerStreetAddress: normalizeText(customer?.street_address),
    customerCity: normalizeText(customer?.city),
    customerState: normalizeText(customer?.state),
    customerZip: normalizeText(customer?.zip_code),
    ptype: normalizeText(estimate.job_type, "Estimate"),
    len: toNumber(estimate.length_ft),
    wid: toNumber(estimate.width_ft),
    sqft: toNumber(estimate.square_feet),
    thick: formatThickness(estimate.thickness_in),
    finish: normalizeText(estimate.finish_type, "N/A"),
    tear: normalizeText(estimate.tear_out, "N/A"),
    grade: normalizeText(estimate.grading, "N/A"),
    access: normalizeText(estimate.site_access, "N/A"),
    timeline: normalizeText(estimate.desired_timeline, "N/A"),
    notes: normalizeText(estimate.notes, normalizeText(estimate.description, normalizeText(customer?.notes))),
    rLow: toNullableNumber(estimate.rough_estimate_low),
    rHigh: toNullableNumber(estimate.rough_estimate_high),
    quote: toNullableNumber(estimate.final_quote_amount),
    status,
    workflowStatus,
    customerStatus,
    followUpNeeded: !!estimate.follow_up_needed,
    followUp: estimate.follow_up_date || "",
    files: extractAttachments(estimate.attachments),
    history,
    adminNotes: normalizeText(estimate.admin_notes),
    estimateDecision: decision,
    estimateDecisionLabel: decisionLabel(decision),
    decisionQuestion: normalizeText(estimate.decision_question),
    decisionAt: normalizeText(estimate.decision_at),
    decisionFeedbackReason: normalizeText(estimate.decision_feedback_reason),
    decisionFeedbackComment: normalizeText(estimate.decision_feedback_comment),
    notifications: extractNotifications(estimate.notifications),
    finalEstimateDraft: mapFinalEstimateDraft(estimate, customer),
    finalEstimatePublications: mapEstimatePublications(estimate),
    siteVisitAppointment,
  };
}

export function buildEstimateUpdatePayload(updated: Ticket, previous?: Ticket | null): EstimateUpdatePayload {
  const payload: EstimateUpdatePayload = {};
  const previousWorkflowStatus = normalizeWorkflowStatus(previous?.workflowStatus);
  const nextWorkflowStatus = normalizeWorkflowStatus(updated.workflowStatus)
    || mapTicketStatusToWorkflowStatus(updated.status, previousWorkflowStatus || "new_request");
  const previousCustomerStatus = normalizeEstimateStatusValue(previous?.customerStatus);
  const nextCustomerStatus = normalizeEstimateStatusValue(updated.customerStatus);
  const statusManagedFollowUpNeeded = updated.status === "Follow Up Needed"
    || updated.status === "Site Visit Needed";
  const nextFollowUpNeeded = statusManagedFollowUpNeeded
    ? true
    : updated.status === "Site Visit Requested"
      ? false
      : !!updated.followUpNeeded;

  if (!previous || nextWorkflowStatus !== previousWorkflowStatus) {
    payload.workflow_status = nextWorkflowStatus;
  }

  if (
    nextCustomerStatus
    && (!previous || nextCustomerStatus !== previousCustomerStatus)
  ) {
    payload.status = nextCustomerStatus;
  }

  if (!previous || updated.status !== previous.status || nextWorkflowStatus !== previousWorkflowStatus) {
    if (nextFollowUpNeeded !== !!previous?.followUpNeeded) {
      payload.follow_up_needed = nextFollowUpNeeded;
    }
  }

  if (!previous || updated.followUp !== previous.followUp) {
    payload.follow_up_date = updated.followUp || null;
    const shouldFollowUp = !!updated.followUp || statusManagedFollowUpNeeded;
    if (shouldFollowUp !== !!previous?.followUpNeeded || payload.follow_up_needed == null) {
      payload.follow_up_needed = shouldFollowUp;
    }
  }

  if (!previous || updated.quote !== previous.quote) {
    payload.final_quote_amount = updated.quote == null ? null : Number(updated.quote);
  }

  if (!previous || updated.adminNotes !== previous.adminNotes) {
    payload.admin_notes = updated.adminNotes || null;
  }

  if (updated.estimateDecision !== previous?.estimateDecision) {
    payload.estimate_decision = updated.estimateDecision || null;
  }

  const updatedDraft = updated.finalEstimateDraft;
  const previousDraft = previous?.finalEstimateDraft;

  if (updatedDraft && updatedDraft.customerName !== previousDraft?.customerName) {
    payload.final_estimate_customer_name = updatedDraft.customerName.trim() || null;
  }

  if (updatedDraft && updatedDraft.customerEmail !== previousDraft?.customerEmail) {
    payload.final_estimate_customer_email = updatedDraft.customerEmail.trim() || null;
  }

  if (updatedDraft && updatedDraft.projectAddress !== previousDraft?.projectAddress) {
    payload.final_estimate_project_address = updatedDraft.projectAddress.trim() || null;
  }

  if (updatedDraft && updatedDraft.projectType !== previousDraft?.projectType) {
    payload.final_estimate_project_type = updatedDraft.projectType.trim() || null;
  }

  if (updatedDraft && updatedDraft.scopeDescription !== previousDraft?.scopeDescription) {
    payload.final_estimate_scope_description = updatedDraft.scopeDescription.trim() || null;
  }

  if (updatedDraft && updatedDraft.totalAmount !== previousDraft?.totalAmount) {
    payload.final_estimate_total_amount = updatedDraft.totalAmount == null
      ? null
      : Number(updatedDraft.totalAmount);
  }

  if (updatedDraft && updatedDraft.depositType !== previousDraft?.depositType) {
    payload.final_estimate_deposit_type = updatedDraft.depositType || null;
  }

  if (updatedDraft && updatedDraft.depositValue !== previousDraft?.depositValue) {
    payload.final_estimate_deposit_value = updatedDraft.depositValue == null
      ? null
      : Number(updatedDraft.depositValue);
  }

  if (updatedDraft && updatedDraft.paymentTerms !== previousDraft?.paymentTerms) {
    payload.final_estimate_payment_terms = updatedDraft.paymentTerms.trim() || null;
  }

  if (updatedDraft && updatedDraft.schedulingTerms !== previousDraft?.schedulingTerms) {
    payload.final_estimate_scheduling_terms = updatedDraft.schedulingTerms.trim() || null;
  }

  if (updatedDraft && updatedDraft.exclusions !== previousDraft?.exclusions) {
    payload.final_estimate_exclusions = updatedDraft.exclusions.trim() || null;
  }

  if (updatedDraft && updatedDraft.expiresAt !== previousDraft?.expiresAt) {
    payload.final_estimate_expires_at = updatedDraft.expiresAt || null;
  }

  return payload;
}

export function hasEstimateUpdatePayload(payload: EstimateUpdatePayload): boolean {
  return Object.keys(payload).length > 0;
}
