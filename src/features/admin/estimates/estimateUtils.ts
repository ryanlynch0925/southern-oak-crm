import type { EstimateDecisionKey } from "../../estimates/estimateTypes";
import type { Ticket, TicketNotification, TicketStatus } from "../../tickets/ticketTypes";

export type EstimateDatabaseStatus = "pending" | "accepted" | "declined" | "not_sure" | string;

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
  customer: DatabaseCustomer | DatabaseCustomer[] | null;
}

export interface EstimateUpdatePayload {
  status?: EstimateDatabaseStatus;
  follow_up_needed?: boolean;
  follow_up_date?: string | null;
  final_quote_amount?: number | null;
  admin_notes?: string | null;
  estimate_decision?: EstimateDecisionKey | null;
}

const TICKET_STATUS_TO_ESTIMATE_STATUS: Record<string, EstimateDatabaseStatus> = {
  "Estimate Accepted": "accepted",
  "Ready to Schedule": "accepted",
  Scheduled: "accepted",
  Won: "accepted",
  Declined: "declined",
  Lost: "declined",
  "Follow Up Needed": "not_sure",
};

export function mapTicketStatusToEstimateStatus(status: string): EstimateDatabaseStatus {
  return TICKET_STATUS_TO_ESTIMATE_STATUS[status] || "pending";
}

export function mapEstimateStatusToTicketStatus(estimate: DatabaseEstimateWithCustomer): TicketStatus {
  const status = String(estimate.status || "pending").toLowerCase();

  if (status === "accepted") return "Estimate Accepted";
  if (status === "declined") return "Declined";
  if (status === "not_sure") return "Follow Up Needed";

  if (status !== "pending") return "New Request";
  if (estimate.estimate_decision === "yes") return "Site Visit Requested";
  if (estimate.estimate_decision === "no") return "Follow Up Needed";
  if (estimate.final_quote_amount != null) return "Final Quote Sent";
  if (estimate.follow_up_needed || estimate.follow_up_date) return "Follow Up Needed";

  return "New Request";
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

function formatThickness(value: number | string | null): string {
  const numeric = toNullableNumber(value);
  return numeric == null ? "N/A" : `${numeric}"`;
}

function normalizeDecision(value: EstimateDecisionKey | string | null): EstimateDecisionKey | null {
  return value === "yes" || value === "no" ? value : null;
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

function displayTicketId(databaseId: string): string {
  return `T-${databaseId.slice(0, 8).toUpperCase()}`;
}

export function databaseEstimateToTicket(estimate: DatabaseEstimateWithCustomer): Ticket {
  const customer = getCustomer(estimate);
  const decision = normalizeDecision(estimate.estimate_decision);
  const submittedAt = estimate.submitted_at || estimate.created_at || new Date().toISOString();
  const status = mapEstimateStatusToTicketStatus(estimate);
  const history = [
    { s: "New Request", d: submittedAt, n: "Submitted via website" },
  ];

  if (status !== "New Request") {
    history.push({
      s: status,
      d: estimate.updated_at || estimate.decision_at || submittedAt,
      n: "Current estimate status from Supabase",
    });
  }

  return {
    id: displayTicketId(estimate.id),
    databaseId: estimate.id,
    at: submittedAt,
    name: buildCustomerName(customer),
    phone: normalizeText(customer?.phone),
    email: normalizeText(customer?.email),
    addr: normalizeText(customer?.street_address, normalizeText(estimate.job_address)),
    city: buildCity(customer),
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
  };
}

export function buildEstimateUpdatePayload(updated: Ticket, previous?: Ticket | null): EstimateUpdatePayload {
  const payload: EstimateUpdatePayload = {};

  if (!previous || updated.status !== previous.status) {
    payload.status = mapTicketStatusToEstimateStatus(updated.status);
    if (updated.status === "Follow Up Needed") {
      payload.follow_up_needed = true;
    }
  }

  if (!previous || updated.followUp !== previous.followUp) {
    payload.follow_up_date = updated.followUp || null;
    payload.follow_up_needed = !!updated.followUp || payload.follow_up_needed || false;
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

  return payload;
}

export function hasEstimateUpdatePayload(payload: EstimateUpdatePayload): boolean {
  return Object.keys(payload).length > 0;
}
