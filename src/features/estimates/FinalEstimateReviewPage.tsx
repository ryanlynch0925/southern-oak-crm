import { useEffect, useMemo, useState } from "react";
import {
  FinalEstimateServiceError,
  getPublicFinalEstimate,
  submitFinalEstimateDecision,
} from "./finalEstimateService";
import type {
  PublicFinalEstimateData,
  SubmitFinalEstimateDecisionInput,
} from "./finalEstimateTypes";
import {
  calculateFinalEstimateRemainingAmount,
  formatFinalEstimateCalendarDate,
  getEffectiveFinalEstimateStatus,
} from "./finalEstimateTypes";
import { B } from "../../theme";

const BRAND_LOGO_SRC = `${import.meta.env.BASE_URL}branding/main_logo.png`;

type DecisionMode = "accept" | "decline" | "not_sure";
type PageState = "loading" | "ready" | "invalid" | "expired" | "revoked" | "error";

function fmtMoney(value: number) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDateTime(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString();
}

function fmtDate(value: string) {
  if (!value) {
    return "";
  }

  return formatFinalEstimateCalendarDate(value, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }) || value;
}

function getInitialForm(email = ""): SubmitFinalEstimateDecisionInput {
  return {
    decision: "accepted",
    decisionName: "",
    decisionEmail: email,
    agreementConfirmed: false,
    amountAcknowledged: false,
    depositAcknowledged: false,
    declinedReason: "",
  };
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        padding: "12px 0",
        borderBottom: "1px solid rgba(22,19,13,0.08)",
      }}
    >
      <div style={{ color: B.gray, fontSize: ".82rem" }}>{label}</div>
      <div style={{ color: B.dark, fontSize: ".86rem", fontWeight: 700, textAlign: "right" }}>{value}</div>
    </div>
  );
}

