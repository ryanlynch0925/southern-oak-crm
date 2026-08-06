export type FinalEstimateDepositType = "fixed" | "percentage" | "none";

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
  if (
    status === "published"
    && expiresAt
    && new Date(expiresAt).getTime() < Date.now()
  ) {
    return "expired";
  }

  return status;
}
