import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { AppRole } from "../auth/roles";
import { Btn, Card, Modal } from "../shared/AdminPrimitives";
import { B, INP } from "../shared/adminStyles";
import {
  buildFinalEstimateReviewUrl,
  FinalEstimateServiceError,
  publishFinalEstimate,
  revokeFinalEstimatePublication,
} from "../../estimates/finalEstimateService";
import type {
  FinalEstimateDraft,
  FinalEstimatePublicationSummary,
} from "../../estimates/finalEstimateTypes";
import {
  calculateFinalEstimateDepositAmount,
  calculateFinalEstimateRemainingAmount,
  formatFinalEstimateCalendarDate,
  getEffectiveFinalEstimateStatus,
} from "../../estimates/finalEstimateTypes";
import type { Ticket } from "../../tickets/ticketTypes";

type DraftErrors = Partial<Record<keyof FinalEstimateDraft, string>>;

const EMPTY_FINAL_ESTIMATE_DRAFT: FinalEstimateDraft = {
  customerName: "",
  customerEmail: "",
  projectAddress: "",
  projectType: "",
  scopeDescription: "",
  totalAmount: null,
  depositType: "none",
  depositValue: null,
  paymentTerms: "",
  schedulingTerms: "",
  exclusions: "",
  expiresAt: "",
};

