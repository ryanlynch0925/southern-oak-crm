import { supabase } from "../../lib/supabase";
import type {
  FinalEstimateDraft,
  FinalEstimatePublicationStatus,
  PublicFinalEstimateData,
  PublishFinalEstimateResult,
  SubmitFinalEstimateDecisionInput,
  SubmitFinalEstimateDecisionResult,
} from "./finalEstimateTypes";
import {
  normalizeFinalEstimateDepositType,
  toNullableCurrencyNumber,
} from "./finalEstimateTypes";

type FinalEstimateErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "INVALID"
  | "EXPIRED"
  | "REVOKED"
  | "ALREADY_DECIDED"
  | "UNKNOWN";

const FINAL_ESTIMATE_ERROR_PREFIXES: Record<string, FinalEstimateErrorCode> = {
  FINAL_ESTIMATE_FORBIDDEN: "FORBIDDEN",
  FINAL_ESTIMATE_NOT_FOUND: "NOT_FOUND",
  FINAL_ESTIMATE_VALIDATION: "VALIDATION",
  FINAL_ESTIMATE_INVALID: "INVALID",
  FINAL_ESTIMATE_EXPIRED: "EXPIRED",
  FINAL_ESTIMATE_REVOKED: "REVOKED",
  FINAL_ESTIMATE_ALREADY_DECIDED: "ALREADY_DECIDED",
};

export class FinalEstimateServiceError extends Error {
  code: FinalEstimateErrorCode;

