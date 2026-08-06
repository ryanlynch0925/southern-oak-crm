export type FinalEstimateDepositType = "fixed" | "percentage" | "none";

const FINAL_ESTIMATE_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FINAL_ESTIMATE_EXPIRATION_TIME_ZONE = "America/New_York";

export type FinalEstimatePublicationStatus =
  | "draft"
  | "published"
  | "accepted"
  | "declined"
  | "not_sure"
  | "expired"
  | "revoked";

export type FinalEstimateDecision = "accepted" | "declined" | "not_sure" | null;

export interface FinalEstimateDraft {
  customerName: string;
  customerEmail: string;
  projectAddress: string;
  projectType: string;
  scopeDescription: string;
  totalAmount: number | null;
  depositType: FinalEstimateDepositType;
  depositValue: number | null;
  paymentTerms: string;
  schedulingTerms: string;
  exclusions: string;
  expiresAt: string;
}

export interface FinalEstimatePublicationSummary {
  id: string;
  versionNumber: number;
  status: FinalEstimatePublicationStatus;
  customerName: string;
  customerEmail: string;
  projectAddress: string;
  projectType: string;
  scopeDescription: string;
  totalAmount: number;
  depositType: FinalEstimateDepositType;
  depositValue: number | null;
  depositAmount: number;
  paymentTerms: string;
  schedulingTerms: string;
  exclusions: string;
  expiresAt: string;
  publishedAt: string;
  viewedAt: string;
  decision: FinalEstimateDecision;
  decisionName: string;
  decisionEmail: string;
  decisionAt: string;
  acceptanceStatement: string;
  declinedReason: string;
  revokedAt: string;
}

export interface PublishFinalEstimateResult {
  publicationId: string;
  versionNumber: number;
  status: FinalEstimatePublicationStatus;
  publishedAt: string;
  accessToken: string;
}

export interface PublicFinalEstimateData {
  status: FinalEstimatePublicationStatus;
  decision: FinalEstimateDecision;
  customerName: string;
  projectAddress: string;
  projectType: string;
  scopeDescription: string;
  totalAmount: number;
  depositType: FinalEstimateDepositType;
  depositValue: number | null;
  depositAmount: number;
  paymentTerms: string;
  schedulingTerms: string;
  exclusions: string;
  expiresAt: string;
  publishedAt: string;
  viewedAt: string;
  decisionAt: string;
  versionNumber: number;
}

export interface SubmitFinalEstimateDecisionInput {
  decision: Exclude<FinalEstimateDecision, null>;
  decisionName: string;
  decisionEmail: string;
  agreementConfirmed: boolean;
  amountAcknowledged: boolean;
  depositAcknowledged: boolean;
  declinedReason: string;
}

export interface SubmitFinalEstimateDecisionResult {
  publicationId: string;
  estimateId: string;
  jobId: string;
  status: FinalEstimatePublicationStatus;
  decision: FinalEstimateDecision;
  decisionAt: string;
  decisionName: string;
  decisionEmail: string;
  estimateStatus: "pending" | "accepted" | "declined" | "not_sure";
  acceptedAt: string;
  declinedAt: string;
  alreadyRecorded: boolean;
}

export function normalizeFinalEstimateDepositType(
  value: string | null | undefined
): FinalEstimateDepositType {
  if (value === "fixed" || value === "percentage" || value === "none") {
    return value;
  }

  return "none";
}

export function toNullableCurrencyNumber(
  value: number | string | null | undefined
) {
  if (value == null || value === "") {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function isFinalEstimateDateOnlyValue(value: string) {
  return FINAL_ESTIMATE_DATE_ONLY_PATTERN.test(value);
}

function buildLocalDateFromDateOnly(value: string) {
  if (!isFinalEstimateDateOnlyValue(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function getDatePartsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return null;
  }

  return { year, month, day };
}

export function getFinalEstimateExpirationInputValue(
  value: string | null | undefined
) {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return "";
  }

  if (isFinalEstimateDateOnlyValue(normalizedValue)) {
    return normalizedValue;
  }

  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return normalizedValue.slice(0, 10);
  }

  const parts = getDatePartsInTimeZone(
    date,
    FINAL_ESTIMATE_EXPIRATION_TIME_ZONE
  );

  return parts
    ? `${parts.year}-${parts.month}-${parts.day}`
    : normalizedValue.slice(0, 10);
}

export function formatFinalEstimateCalendarDate(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  }
) {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return "";
  }

  const dateOnlyValue = isFinalEstimateDateOnlyValue(normalizedValue)
    ? normalizedValue
    : getFinalEstimateExpirationInputValue(normalizedValue);
  const date = buildLocalDateFromDateOnly(dateOnlyValue);

  if (!date || Number.isNaN(date.getTime())) {
    return normalizedValue;
  }

  return date.toLocaleDateString("en-US", options);
}

function getFinalEstimateExpirationTimestamp(
  value: string | null | undefined
) {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return null;
  }

  if (isFinalEstimateDateOnlyValue(normalizedValue)) {
    const date = buildLocalDateFromDateOnly(normalizedValue);

    if (!date) {
      return null;
    }

    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() + 1
    ).getTime();
  }

  const date = new Date(normalizedValue);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

export function calculateFinalEstimateDepositAmount(
  totalAmount: number | null | undefined,
  depositType: FinalEstimateDepositType,
  depositValue: number | null | undefined
) {
  const safeTotal = Number(totalAmount || 0);
  const safeValue = Number(depositValue || 0);

  if (depositType === "fixed") {
    return Number(Math.max(safeValue, 0).toFixed(2));
  }

  if (depositType === "percentage") {
    return Number(((safeTotal * Math.max(safeValue, 0)) / 100).toFixed(2));
  }

  return 0;
}

export function calculateFinalEstimateRemainingAmount(
  totalAmount: number | null | undefined,
  depositAmount: number | null | undefined
) {
  const remaining = Number(totalAmount || 0) - Number(depositAmount || 0);
  return Number(Math.max(remaining, 0).toFixed(2));
}

export function getEffectiveFinalEstimateStatus(
  status: FinalEstimatePublicationStatus,
  expiresAt: string
): FinalEstimatePublicationStatus {
  const expirationTimestamp = getFinalEstimateExpirationTimestamp(expiresAt);

  if (
    status === "published"
    && expirationTimestamp != null
    && expirationTimestamp < Date.now()
  ) {
    return "expired";
  }

  return status;
}