export default function FinalEstimateReviewPage({
  accessToken,
}: {
  accessToken: string;
}) {
  const [pageState, setPageState] = useState<PageState>("loading");
  const [estimate, setEstimate] = useState<PublicFinalEstimateData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [decisionMode, setDecisionMode] = useState<DecisionMode>("accept");
  const [form, setForm] = useState<SubmitFinalEstimateDecisionInput>(getInitialForm());
  const [formError, setFormError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitNotice, setSubmitNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadEstimate = async () => {
      setPageState("loading");
      setEstimate(null);
      setLoadError("");
      setSubmitError("");
      setSubmitNotice("");

      try {
        const loadedEstimate = await getPublicFinalEstimate(accessToken);

        if (cancelled) {
          return;
        }

        setEstimate(loadedEstimate);
        setForm(getInitialForm());
        setDecisionMode(
          loadedEstimate.decision === "declined"
            ? "decline"
            : loadedEstimate.decision === "not_sure"
              ? "not_sure"
              : "accept"
        );
        setPageState("ready");
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error instanceof FinalEstimateServiceError) {
          if (error.code === "INVALID") {
            setPageState("invalid");
            setLoadError(error.message);
            return;
          }

          if (error.code === "EXPIRED") {
            setPageState("expired");
            setLoadError(error.message);
            return;
          }

          if (error.code === "REVOKED") {
            setPageState("revoked");
            setLoadError(error.message);
            return;
          }
        }

        setPageState("error");
        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load this final estimate right now."
        );
      }
    };

    void loadEstimate();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const depositAmount = estimate?.depositAmount ?? 0;

  const remainingAmount = useMemo(() => (
    estimate
      ? calculateFinalEstimateRemainingAmount(
          estimate.totalAmount,
          estimate.depositAmount
        )
      : 0
  ), [estimate]);

  const effectiveStatus = estimate
    ? getEffectiveFinalEstimateStatus(estimate.status, estimate.expiresAt)
    : "draft";

  const alreadyDecided = (
    effectiveStatus === "accepted"
    || effectiveStatus === "declined"
    || effectiveStatus === "not_sure"
  );

  const updateForm = <K extends keyof SubmitFinalEstimateDecisionInput>(
    key: K,
    value: SubmitFinalEstimateDecisionInput[K]
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
    setFormError("");
    setSubmitError("");
    setSubmitNotice("");
  };

  const validateForm = () => {
    const trimmedName = form.decisionName.trim();

    if (!trimmedName) {
      return "Enter your full name before submitting.";
    }

    if (
      form.decisionEmail.trim()
      && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.decisionEmail.trim())
    ) {
      return "Enter a valid email address or leave it blank.";
    }

    if (decisionMode === "accept") {
      if (!form.agreementConfirmed) {
        return "Acceptance requires confirming the approval statement.";
      }

      if (!form.amountAcknowledged) {
        return "Acceptance requires acknowledging the total amount.";
      }

      if (!form.depositAcknowledged) {
        return "Acceptance requires acknowledging the deposit terms.";
      }
    }

    return "";
  };

  const handleSubmit = async () => {
    if (!estimate) {
      return;
    }

    const nextError = validateForm();
    if (nextError) {
      setFormError(nextError);
      return;
    }

    setIsSubmitting(true);
    setFormError("");
    setSubmitError("");
    setSubmitNotice("");

    try {
      const result = await submitFinalEstimateDecision(accessToken, {
        ...form,
        decision: decisionMode === "accept"
          ? "accepted"
          : decisionMode === "decline"
            ? "declined"
            : "not_sure",
      });

      setEstimate((current) => current ? {
        ...current,
        status: result.status,
        decision: result.decision,
        decisionAt: result.decisionAt,
      } : current);
      setDecisionMode(
        result.decision === "declined"
          ? "decline"
          : result.decision === "not_sure"
            ? "not_sure"
            : "accept"
      );
      if (result.alreadyRecorded) {
        setSubmitNotice("This decision was already recorded. The current estimate status is shown below.");
      }
    } catch (error) {
      if (error instanceof FinalEstimateServiceError && error.code === "EXPIRED") {
        setPageState("expired");
        setLoadError(error.message);
      } else if (error instanceof FinalEstimateServiceError && error.code === "REVOKED") {
        setPageState("revoked");
        setLoadError(error.message);
      } else if (error instanceof FinalEstimateServiceError && error.code === "INVALID") {
        setPageState("invalid");
        setLoadError(error.message);
      } else
      if (error instanceof FinalEstimateServiceError && error.code === "ALREADY_DECIDED") {
        try {
          const refreshedEstimate = await getPublicFinalEstimate(accessToken);
          setEstimate(refreshedEstimate);
        } catch {
          setSubmitError(error.message);
        }
      } else {
        setSubmitError(
          error instanceof Error
            ? error.message
            : "We could not submit your decision. Please try again."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStateCard = (title: string, body: string) => (
    <div
      style={{
        maxWidth: 760,
        margin: "0 auto",
        background: B.white,
        borderRadius: 16,
        border: `1px solid ${B.border}`,
        padding: "28px 24px",
        boxShadow: "0 20px 60px rgba(22,19,13,0.08)",
        textAlign: "center",
      }}
    >
      <img
        src={BRAND_LOGO_SRC}
        alt="Southern Oak Concrete & Construction"
        style={{ width: 220, maxWidth: "100%", height: "auto", marginBottom: 20 }}
      />
      <h1 style={{ fontSize: "1.45rem", color: B.dark, marginBottom: 10 }}>{title}</h1>
      <p style={{ fontSize: ".95rem", color: B.gray, lineHeight: 1.6, margin: 0 }}>{body}</p>
    </div>
  );

  if (pageState === "loading") {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #F7F4EC 0%, #FBFBF8 100%)", padding: "48px 16px" }}>
        {renderStateCard(
          "Loading Final Estimate",
          "We are securely loading your Southern Oak final estimate."
        )}
      </div>
    );
  }

  if (pageState === "invalid") {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #F7F4EC 0%, #FBFBF8 100%)", padding: "48px 16px" }}>
        {renderStateCard(
          "Invalid Estimate Link",
          loadError || "This final estimate link is invalid."
        )}
      </div>
    );
  }

  if (pageState === "expired") {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #F7F4EC 0%, #FBFBF8 100%)", padding: "48px 16px" }}>
        {renderStateCard(
          "Estimate Link Expired",
          loadError || "This final estimate link has expired. Please contact Southern Oak for an updated version."
        )}
      </div>
    );
  }

  if (pageState === "revoked") {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #F7F4EC 0%, #FBFBF8 100%)", padding: "48px 16px" }}>
        {renderStateCard(
          "Estimate Link Revoked",
          loadError || "This final estimate link has been revoked. Please contact Southern Oak for the latest estimate version."
        )}
      </div>
    );
  }

  if (pageState === "error" || !estimate) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #F7F4EC 0%, #FBFBF8 100%)", padding: "48px 16px" }}>
        {renderStateCard(
          "Unable To Load Estimate",
          loadError || "We could not load this final estimate right now. Please try again later."
        )}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #F5F1E6 0%, #FCFCF8 100%)", padding: "40px 16px 72px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gap: 22 }}>
        <div
          style={{
            background: B.green,
            color: B.white,
            borderRadius: 20,
            padding: "24px clamp(18px, 3vw, 34px)",
            display: "grid",
            gap: 18,
            boxShadow: "0 24px 70px rgba(23,35,21,0.22)",
          }}
        >
          <img
            src={BRAND_LOGO_SRC}
            alt="Southern Oak Concrete & Construction"
            style={{ width: 260, maxWidth: "100%", height: "auto" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: ".78rem", textTransform: "uppercase", letterSpacing: ".12em", color: "rgba(255,255,255,0.68)", marginBottom: 8 }}>
                Final Estimate
              </div>
              <h1 style={{ fontSize: "1.85rem", margin: 0, lineHeight: 1.15 }}>
                Review Your Southern Oak Final Estimate
              </h1>
            </div>
            <div style={{ textAlign: "right", minWidth: 180 }}>
              <div style={{ fontSize: ".76rem", color: "rgba(255,255,255,0.68)" }}>Publication Version</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 700 }}>Version {estimate.versionNumber}</div>
              <div style={{ fontSize: ".76rem", color: "rgba(255,255,255,0.68)", marginTop: 10 }}>Published</div>
              <div style={{ fontSize: ".88rem" }}>{fmtDate(estimate.publishedAt)}</div>
            </div>
          </div>
        </div>

        {alreadyDecided && (
          <div
            style={{
              background: effectiveStatus === "accepted" ? "#E6F3EA" : "#FCF3CF",
              color: effectiveStatus === "accepted" ? "#25603C" : "#8A6A12",
              border: `1px solid ${effectiveStatus === "accepted" ? "#BED9C5" : "#E7D6A6"}`,
              borderRadius: 16,
              padding: "16px 18px",
              fontSize: ".92rem",
              lineHeight: 1.6,
            }}
          >
            <strong style={{ display: "block", marginBottom: 4 }}>
              {effectiveStatus === "accepted"
                ? "This final estimate has already been accepted."
                : effectiveStatus === "declined"
                  ? "This final estimate has already been declined."
                  : "This final estimate has already been marked not sure."}
            </strong>
            {estimate.decisionAt
              ? `Decision recorded on ${fmtDateTime(estimate.decisionAt)}.`
              : "A final decision has already been recorded for this version."}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, .8fr)", gap: 22 }}>
          <div
            style={{
              background: B.white,
              borderRadius: 18,
              border: `1px solid ${B.border}`,
              padding: "24px clamp(18px, 2.4vw, 28px)",
              boxShadow: "0 18px 44px rgba(22,19,13,0.08)",
            }}
          >
            <div style={{ display: "grid", gap: 12 }}>
              <SummaryRow label="Customer Name" value={estimate.customerName || "Not provided"} />
              {estimate.projectAddress && <SummaryRow label="Project Address" value={estimate.projectAddress} />}
              {estimate.projectType && <SummaryRow label="Project Type" value={estimate.projectType} />}
              <SummaryRow label="Final Total" value={fmtMoney(estimate.totalAmount)} />
              <SummaryRow
                label="Deposit Required"
                value={depositAmount > 0 ? fmtMoney(depositAmount) : "No deposit requested"}
              />
              <SummaryRow label="Remaining Contract Amount" value={fmtMoney(remainingAmount)} />
              {estimate.expiresAt && <SummaryRow label="Expiration Date" value={fmtDate(estimate.expiresAt)} />}
            </div>

            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: ".76rem", color: B.gray, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>
                Scope Description
              </div>
              <div style={{ fontSize: ".93rem", color: B.dark, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                {estimate.scopeDescription}
              </div>
            </div>

            {estimate.paymentTerms && (
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: ".76rem", color: B.gray, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>
                  Payment Terms
                </div>
                <div style={{ fontSize: ".9rem", color: B.dark, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                  {estimate.paymentTerms}
                </div>
              </div>
            )}

            {estimate.schedulingTerms && (
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: ".76rem", color: B.gray, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>
                  Scheduling Terms
                </div>
                <div style={{ fontSize: ".9rem", color: B.dark, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                  {estimate.schedulingTerms}
                </div>
              </div>
            )}

            {estimate.exclusions && (
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: ".76rem", color: B.gray, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>
                  Exclusions
                </div>
                <div style={{ fontSize: ".9rem", color: B.dark, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                  {estimate.exclusions}
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              background: B.white,
              borderRadius: 18,
              border: `1px solid ${B.border}`,
              padding: "24px clamp(18px, 2.2vw, 26px)",
              boxShadow: "0 18px 44px rgba(22,19,13,0.08)",
              alignSelf: "start",
            }}
          >
            <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
              <button
                onClick={() => setDecisionMode("accept")}
                disabled={alreadyDecided}
                style={{
                  flex: 1,
                  minHeight: 42,
                  borderRadius: 999,
                  border: "none",
                  fontFamily: "inherit",
                  fontWeight: 700,
                  cursor: alreadyDecided ? "default" : "pointer",
                  background: decisionMode === "accept" ? B.green : "#EEF1EC",
                  color: decisionMode === "accept" ? B.white : B.dark,
                  opacity: alreadyDecided ? 0.75 : 1,
                }}
              >
                Accept Estimate
              </button>
              <button
                onClick={() => setDecisionMode("decline")}
                disabled={alreadyDecided}
                style={{
                  flex: 1,
                  minHeight: 42,
                  borderRadius: 999,
                  border: "none",
                  fontFamily: "inherit",
                  fontWeight: 700,
                  cursor: alreadyDecided ? "default" : "pointer",
                  background: decisionMode === "decline" ? "#8A6A12" : "#F5F1E6",
                  color: decisionMode === "decline" ? B.white : B.dark,
                  opacity: alreadyDecided ? 0.75 : 1,
                }}
              >
                Decline Estimate
              </button>
              <button
                onClick={() => setDecisionMode("not_sure")}
                disabled={alreadyDecided}
                style={{
                  flex: 1,
                  minHeight: 42,
                  borderRadius: 999,
                  border: "none",
                  fontFamily: "inherit",
                  fontWeight: 700,
                  cursor: alreadyDecided ? "default" : "pointer",
                  background: decisionMode === "not_sure" ? "#B07A17" : "#F8F1D9",
                  color: decisionMode === "not_sure" ? B.white : B.dark,
                  opacity: alreadyDecided ? 0.75 : 1,
                }}
              >
                Not Sure Yet
              </button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: ".76rem", fontWeight: 700, color: B.dark, marginBottom: 6 }}>
                Typed Full Name
              </div>
              <input
                disabled={alreadyDecided || isSubmitting}
                value={form.decisionName}
                onChange={(event) => updateForm("decisionName", event.target.value)}
                placeholder="Enter your full name"
                style={{
                  width: "100%",
                  padding: "11px 12px",
                  borderRadius: 10,
                  border: `1px solid ${B.border}`,
                  fontSize: ".9rem",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: ".76rem", fontWeight: 700, color: B.dark, marginBottom: 6 }}>
                Email Address
              </div>
              <input
                disabled={alreadyDecided || isSubmitting}
                value={form.decisionEmail}
                onChange={(event) => updateForm("decisionEmail", event.target.value)}
                placeholder="Optional email address"
                style={{
                  width: "100%",
                  padding: "11px 12px",
                  borderRadius: 10,
                  border: `1px solid ${B.border}`,
                  fontSize: ".9rem",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {decisionMode === "accept" ? (
              <div style={{ display: "grid", gap: 10 }}>
                <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: ".88rem", color: B.dark, lineHeight: 1.5 }}>
                  <input
                    type="checkbox"
                    checked={form.agreementConfirmed}
                    disabled={alreadyDecided || isSubmitting}
                    onChange={(event) => updateForm("agreementConfirmed", event.target.checked)}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    I approve the displayed scope of work, final total, deposit requirement, and listed terms for this Southern Oak final estimate.
                  </span>
                </label>
                <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: ".88rem", color: B.dark, lineHeight: 1.5 }}>
                  <input
                    type="checkbox"
                    checked={form.amountAcknowledged}
                    disabled={alreadyDecided || isSubmitting}
                    onChange={(event) => updateForm("amountAcknowledged", event.target.checked)}
                    style={{ marginTop: 3 }}
                  />
                  <span>I acknowledge the final total amount of {fmtMoney(estimate.totalAmount)}.</span>
                </label>
                <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: ".88rem", color: B.dark, lineHeight: 1.5 }}>
                  <input
                    type="checkbox"
                    checked={form.depositAcknowledged}
                    disabled={alreadyDecided || isSubmitting}
                    onChange={(event) => updateForm("depositAcknowledged", event.target.checked)}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    I acknowledge the requested deposit of {depositAmount > 0 ? fmtMoney(depositAmount) : "no deposit"}.
                  </span>
                </label>
              </div>
            ) : decisionMode === "decline" ? (
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: ".76rem", fontWeight: 700, color: B.dark, marginBottom: 6 }}>
                  Decline Reason
                </div>
                <textarea
                  disabled={alreadyDecided || isSubmitting}
                  value={form.declinedReason}
                  onChange={(event) => updateForm("declinedReason", event.target.value)}
                  placeholder="Optional reason for declining this estimate"
                  rows={5}
                  style={{
                    width: "100%",
                    padding: "11px 12px",
                    borderRadius: 10,
                    border: `1px solid ${B.border}`,
                    fontSize: ".9rem",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                    resize: "vertical",
                  }}
                />
              </div>
            ) : (
              <div
                style={{
                  marginBottom: 4,
                  borderRadius: 12,
                  padding: "12px 14px",
                  background: "#F8F1D9",
                  border: "1px solid #E7D6A6",
                  color: "#8A6A12",
                  fontSize: ".84rem",
                  lineHeight: 1.6,
                }}
              >
                Select this option if you need more time or additional follow-up before making a final decision.
              </div>
            )}

            {(formError || submitError || submitNotice) && (
              <div
                style={{
                  marginTop: 16,
                  borderRadius: 12,
                  padding: "12px 14px",
                  background: formError || submitError ? "#FFF5F3" : "#F3F4F2",
                  border: formError || submitError ? "1px solid #E8C1BA" : "1px solid #D8DDD6",
                  color: formError || submitError ? "#922B21" : B.dark,
                  fontSize: ".84rem",
                  lineHeight: 1.5,
                }}
              >
                {formError || submitError || submitNotice}
              </div>
            )}

            {!alreadyDecided && (
              <button
                onClick={() => void handleSubmit()}
                disabled={isSubmitting}
                style={{
                  width: "100%",
                  marginTop: 18,
                  minHeight: 48,
                  border: "none",
                  borderRadius: 12,
                  fontFamily: "inherit",
                  fontSize: ".94rem",
                  fontWeight: 700,
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  background: decisionMode === "accept" ? B.green : "#8A6A12",
                  color: B.white,
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting
                  ? "Submitting..."
                  : decisionMode === "accept"
                    ? "Accept Final Estimate"
                    : decisionMode === "decline"
                      ? "Decline Final Estimate"
                      : "Mark As Not Sure"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