  constructor(message: string, code: FinalEstimateErrorCode = "UNKNOWN") {
    super(message);
    this.name = "FinalEstimateServiceError";
    this.code = code;
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (
    typeof error === "object"
    && error !== null
    && "message" in error
    && typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Final estimate request failed.";
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}

function toFiniteNumber(value: unknown) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function serializeCurrency(
  value: number | string | null | undefined
): string {
  if (value == null || value === "") {
    return "";
  }

  const numericValue = Number(value);

  return Number.isFinite(numericValue)
    ? numericValue.toFixed(2)
    : "";
}

function unwrapRpcError(error: unknown) {
  const message = getErrorMessage(error);

  for (const [prefix, code] of Object.entries(FINAL_ESTIMATE_ERROR_PREFIXES)) {
    const marker = `${prefix}:`;
    const markerIndex = message.indexOf(marker);

    if (markerIndex >= 0) {
      const detail = message.slice(markerIndex + marker.length);
      return new FinalEstimateServiceError(
        detail.trim() || message.trim() || "Final estimate request failed.",
        code
      );
    }
  }

  return new FinalEstimateServiceError(message);
}

function normalizeDraftPayload(draft: FinalEstimateDraft) {
  return {
    customer_name: draft.customerName.trim(),
    customer_email: draft.customerEmail.trim(),
    project_address: draft.projectAddress.trim(),
    project_type: draft.projectType.trim(),
    scope_description: draft.scopeDescription.trim(),
    total_amount: serializeCurrency(draft.totalAmount),
    deposit_type: draft.depositType,
    deposit_value: serializeCurrency(draft.depositValue),
    payment_terms: draft.paymentTerms.trim(),
    scheduling_terms: draft.schedulingTerms.trim(),
    exclusions: draft.exclusions.trim(),
    expires_at: draft.expiresAt || "",
  };
}

function normalizeStatus(
  value: string | null | undefined
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

function mapPublicEstimate(data: Record<string, unknown>): PublicFinalEstimateData {
  const status = normalizeStatus(typeof data.status === "string" ? data.status : "");

  return {
    status,
    decision: data.decision === "accepted" || data.decision === "declined" || data.decision === "not_sure"
      ? data.decision
      : null,
    customerName: typeof data.customer_name === "string" ? data.customer_name : "",
    projectAddress: typeof data.project_address === "string" ? data.project_address : "",
    projectType: typeof data.project_type === "string" ? data.project_type : "",
    scopeDescription: typeof data.scope_description === "string" ? data.scope_description : "",
    totalAmount: Number(data.total_amount || 0),
    depositType: normalizeFinalEstimateDepositType(
      typeof data.deposit_type === "string" ? data.deposit_type : "none"
    ),
    depositValue: toNullableCurrencyNumber(data.deposit_value as number | string | null | undefined),
    depositAmount: Number(data.deposit_amount || 0),
    paymentTerms: typeof data.payment_terms === "string" ? data.payment_terms : "",
    schedulingTerms: typeof data.scheduling_terms === "string" ? data.scheduling_terms : "",
    exclusions: typeof data.exclusions === "string" ? data.exclusions : "",
    expiresAt: typeof data.expires_at === "string" ? data.expires_at : "",
    publishedAt: typeof data.published_at === "string" ? data.published_at : "",
    viewedAt: typeof data.viewed_at === "string" ? data.viewed_at : "",
    decisionAt: typeof data.decision_at === "string" ? data.decision_at : "",
    versionNumber: Number(data.version_number || 0),
  };
}

function assertValidPublishResponse(record: Record<string, unknown> | null) {
  if (!isNonBlankString(record?.publication_id)) {
    throw new FinalEstimateServiceError(
      "The final estimate publish response was incomplete.",
      "UNKNOWN"
    );
  }

  if (normalizeStatus(typeof record?.status === "string" ? record.status : "") !== "published") {
    throw new FinalEstimateServiceError(
      "The final estimate publish response returned an unexpected status.",
      "UNKNOWN"
    );
  }

  if (!Number.isInteger(Number(record?.version_number)) || Number(record?.version_number) <= 0) {
    throw new FinalEstimateServiceError(
      "The final estimate publish response did not include a valid version number.",
      "UNKNOWN"
    );
  }

  if (!isNonBlankString(record?.access_token)) {
    throw new FinalEstimateServiceError(
      "The final estimate publish response did not include a secure access token.",
      "UNKNOWN"
    );
  }

  if (!isValidTimestamp(record?.published_at)) {
    throw new FinalEstimateServiceError(
      "The final estimate publish response did not include a valid publish timestamp.",
      "UNKNOWN"
    );
  }
}

function assertValidPublicSnapshot(record: Record<string, unknown> | null) {
  const status = normalizeStatus(typeof record?.status === "string" ? record.status : "");
  const decision = record?.decision;
  const totalAmount = toFiniteNumber(record?.total_amount);
  const depositAmount = toFiniteNumber(record?.deposit_amount);
  const versionNumber = Number(record?.version_number || 0);
  const decisionAt = record?.decision_at;

  if (status === "expired") {
    throw new FinalEstimateServiceError(
      "This final estimate link has expired.",
      "EXPIRED"
    );
  }

  if (
    !["published", "accepted", "declined", "not_sure"].includes(status)
    || !isNonBlankString(record?.customer_name)
    || !isNonBlankString(record?.scope_description)
    || totalAmount == null
    || totalAmount <= 0
    || depositAmount == null
    || depositAmount < 0
    || depositAmount > totalAmount
    || !Number.isFinite(versionNumber)
    || versionNumber <= 0
    || !isValidTimestamp(record?.published_at)
  ) {
    throw new FinalEstimateServiceError(
      "The final estimate snapshot response was incomplete or malformed.",
      "UNKNOWN"
    );
  }

  if (status === "published" && decision !== null) {
    throw new FinalEstimateServiceError(
      "The final estimate snapshot response returned an unexpected decision for a published estimate.",
      "UNKNOWN"
    );
  }

  if (status === "accepted" && (decision !== "accepted" || !isValidTimestamp(decisionAt))) {
    throw new FinalEstimateServiceError(
      "The accepted final estimate snapshot response was inconsistent.",
      "UNKNOWN"
    );
  }

  if (status === "declined" && (decision !== "declined" || !isValidTimestamp(decisionAt))) {
    throw new FinalEstimateServiceError(
      "The declined final estimate snapshot response was inconsistent.",
      "UNKNOWN"
    );
  }

  if (status === "not_sure" && (decision !== "not_sure" || !isValidTimestamp(decisionAt))) {
    throw new FinalEstimateServiceError(
      "The not sure final estimate snapshot response was inconsistent.",
      "UNKNOWN"
    );
  }
}

function assertValidDecisionResponse(record: Record<string, unknown> | null) {
  const rawStatus = typeof record?.status === "string" ? record.status : "";
  const status = normalizeStatus(rawStatus);
  const rawDecision = record?.decision;

  if (status === "expired") {
    throw new FinalEstimateServiceError(
      "This final estimate link has expired.",
      "EXPIRED"
    );
  }

  if (status === "revoked" || rawStatus === "revoked") {
    throw new FinalEstimateServiceError(
      "This final estimate link has been revoked.",
      "REVOKED"
    );
  }

  if (rawStatus === "already_decided") {
    throw new FinalEstimateServiceError(
      "This final estimate has already received a decision.",
      "ALREADY_DECIDED"
    );
  }

  if (rawDecision !== "accepted" && rawDecision !== "declined" && rawDecision !== "not_sure") {
    throw new FinalEstimateServiceError(
      "The final estimate decision response was malformed.",
      "UNKNOWN"
    );
  }

  if (status !== rawDecision) {
    throw new FinalEstimateServiceError(
      "The final estimate decision response returned mismatched status and decision values.",
      "UNKNOWN"
    );
  }

  if (!isNonBlankString(record?.decision_name)) {
    throw new FinalEstimateServiceError(
      "The final estimate decision response did not include the decision name.",
      "UNKNOWN"
    );
  }

  if (!isValidTimestamp(record?.decision_at)) {
    throw new FinalEstimateServiceError(
      "The final estimate decision response did not include a valid decision timestamp.",
      "UNKNOWN"
    );
  }

  if (!isNonBlankString(record?.publication_id) || !isNonBlankString(record?.estimate_id)) {
    throw new FinalEstimateServiceError(
      "The final estimate decision response did not include the expected record identifiers.",
      "UNKNOWN"
    );
  }
}

export function buildFinalEstimateReviewUrl(accessToken: string) {
  const origin = typeof window !== "undefined"
    ? window.location.origin
    : "";
  const basePath = import.meta.env.BASE_URL || "/";
  const normalizedBasePath = basePath.endsWith("/")
    ? basePath.slice(0, -1)
    : basePath;

  return `${origin}${normalizedBasePath}/estimate/review/${encodeURIComponent(accessToken)}`;
}

export async function publishFinalEstimate(
  estimateId: string,
  draft: FinalEstimateDraft
): Promise<PublishFinalEstimateResult> {
  const { data, error } = await supabase.rpc("publish_final_estimate", {
    p_estimate_id: estimateId,
    p_payload: normalizeDraftPayload(draft),
  });

  if (error) {
    throw unwrapRpcError(error);
  }

  const record = data as Record<string, unknown> | null;
  assertValidPublishResponse(record);

  return {
    publicationId: record!.publication_id as string,
    versionNumber: Number(record!.version_number),
    status: normalizeStatus(record!.status as string),
    publishedAt: record!.published_at as string,
    accessToken: record!.access_token as string,
  };
}

export async function revokeFinalEstimatePublication(publicationId: string) {
  const { data, error } = await supabase.rpc("revoke_final_estimate_publication", {
    p_publication_id: publicationId,
  });

  if (error) {
    throw unwrapRpcError(error);
  }

  const record = data as Record<string, unknown> | null;

  if (!isNonBlankString(record?.publication_id)) {
    throw new FinalEstimateServiceError(
      "The final estimate revoke response was incomplete.",
      "UNKNOWN"
    );
  }

  if (record?.status !== "revoked") {
    throw new FinalEstimateServiceError(
      "The final estimate revoke response returned an unexpected status.",
      "UNKNOWN"
    );
  }

  if (!isValidTimestamp(record?.revoked_at)) {
    throw new FinalEstimateServiceError(
      "The final estimate revoke response did not include a valid revoke timestamp.",
      "UNKNOWN"
    );
  }

  return {
    publicationId: record.publication_id,
    status: "revoked",
    revokedAt: record.revoked_at as string,
  };
}

export async function getPublicFinalEstimate(accessToken: string) {
  const { data, error } = await supabase.rpc("get_public_final_estimate", {
    p_access_token: accessToken,
  });

  if (error) {
    throw unwrapRpcError(error);
  }

  const record = (data || {}) as Record<string, unknown>;
  assertValidPublicSnapshot(record);
  return mapPublicEstimate(record);
}

export async function submitFinalEstimateDecision(
  accessToken: string,
  input: SubmitFinalEstimateDecisionInput
): Promise<SubmitFinalEstimateDecisionResult> {
  const { data, error } = await supabase.rpc("submit_final_estimate_decision", {
    p_access_token: accessToken,
    p_payload: {
      decision: input.decision,
      decision_name: input.decisionName.trim(),
      decision_email: input.decisionEmail.trim(),
      agreement_confirmed: input.agreementConfirmed,
      amount_acknowledged: input.amountAcknowledged,
      deposit_acknowledged: input.depositAcknowledged,
      declined_reason: input.declinedReason.trim(),
    },
  });

  if (error) {
    throw unwrapRpcError(error);
  }

  const record = data as Record<string, unknown> | null;
  assertValidDecisionResponse(record);

  return {
    publicationId: record!.publication_id as string,
    estimateId: record!.estimate_id as string,
    jobId: typeof record?.job_id === "string" ? record.job_id : "",
    status: normalizeStatus(record!.status as string),
    decision: record!.decision as "accepted" | "declined" | "not_sure",
    decisionAt: record!.decision_at as string,
    decisionName: record!.decision_name as string,
    decisionEmail: typeof record?.decision_email === "string" ? record.decision_email : "",
    estimateStatus: record?.estimate_status === "accepted"
      || record?.estimate_status === "declined"
      || record?.estimate_status === "not_sure"
      ? record.estimate_status
      : "pending",
    acceptedAt: typeof record?.accepted_at === "string" ? record.accepted_at : "",
    declinedAt: typeof record?.declined_at === "string" ? record.declined_at : "",
    alreadyRecorded: record?.already_recorded === true,
  };
}