function fmtMoney(value: number | null | undefined) {
  if (value == null) {
    return "-";
  }

  return `$${Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDateTime(value: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function fmtDate(value: string) {
  if (!value) {
    return "-";
  }

  return formatFinalEstimateCalendarDate(value) || value;
}

function getStatusTone(publication: FinalEstimatePublicationSummary) {
  const effectiveStatus = getEffectiveFinalEstimateStatus(
    publication.status,
    publication.expiresAt
  );

  switch (effectiveStatus) {
    case "accepted":
      return { bg: "#E6F3EA", fg: "#25603C", label: "Accepted" };
    case "declined":
      return { bg: "#FCF3CF", fg: "#8A6A12", label: "Declined" };
    case "not_sure":
      return { bg: "#F8F1D9", fg: "#8A6A12", label: "Not Sure" };
    case "expired":
      return { bg: "#F3F4F2", fg: "#5F645D", label: "Expired" };
    case "revoked":
      return { bg: "#F9E8E4", fg: "#A14B40", label: "Revoked" };
    default:
      return { bg: "#E8F1FA", fg: "#275A85", label: "Published" };
  }
}

function validateDraft(draft: FinalEstimateDraft) {
  const errors: DraftErrors = {};

  if (!draft.customerName.trim()) {
    errors.customerName = "Customer name is required.";
  }

  if (!draft.scopeDescription.trim()) {
    errors.scopeDescription = "Scope description is required.";
  }

  if (draft.totalAmount == null || !Number.isFinite(Number(draft.totalAmount)) || Number(draft.totalAmount) <= 0) {
    errors.totalAmount = "Enter a final total greater than zero.";
  }

  if (!draft.paymentTerms.trim()) {
    errors.paymentTerms = "Payment terms are required.";
  }

  if (!["fixed", "percentage", "none"].includes(draft.depositType)) {
    errors.depositType = "Select a valid deposit type.";
  }

  if (draft.customerEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.customerEmail.trim())) {
    errors.customerEmail = "Enter a valid email address.";
  }

  if ((draft.depositType === "fixed" || draft.depositType === "percentage")) {
    if (draft.depositValue == null || !Number.isFinite(Number(draft.depositValue)) || Number(draft.depositValue) < 0) {
      errors.depositValue = "Enter a valid deposit value.";
    }

    if (draft.depositType === "percentage" && Number(draft.depositValue || 0) > 100) {
      errors.depositValue = "Percentage deposits must be 100 or less.";
    }
  }

  const totalAmount = Number(draft.totalAmount || 0);
  const depositAmount = calculateFinalEstimateDepositAmount(
    draft.totalAmount,
    draft.depositType,
    draft.depositValue
  );

  if (depositAmount > totalAmount) {
    errors.depositValue = "Deposit amount cannot exceed the final total.";
  }

  if (draft.expiresAt && !/^\d{4}-\d{2}-\d{2}$/.test(draft.expiresAt)) {
    errors.expiresAt = "Enter a valid expiration date.";
  }

  return errors;
}

function sanitizeDraft(draft: FinalEstimateDraft): FinalEstimateDraft {
  if (draft.depositType !== "fixed" && draft.depositType !== "percentage") {
    return {
      ...draft,
      depositType: "none",
      depositValue: null,
    };
  }

  return draft;
}

function normalizeAddressValue(value: string | null | undefined) {
  return value?.trim() || "";
}

function normalizeAddressComparisonValue(value: string | null | undefined) {
  return normalizeAddressValue(value)
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .toLowerCase();
}

function isSameAddressValue(left: string, right: string) {
  return normalizeAddressComparisonValue(left) === normalizeAddressComparisonValue(right);
}

function getCustomerAddressParts(ticket: Ticket) {
  const street = normalizeAddressValue(ticket.customerStreetAddress)
    || normalizeAddressValue(ticket.addr);
  const parsedCityParts = normalizeAddressValue(ticket.city)
    .split(",")
    .map(normalizeAddressValue)
    .filter(Boolean);
  const parsedCity = parsedCityParts[0] || "";
  const parsedState = parsedCityParts.slice(1).join(", ");

  return {
    street,
    city: normalizeAddressValue(ticket.customerCity) || parsedCity,
    state: normalizeAddressValue(ticket.customerState) || parsedState,
    zip: normalizeAddressValue(ticket.customerZip),
  };
}

function buildCustomerAddressFallback(ticket: Ticket) {
  const { street, city, state, zip } = getCustomerAddressParts(ticket);

  const stateZip = [state, zip]
    .filter(Boolean)
    .join(" ");

  const cityStateZip = [city, stateZip]
    .filter(Boolean)
    .join(", ");

  return [street, cityStateZip]
    .filter(Boolean)
    .join(", ");
}

function buildCustomerCityState(ticket: Ticket) {
  const { city, state } = getCustomerAddressParts(ticket);

  return [city, state]
    .filter(Boolean)
    .join(", ");
}

function buildCustomerCityStateZip(ticket: Ticket) {
  const { city, state, zip } = getCustomerAddressParts(ticket);
  const stateZip = [state, zip]
    .filter(Boolean)
    .join(" ");

  return [city, stateZip]
    .filter(Boolean)
    .join(", ");
}

function isUsableProjectAddress(value: string | null | undefined, ticket: Ticket) {
  const normalizedValue = normalizeAddressComparisonValue(value);
  const { city, state, zip } = getCustomerAddressParts(ticket);

  if (!normalizedValue) {
    return false;
  }

  const customerCity = normalizeAddressComparisonValue(city);
  const customerCityState = normalizeAddressComparisonValue(buildCustomerCityState(ticket));
  const customerCityStateZip = normalizeAddressComparisonValue(buildCustomerCityStateZip(ticket));
  const customerState = normalizeAddressComparisonValue(state);
  const customerZip = normalizeAddressComparisonValue(zip);

  if (
    normalizedValue === customerCity
    || normalizedValue === customerCityState
    || normalizedValue === customerCityStateZip
    || normalizedValue === customerState
    || normalizedValue === customerZip
  ) {
    return false;
  }

  return true;
}

function resolveInitialProjectAddress(ticket: Ticket) {
  const currentDraftAddress = normalizeAddressValue(ticket.finalEstimateDraft?.projectAddress);
  const estimateJobAddress = normalizeAddressValue(ticket.jobAddress);
  const customerAddressFallback = buildCustomerAddressFallback(ticket);

  if (isUsableProjectAddress(currentDraftAddress, ticket)) {
    return currentDraftAddress;
  }

  if (isUsableProjectAddress(estimateJobAddress, ticket)) {
    return estimateJobAddress;
  }

  if (isUsableProjectAddress(customerAddressFallback, ticket)) {
    return customerAddressFallback;
  }

  return "";
}

export default function FinalEstimatePanel({
  ticket,
  appRole,
  setTicket,
  onRefreshTicket,
}: {
  ticket: Ticket;
  appRole: AppRole | null;
  setTicket: Dispatch<SetStateAction<Ticket>>;
  onRefreshTicket: () => Promise<Ticket | null>;
}) {
  const [draftErrors, setDraftErrors] = useState<DraftErrors>({});
  const [publishError, setPublishError] = useState("");
  const [publishSuccess, setPublishSuccess] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");
  const [revokeError, setRevokeError] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<FinalEstimatePublicationSummary | null>(null);
  const [publicationLinks, setPublicationLinks] = useState<Record<string, string>>({});
  const projectAddressDirtyRef = useRef(false);

  const estimateIdentity = ticket.databaseId || ticket.id;

  const draft = sanitizeDraft(ticket.finalEstimateDraft || EMPTY_FINAL_ESTIMATE_DRAFT);
  const publications = ticket.finalEstimatePublications || [];
  const canRevoke = appRole === "owner" || appRole === "admin";
  const hasActivePublishedPublication = publications.some((publication) => (
    getEffectiveFinalEstimateStatus(publication.status, publication.expiresAt) === "published"
  ));

  useEffect(() => {
    projectAddressDirtyRef.current = false;
  }, [estimateIdentity]);

  useEffect(() => {
    if (projectAddressDirtyRef.current) {
      return;
    }

    const resolvedInitialProjectAddress = resolveInitialProjectAddress(ticket);

    if (!resolvedInitialProjectAddress) {
      return;
    }

    setTicket((current) => {
      const currentDraft = sanitizeDraft(current.finalEstimateDraft || EMPTY_FINAL_ESTIMATE_DRAFT);
      const currentAddress = normalizeAddressValue(currentDraft.projectAddress);
      const savedDraftAddress = normalizeAddressValue(ticket.finalEstimateDraft?.projectAddress);

      if (
        isUsableProjectAddress(currentAddress, current)
        && !isSameAddressValue(currentAddress, savedDraftAddress)
      ) {
        return current;
      }

      if (isSameAddressValue(currentAddress, resolvedInitialProjectAddress)) {
        return current;
      }

      return {
        ...current,
        finalEstimateDraft: {
          ...currentDraft,
          projectAddress: resolvedInitialProjectAddress,
        },
      };
    });
  }, [
    estimateIdentity,
    setTicket,
    ticket,
    ticket.addr,
    ticket.city,
    ticket.customerCity,
    ticket.customerState,
    ticket.customerStreetAddress,
    ticket.customerZip,
    ticket.finalEstimateDraft?.projectAddress,
    ticket.jobAddress,
  ]);

  useEffect(() => {
    if (!hasActivePublishedPublication) {
      return undefined;
    }

    const refreshIfVisible = () => {
      if (document.visibilityState !== "hidden") {
        void refreshTicket();
      }
    };

    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [hasActivePublishedPublication]);

  const depositAmount = useMemo(() => (
    calculateFinalEstimateDepositAmount(
      draft.totalAmount,
      draft.depositType,
      draft.depositValue
    )
  ), [draft.depositType, draft.depositValue, draft.totalAmount]);

  const remainingAmount = useMemo(() => (
    calculateFinalEstimateRemainingAmount(
      draft.totalAmount,
      depositAmount
    )
  ), [depositAmount, draft.totalAmount]);

  const readyForInvoicePublication = useMemo(() => (
    publications.find((publication) => getEffectiveFinalEstimateStatus(publication.status, publication.expiresAt) === "accepted") || null
  ), [publications]);

  const updateDraft = <K extends keyof FinalEstimateDraft>(
    key: K,
    value: FinalEstimateDraft[K]
  ) => {
    setTicket((current) => ({
      ...current,
      finalEstimateDraft: {
        ...sanitizeDraft(current.finalEstimateDraft || draft),
        [key]: value,
      },
    }));
    setDraftErrors((current) => ({
      ...current,
      [key]: "",
    }));
    setPublishError("");
    setPublishSuccess("");
    setCopyFeedback("");
    setRevokeError("");
  };

  const refreshTicket = async () => {
    setIsRefreshing(true);
    setPublishError("");
    setRevokeError("");

    try {
      return await onRefreshTicket();
    } finally {
      setIsRefreshing(false);
    }
  };

  const openPublishConfirmation = () => {
    const nextErrors = validateDraft(draft);
    setDraftErrors(nextErrors);
    setPublishError("");
    setPublishSuccess("");
    setCopyFeedback("");

    if (Object.keys(nextErrors).length > 0) {
      setPublishError("Resolve the highlighted final estimate fields before publishing.");
      return;
    }

    setShowPublishConfirm(true);
  };

  const confirmPublish = async () => {
    if (!ticket.databaseId) {
      setPublishError("This estimate is missing its database ID and cannot be published yet.");
      setShowPublishConfirm(false);
      return;
    }

    setIsPublishing(true);
    setPublishError("");
    setPublishSuccess("");
    setCopyFeedback("");

    try {
      const result = await publishFinalEstimate(ticket.databaseId, draft);
      const reviewLink = buildFinalEstimateReviewUrl(result.accessToken);
      setPublicationLinks((current) => ({
        ...current,
        [result.publicationId]: reviewLink,
      }));

      await refreshTicket();

      try {
        await navigator.clipboard.writeText(reviewLink);
        setCopyFeedback("Customer link copied to your clipboard. Copy this secure link now. It cannot be recovered after refreshing or leaving this page.");
      } catch {
        setCopyFeedback("Published successfully. Copy this secure link now from the Copy Customer Link button below. It cannot be recovered after refreshing or leaving this page.");
      }

      setPublishSuccess(`Version ${result.versionNumber} published on ${fmtDateTime(result.publishedAt)}.`);
      setShowPublishConfirm(false);
    } catch (error) {
      setPublishError(
        error instanceof FinalEstimateServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unable to publish the final estimate."
      );
    } finally {
      setIsPublishing(false);
    }
  };

  const copyPublicationLink = async (publicationId: string) => {
    const cachedLink = publicationLinks[publicationId] || "";

    if (!cachedLink) {
      setCopyFeedback("This secure link is not available anymore. It is only kept in memory immediately after publishing and cannot be recovered after refreshing or leaving the page. Publish a revised version to generate a new secure link.");
      return;
    }

    try {
      await navigator.clipboard.writeText(cachedLink);
      setCopyFeedback("Customer link copied to your clipboard. Copy this secure link now. It cannot be recovered after refreshing or leaving this page.");
    } catch {
      setCopyFeedback(cachedLink);
    }
  };

  const confirmRevoke = async () => {
    if (!revokeTarget) {
      return;
    }

    setIsRevoking(true);
    setRevokeError("");
    setPublishSuccess("");

    try {
      await revokeFinalEstimatePublication(revokeTarget.id);
      await refreshTicket();
      setRevokeTarget(null);
      setPublishSuccess(`Version ${revokeTarget.versionNumber} was revoked.`);
    } catch (error) {
      setRevokeError(
        error instanceof FinalEstimateServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unable to revoke the final estimate link."
      );
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: ".82rem", fontWeight: 700, color: B.dark, textTransform: "uppercase", letterSpacing: .5, margin: 0 }}>
            <i className="ti ti-file-check" style={{ marginRight: 6, color: B.bronze }} aria-hidden="true" />
            Final Estimate
          </h3>
          <p style={{ fontSize: ".78rem", color: B.gray, margin: "6px 0 0", lineHeight: 1.5 }}>
            Prepare a customer-facing final estimate, publish a locked snapshot, and track customer acceptance or decline.
          </p>
          <p style={{ fontSize: ".74rem", color: B.gray, margin: "8px 0 0", lineHeight: 1.5 }}>
            Copy this secure link now. It cannot be recovered after refreshing or leaving the page. Publishing a revised version creates a new secure link and revokes the previous active undecided link.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {readyForInvoicePublication && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, background: "#E6F3EA", color: "#25603C", fontSize: ".72rem", fontWeight: 700 }}>
              <i className="ti ti-receipt-2" aria-hidden="true" />
              Ready for Invoice
            </span>
          )}
          <Btn sm v="outline" onClick={() => { void refreshTicket(); }} disabled={isRefreshing}>
            <i className="ti ti-refresh" style={{ marginRight: 5, fontSize: 12 }} aria-hidden="true" />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Btn>
          <Btn sm v="green" onClick={openPublishConfirmation} disabled={isPublishing}>
            <i className="ti ti-lock-check" style={{ marginRight: 5, fontSize: 12 }} aria-hidden="true" />
            Publish Final Estimate
          </Btn>
        </div>
      </div>

      {(publishError || publishSuccess || copyFeedback || revokeError) && (
        <div
          style={{
            borderRadius: 10,
            padding: "12px 14px",
            marginBottom: 16,
            background: publishError || revokeError
              ? "#FFF7F5"
              : publishSuccess
                ? "#E6F3EA"
                : "#F7F4EC",
            border: `1px solid ${publishError || revokeError ? "#E5C3BD" : publishSuccess ? "#BED9C5" : B.border}`,
            color: publishError || revokeError
              ? "#922B21"
              : publishSuccess
                ? "#25603C"
                : B.dark,
            fontSize: ".78rem",
            lineHeight: 1.55,
            whiteSpace: copyFeedback.startsWith("http") ? "pre-wrap" : "normal",
          }}
        >
          {publishError || revokeError || publishSuccess || copyFeedback}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: ".76rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>Customer Name *</label>
          <input style={{ ...INP, borderColor: draftErrors.customerName ? "#922B21" : B.border }} value={draft.customerName} onChange={(event) => updateDraft("customerName", event.target.value)} />
          {draftErrors.customerName && <div style={{ marginTop: 5, fontSize: ".72rem", color: "#922B21" }}>{draftErrors.customerName}</div>}
        </div>
        <div>
          <label style={{ display: "block", fontSize: ".76rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>Customer Email</label>
          <input style={{ ...INP, borderColor: draftErrors.customerEmail ? "#922B21" : B.border }} value={draft.customerEmail} onChange={(event) => updateDraft("customerEmail", event.target.value)} />
          {draftErrors.customerEmail && <div style={{ marginTop: 5, fontSize: ".72rem", color: "#922B21" }}>{draftErrors.customerEmail}</div>}
        </div>
        <div>
          <label style={{ display: "block", fontSize: ".76rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>Project Address</label>
          <input
            style={INP}
            value={draft.projectAddress}
            onChange={(event) => {
              projectAddressDirtyRef.current = true;
              updateDraft("projectAddress", event.target.value);
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: ".76rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>Project Type</label>
          <input style={INP} value={draft.projectType} onChange={(event) => updateDraft("projectType", event.target.value)} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "block", fontSize: ".76rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>Scope Description *</label>
          <textarea
            style={{ ...INP, minHeight: 110, resize: "vertical", borderColor: draftErrors.scopeDescription ? "#922B21" : B.border }}
            value={draft.scopeDescription}
            onChange={(event) => updateDraft("scopeDescription", event.target.value)}
          />
          {draftErrors.scopeDescription && <div style={{ marginTop: 5, fontSize: ".72rem", color: "#922B21" }}>{draftErrors.scopeDescription}</div>}
        </div>
        <div>
          <label style={{ display: "block", fontSize: ".76rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>Final Total *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            style={{ ...INP, borderColor: draftErrors.totalAmount ? "#922B21" : B.border }}
            value={draft.totalAmount ?? ""}
            onChange={(event) => updateDraft("totalAmount", event.target.value === "" ? null : Number(event.target.value))}
          />
          {draftErrors.totalAmount && <div style={{ marginTop: 5, fontSize: ".72rem", color: "#922B21" }}>{draftErrors.totalAmount}</div>}
        </div>
        <div>
          <label style={{ display: "block", fontSize: ".76rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>Expiration Date</label>
          <input
            type="date"
            style={{ ...INP, borderColor: draftErrors.expiresAt ? "#922B21" : B.border }}
            value={draft.expiresAt}
            onChange={(event) => updateDraft("expiresAt", event.target.value)}
          />
          {draftErrors.expiresAt && <div style={{ marginTop: 5, fontSize: ".72rem", color: "#922B21" }}>{draftErrors.expiresAt}</div>}
        </div>
        <div>
          <label style={{ display: "block", fontSize: ".76rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>Deposit Type *</label>
          <select
            style={{ ...INP, borderColor: draftErrors.depositType ? "#922B21" : B.border }}
            value={draft.depositType}
            onChange={(event) => updateDraft("depositType", event.target.value as FinalEstimateDraft["depositType"])}
          >
            <option value="none">None</option>
            <option value="fixed">Fixed</option>
            <option value="percentage">Percentage</option>
          </select>
          {draftErrors.depositType && <div style={{ marginTop: 5, fontSize: ".72rem", color: "#922B21" }}>{draftErrors.depositType}</div>}
        </div>
        <div>
          <label style={{ display: "block", fontSize: ".76rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>
            Deposit Value {draft.depositType === "percentage" ? "(%)" : draft.depositType === "fixed" ? "($)" : ""}
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            disabled={draft.depositType === "none"}
            style={{ ...INP, borderColor: draftErrors.depositValue ? "#922B21" : B.border, opacity: draft.depositType === "none" ? 0.6 : 1 }}
            value={draft.depositType === "none" ? "" : draft.depositValue ?? ""}
            onChange={(event) => updateDraft("depositValue", event.target.value === "" ? null : Number(event.target.value))}
          />
          {draftErrors.depositValue && <div style={{ marginTop: 5, fontSize: ".72rem", color: "#922B21" }}>{draftErrors.depositValue}</div>}
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "block", fontSize: ".76rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>Payment Terms *</label>
          <textarea
            style={{ ...INP, minHeight: 90, resize: "vertical", borderColor: draftErrors.paymentTerms ? "#922B21" : B.border }}
            value={draft.paymentTerms}
            onChange={(event) => updateDraft("paymentTerms", event.target.value)}
          />
          {draftErrors.paymentTerms && <div style={{ marginTop: 5, fontSize: ".72rem", color: "#922B21" }}>{draftErrors.paymentTerms}</div>}
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "block", fontSize: ".76rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>Scheduling Terms</label>
          <textarea style={{ ...INP, minHeight: 80, resize: "vertical" }} value={draft.schedulingTerms} onChange={(event) => updateDraft("schedulingTerms", event.target.value)} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "block", fontSize: ".76rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>Exclusions</label>
          <textarea style={{ ...INP, minHeight: 80, resize: "vertical" }} value={draft.exclusions} onChange={(event) => updateDraft("exclusions", event.target.value)} />
        </div>
      </div>

      <div style={{ marginTop: 18, borderTop: `1px solid ${B.border}`, paddingTop: 16, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        <div style={{ background: B.sandD, borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 4 }}>Final Total</div>
          <div style={{ fontSize: "1.04rem", fontWeight: 700, color: B.dark }}>{fmtMoney(draft.totalAmount)}</div>
        </div>
        <div style={{ background: B.sandD, borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 4 }}>Deposit Required</div>
          <div style={{ fontSize: "1.04rem", fontWeight: 700, color: B.dark }}>{fmtMoney(depositAmount)}</div>
        </div>
        <div style={{ background: B.sandD, borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 4 }}>Remaining Contract Amount</div>
          <div style={{ fontSize: "1.04rem", fontWeight: 700, color: B.dark }}>{fmtMoney(remainingAmount)}</div>
        </div>
      </div>

      <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${B.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ fontSize: ".84rem", fontWeight: 700, color: B.dark }}>Published Versions</div>
          <div style={{ fontSize: ".74rem", color: B.gray }}>
            Published snapshots stay locked even if this estimate ticket changes later.
          </div>
        </div>

        {publications.length === 0 ? (
          <div style={{ borderRadius: 10, padding: "14px 16px", background: B.sandD, color: B.gray, fontSize: ".78rem", lineHeight: 1.5 }}>
            No final estimate has been published yet. Draft the customer-facing terms above, save changes if needed, then publish to generate a secure review link.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {publications.map((publication) => {
              const tone = getStatusTone(publication);
              const effectiveStatus = getEffectiveFinalEstimateStatus(
                publication.status,
                publication.expiresAt
              );
              const canRevokePublication = canRevoke
                && effectiveStatus === "published";

              return (
                <div key={publication.id} style={{ border: `1px solid ${B.border}`, borderRadius: 12, padding: "14px 16px", background: B.white }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ fontSize: ".92rem", fontWeight: 700, color: B.dark }}>
                        Version {publication.versionNumber}
                      </div>
                      <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 999, background: tone.bg, color: tone.fg, fontSize: ".7rem", fontWeight: 700 }}>
                        {tone.label}
                      </span>
                      {effectiveStatus === "accepted" && (
                        <span style={{ fontSize: ".72rem", color: "#25603C", fontWeight: 700 }}>
                          Ready for Invoice
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Btn sm v="outline" onClick={() => { void copyPublicationLink(publication.id); }}>
                        <i className="ti ti-link" style={{ marginRight: 5, fontSize: 12 }} aria-hidden="true" />
                        Copy Customer Link
                      </Btn>
                      {canRevokePublication && (
                        <Btn sm v="danger" onClick={() => setRevokeTarget(publication)}>
                          <i className="ti ti-link-off" style={{ marginRight: 5, fontSize: 12 }} aria-hidden="true" />
                          Revoke Link
                        </Btn>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                    <div style={{ fontSize: ".76rem", color: B.gray }}>Published: <span style={{ color: B.dark, fontWeight: 600 }}>{fmtDateTime(publication.publishedAt)}</span></div>
                    <div style={{ fontSize: ".76rem", color: B.gray }}>Expires: <span style={{ color: B.dark, fontWeight: 600 }}>{fmtDate(publication.expiresAt)}</span></div>
                    <div style={{ fontSize: ".76rem", color: B.gray }}>Viewed: <span style={{ color: B.dark, fontWeight: 600 }}>{fmtDateTime(publication.viewedAt)}</span></div>
                    <div style={{ fontSize: ".76rem", color: B.gray }}>Decision At: <span style={{ color: B.dark, fontWeight: 600 }}>{fmtDateTime(publication.decisionAt)}</span></div>
                    <div style={{ fontSize: ".76rem", color: B.gray }}>Accepted Total: <span style={{ color: B.dark, fontWeight: 600 }}>{fmtMoney(publication.totalAmount)}</span></div>
                    <div style={{ fontSize: ".76rem", color: B.gray }}>Deposit Required: <span style={{ color: B.dark, fontWeight: 600 }}>{fmtMoney(publication.depositAmount)}</span></div>
                  </div>

                  {(publication.decisionName || publication.decisionEmail || publication.declinedReason) && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${B.border}`, display: "grid", gap: 6 }}>
                      {publication.decisionName && <div style={{ fontSize: ".76rem", color: B.gray }}>Decision Name: <span style={{ color: B.dark, fontWeight: 600 }}>{publication.decisionName}</span></div>}
                      {publication.decisionEmail && <div style={{ fontSize: ".76rem", color: B.gray }}>Decision Email: <span style={{ color: B.dark, fontWeight: 600 }}>{publication.decisionEmail}</span></div>}
                      {publication.declinedReason && <div style={{ fontSize: ".76rem", color: B.gray, lineHeight: 1.5 }}>Declined Reason: <span style={{ color: B.dark, fontWeight: 600 }}>{publication.declinedReason}</span></div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showPublishConfirm && (
        <Modal title="Publish Final Estimate" onClose={() => { if (!isPublishing) setShowPublishConfirm(false); }} width={720}>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ borderRadius: 10, padding: "12px 14px", background: "#F7F4EC", color: B.dark, fontSize: ".82rem", lineHeight: 1.6 }}>
              Publishing creates a locked customer-facing snapshot. Later edits to the internal estimate ticket will not change the published version. Copy this secure link now after publishing. It cannot be recovered after refreshing or leaving the page. Publishing a revised version creates a new secure link and revokes the previous active undecided link.
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: ".8rem", color: B.gray }}>Customer: <span style={{ color: B.dark, fontWeight: 700 }}>{draft.customerName}</span></div>
              <div style={{ fontSize: ".8rem", color: B.gray }}>Final Total: <span style={{ color: B.dark, fontWeight: 700 }}>{fmtMoney(draft.totalAmount)}</span></div>
              <div style={{ fontSize: ".8rem", color: B.gray }}>Deposit Required: <span style={{ color: B.dark, fontWeight: 700 }}>{fmtMoney(depositAmount)}</span></div>
              <div style={{ fontSize: ".8rem", color: B.gray }}>Expiration Date: <span style={{ color: B.dark, fontWeight: 700 }}>{fmtDate(draft.expiresAt)}</span></div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Btn sm v="outline" onClick={() => setShowPublishConfirm(false)} disabled={isPublishing}>Cancel</Btn>
              <Btn sm v="green" onClick={() => { void confirmPublish(); }} disabled={isPublishing}>
                {isPublishing ? "Publishing..." : "Confirm Publish"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {revokeTarget && (
        <Modal title="Revoke Final Estimate Link" onClose={() => { if (!isRevoking) setRevokeTarget(null); }} width={620}>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ fontSize: ".84rem", color: B.gray, lineHeight: 1.6 }}>
              Revoking Version {revokeTarget.versionNumber} will disable its customer link. The published snapshot and audit history will remain in the CRM.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Btn sm v="outline" onClick={() => setRevokeTarget(null)} disabled={isRevoking}>Cancel</Btn>
              <Btn sm v="danger" onClick={() => { void confirmRevoke(); }} disabled={isRevoking}>
                {isRevoking ? "Revoking..." : "Revoke Link"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
}
