import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  financeJobs,
  lowMarginJobs,
  revenueCustomerTypeDetails,
  revenueItems,
  revenueServiceTypeDetails,
  revenueStatusDetails,
  revenueSummary,
} from "./data/financeData";
import {
  createPayment,
  fetchFinanceOverviewSummary,
  fetchFinancePaymentsSnapshot,
  type FinanceOverviewSummary,
  type FinancePaymentRecord,
  type FinanceReceivableRecord,
} from "./features/admin/services/financeService";

const CARD = {
  background: "var(--admin-card-bg)",
  border: "1px solid var(--admin-border)",
  borderRadius: 16,
  padding: 18,
  boxShadow: "0 10px 28px rgba(15,26,18,.10)",
};

const labelStyle = { display: "block", fontSize: ".74rem", fontWeight: 700, color: "var(--admin-muted)", marginBottom: 6 };
const PAYMENT_METHODS = ["Cash", "Check", "ACH", "Card", "Other"];
const FINANCE_REVENUE_ITEMS_STORAGE_KEY = "southernOakFinanceRevenueItems";
const LEGACY_FINANCE_PAYMENTS_STORAGE_KEY = "southernOakFinancePayments";
const LEGACY_FINANCE_RECEIVABLES_STORAGE_KEY = "southernOakFinanceReceivables";
const OVERVIEW_FILTER_HELPER_TEXT = "Overview currently shows all-time totals";

const fmtMoney = (value: number) => `$${value.toLocaleString()}`;
const fmtDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
const todayIso = () => new Date().toISOString().slice(0, 10);

function getLocalDateAtNoon(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
}

function getTodayLocalDateAtNoon() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
}

function isClosedReceivableStatus(status: string | null | undefined) {
  const normalizedStatus = String(status || "").trim().toLowerCase();
  return normalizedStatus === "paid"
    || normalizedStatus === "cancelled"
    || normalizedStatus === "canceled"
    || normalizedStatus === "voided"
    || normalizedStatus === "void";
}

function isPastDue(dueDate: string | null | undefined, balanceDue: number, status?: string | null) {
  if (!dueDate || balanceDue <= 0 || isClosedReceivableStatus(status)) return false;
  const due = getLocalDateAtNoon(dueDate).getTime();
  const today = getTodayLocalDateAtNoon().getTime();
  return due < today;
}

function computeDaysOverdue(dueDate: string | null | undefined, balanceDue: number, status?: string | null) {
  if (!isPastDue(dueDate, balanceDue, status) || !dueDate) return null;
  return Math.max(0, Math.round((getTodayLocalDateAtNoon().getTime() - getLocalDateAtNoon(dueDate).getTime()) / 86400000));
}

function parseStoredArray<T>(key: string, fallback: T[]) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function getInitialPaymentDraft(selectedKey = "") {
  return {
    receivableKey: selectedKey,
    invoiceProject: "",
    amount: "",
    date: todayIso(),
    method: "Check",
    reference: "",
    notes: "",
  };
}

function getOverdueWarningText(overdueCount: number) {
  if (overdueCount === 0) return "No receivables past due";
  if (overdueCount === 1) return "1 receivable past due";
  return `${overdueCount} receivables past due`;
}

function hasOverviewSummaryData(summary: FinanceOverviewSummary | null) {
  if (!summary) return false;
  return summary.totalRevenue > 0
    || summary.unpaidBalance > 0
    || summary.totalExpenses > 0
    || summary.netProfit !== 0;
}

function SectionCard({
  title,
  subtitle,
  action,
  footer,
  children,
  className = "",
  onCardClick,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  onCardClick?: () => void;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onCardClick) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onCardClick();
    }
  };

  return (
    <div
      style={CARD}
      className={className}
      onClick={onCardClick}
      onKeyDown={handleKeyDown}
      role={onCardClick ? "button" : undefined}
      tabIndex={onCardClick ? 0 : undefined}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--admin-text)" }}>{title}</div>
          {subtitle && <div style={{ fontSize: ".8rem", color: "var(--admin-muted)", marginTop: 2 }}>{subtitle}</div>}
        </div>
        {action}
      </div>
      <div className="finance-section-card-body">{children}</div>
      {footer && <div className="finance-section-card-footer">{footer}</div>}
    </div>
  );
}

function FinanceTable({ columns, rows, renderRow }: { columns: string[]; rows: any[]; renderRow: (row: any) => React.ReactNode }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--admin-muted)", fontSize: ".72rem", textTransform: "uppercase", letterSpacing: ".04em" }}>
            {columns.map(column => <th key={column} style={{ padding: "10px 12px", borderBottom: "1px solid var(--admin-border)" }}>{column}</th>)}
          </tr>
        </thead>
        <tbody>{rows.map(renderRow)}</tbody>
      </table>
    </div>
  );
}

function FinanceEmptyState({ message }: { message: string }) {
  return (
    <div style={{ padding: "18px 12px", color: "var(--admin-muted)", textAlign: "center" }}>
      {message}
    </div>
  );
}

function statusBadge(status: string) {
  const map: Record<string, { color: string; background: string }> = {
    Paid: { color: "#25603C", background: "#DFF0E5" },
    Partial: { color: "#8A6A12", background: "#F8F1D9" },
    Sent: { color: "#275A85", background: "#E2ECF4" },
    Draft: { color: "#5C6572", background: "#EEF1F4" },
    Overdue: { color: "#A14B40", background: "#F9E8E4" },
    Cancelled: { color: "#7B7D7D", background: "#F2F3F4" },
  };
  return map[status] || { color: "var(--admin-text)", background: "var(--admin-card-soft)" };
}

function PaymentSummaryCards({
  receivablesData,
  paymentsData,
}: {
  receivablesData: FinanceReceivableRecord[];
  paymentsData: FinancePaymentRecord[];
}) {
  const outstandingBalance = receivablesData.reduce((sum, row) => sum + Number(row.balanceDue || 0), 0);
  const openInvoices = receivablesData.filter(row => Number(row.balanceDue || 0) > 0).length;
  const pastDueCount = receivablesData.filter(row => isPastDue(row.dueDate, Number(row.balanceDue || 0), row.status)).length;
  const currentMonth = todayIso().slice(0, 7);
  const collectedThisMonth = paymentsData
    .filter(row => String(row.date || "").slice(0, 7) === currentMonth)
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
      {[
        { label: "Outstanding Balance", value: fmtMoney(outstandingBalance), subtitle: `${openInvoices} open invoices` },
        { label: "Collected This Month", value: fmtMoney(collectedThisMonth), subtitle: `${paymentsData.filter(row => String(row.date || "").slice(0, 7) === currentMonth).length} payments recorded` },
        { label: "Past Due", value: String(pastDueCount), subtitle: "Invoices needing follow-up" },
        { label: "Open Invoices", value: String(openInvoices), subtitle: "Current balances due" },
      ].map(card => (
        <div key={card.label} className="finance-kpi-card">
          <div className="finance-kpi-label">{card.label}</div>
          <div className="finance-kpi-value" style={{ marginTop: 10 }}>{card.value}</div>
          <div className="finance-kpi-subtitle">{card.subtitle}</div>
        </div>
      ))}
    </div>
  );
}

function AddPaymentModal({
  receivableOptions,
  draft,
  errors,
  onChange,
  onClose,
  onSave,
}: {
  receivableOptions: any[];
  draft: any;
  errors: string[];
  onChange: (field: string, value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const selected = receivableOptions.find(option => option.key === draft.receivableKey);
  const enteredAmount = Number(draft.amount || 0);
  const saveDisabled = !selected || !draft.amount || enteredAmount <= 0 || !draft.date;
  const validationMessages = errors.length > 0
    ? errors
    : [
        !draft.receivableKey ? "Select a customer/job." : "",
        !draft.amount ? "Enter a payment amount." : "",
        draft.amount && enteredAmount <= 0 ? "Payment amount must be greater than 0." : "",
        !draft.date ? "Enter a payment date." : "",
      ].filter(Boolean);

  return (
    <div className="finance-modal-overlay" onClick={onClose}>
      <div className="finance-modal-shell" onClick={event => event.stopPropagation()}>
        <div className="finance-modal-header">
          <div>
            <div className="finance-modal-title">Add Payment</div>
            <div className="finance-modal-subtitle">Record a customer payment against an existing job or invoice.</div>
          </div>
          <button className="finance-modal-close" onClick={onClose} aria-label="Close add payment modal">x</button>
        </div>
        <div className="finance-modal-body">
          <div className="finance-payment-form-grid">
            <div className="finance-payment-field finance-payment-field--full">
              <label style={labelStyle}>Customer / Job</label>
              <select value={draft.receivableKey} onChange={e => onChange("receivableKey", e.target.value)} className="finance-select">
                <option value="">Select a customer/job</option>
                {receivableOptions.map(option => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="finance-payment-field">
              <label style={labelStyle}>Invoice / Project</label>
              <input value={draft.invoiceProject} readOnly className="finance-payment-input" />
            </div>
            <div className="finance-payment-field">
              <label style={labelStyle}>Payment Amount</label>
              <input type="number" min="0" step="0.01" value={draft.amount} onChange={e => onChange("amount", e.target.value)} className="finance-payment-input" />
            </div>
            <div className="finance-payment-field">
              <label style={labelStyle}>Payment Date</label>
              <input type="date" value={draft.date} onChange={e => onChange("date", e.target.value)} className="finance-payment-input" />
            </div>
            <div className="finance-payment-field">
              <label style={labelStyle}>Payment Method</label>
              <select value={draft.method} onChange={e => onChange("method", e.target.value)} className="finance-select">
                {PAYMENT_METHODS.map(method => <option key={method}>{method}</option>)}
              </select>
            </div>
            <div className="finance-payment-field">
              <label style={labelStyle}>Reference / Check Number</label>
              <input value={draft.reference} onChange={e => onChange("reference", e.target.value)} className="finance-payment-input" />
            </div>
            <div className="finance-payment-field finance-payment-field--full">
              <label style={labelStyle}>Notes</label>
              <textarea value={draft.notes} onChange={e => onChange("notes", e.target.value)} className="finance-payment-textarea" rows={4} />
            </div>
          </div>
          {validationMessages.length > 0 && (
            <div className="finance-modal-error">
              {validationMessages.map(error => <div key={error}>{error}</div>)}
            </div>
          )}
          <div className="finance-modal-actions">
            <button className="oak-button oak-button--outline" style={{ minHeight: 42, padding: "8px 14px", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }} onClick={onClose}>
              Cancel
            </button>
            <button className="oak-button oak-button--primary" style={{ minHeight: 42, padding: "8px 14px", borderRadius: 10, fontWeight: 700, cursor: saveDisabled ? "not-allowed" : "pointer", fontFamily: "inherit", border: "none", opacity: saveDisabled ? 0.6 : 1 }} onClick={onSave} disabled={saveDisabled}>
              Save Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FinanceHeaderCard({
  financeView,
  overdueWarningText,
  onFinanceViewChange,
}: {
  financeView: string;
  overdueWarningText: string;
  onFinanceViewChange: (value: string) => void;
}) {
  const [dateRange, setDateRange] = useState("May 1 - May 31, 2026");
  const [jobType, setJobType] = useState("All Job Types");
  const [customerType, setCustomerType] = useState("All Customers");
  const [status, setStatus] = useState("All Statuses");
  const overviewFiltersDisabled = financeView === "overview";

  return (
    <div style={CARD}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: "1.12rem", fontWeight: 800, color: "var(--admin-text)" }}>Finance Dashboard</div>
          <div style={{ fontSize: ".82rem", color: "var(--admin-muted)", marginTop: 4 }}>Track revenue, profitability, and payments across your business.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div className="finance-warning-note">{overdueWarningText}</div>
          <button className="oak-button oak-button--primary" style={{ minHeight: 44, padding: "10px 14px", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            <i className="ti ti-download" style={{ marginRight: 6 }} aria-hidden="true" />
            Export
          </button>
        </div>
      </div>

      <div className="finance-filter-grid">
        <div>
          <label style={labelStyle}>Date Range</label>
          <select
            value={dateRange}
            onChange={e => setDateRange(e.target.value)}
            className="finance-select"
            disabled={overviewFiltersDisabled}
            title={overviewFiltersDisabled ? OVERVIEW_FILTER_HELPER_TEXT : undefined}
          >
            <option>May 1 - May 31, 2026</option>
            <option>Apr 1 - Apr 30, 2026</option>
            <option>Year to Date</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Job Type</label>
          <select
            value={jobType}
            onChange={e => setJobType(e.target.value)}
            className="finance-select"
            disabled={overviewFiltersDisabled}
            title={overviewFiltersDisabled ? OVERVIEW_FILTER_HELPER_TEXT : undefined}
          >
            <option>All Job Types</option>
            <option>Driveways</option>
            <option>Patios</option>
            <option>Slabs</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Customer Type</label>
          <select
            value={customerType}
            onChange={e => setCustomerType(e.target.value)}
            className="finance-select"
            disabled={overviewFiltersDisabled}
            title={overviewFiltersDisabled ? OVERVIEW_FILTER_HELPER_TEXT : undefined}
          >
            <option>All Customers</option>
            <option>Residential</option>
            <option>Builder</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="finance-select"
            disabled={overviewFiltersDisabled}
            title={overviewFiltersDisabled ? OVERVIEW_FILTER_HELPER_TEXT : undefined}
          >
            <option>All Statuses</option>
            <option>Past Due</option>
            <option>Due Soon</option>
            <option>Completed</option>
          </select>
        </div>
      </div>
      {overviewFiltersDisabled && <div style={{ marginTop: 10, fontSize: ".78rem", color: "var(--admin-muted)" }}>{OVERVIEW_FILTER_HELPER_TEXT}</div>}

      <div className="finance-tab-row">
        {[
          { id: "overview", label: "Overview" },
          { id: "revenue", label: "Revenue" },
          { id: "payments", label: "Payments" },
          { id: "reports", label: "Reports" },
        ].map(item => (
          <button
            key={item.id}
            className="finance-tab-button"
            onClick={() => onFinanceViewChange(item.id)}
            style={{
              border: `1px solid ${financeView === item.id ? "rgba(199,164,93,.38)" : "var(--admin-border)"}`,
              background: financeView === item.id ? "rgba(199,164,93,.14)" : "var(--admin-card-bg)",
              color: financeView === item.id ? "var(--oak-gold)" : "var(--admin-text)",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function OverviewKpiGrid({ summary }: { summary: FinanceOverviewSummary }) {
  const overviewKpis = [
    { id: "collected-revenue", label: "Collected Revenue", subtitle: "Payments received", value: summary.totalRevenue, icon: "ti-credit-card-pay" },
    { id: "outstanding-receivables", label: "Outstanding Receivables", subtitle: "Open invoice balances", value: summary.unpaidBalance, icon: "ti-alert-circle" },
    { id: "total-expenses", label: "Total Expenses", subtitle: "Recorded business expenses", value: summary.totalExpenses, icon: "ti-receipt-2" },
    { id: "net-profit", label: "Net Profit", subtitle: "Collected revenue minus expenses", value: summary.netProfit, icon: "ti-chart-bar" },
  ];

  return (
    <div className="finance-kpi-grid">
      {overviewKpis.map(item => (
        <div key={item.id} className="finance-kpi-card">
          <div className="finance-kpi-header">
            <div className="finance-kpi-icon">
              <i className={`ti ${item.icon}`} style={{ fontSize: 18 }} aria-hidden="true" />
            </div>
            <div className="finance-kpi-label">{item.label}</div>
          </div>
          <div className="finance-kpi-value">{fmtMoney(item.value)}</div>
          <div className="finance-kpi-subtitle">{item.subtitle}</div>
        </div>
      ))}
    </div>
  );
}

function OverviewPlaceholderCard({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <SectionCard
      title={title}
      subtitle={subtitle}
      className="finance-snapshot-card"
      footer={<div className="finance-card-link">Live breakdown coming next</div>}
    >
      <FinanceEmptyState message="This section is still placeholder-only until the next finance phase." />
    </SectionCard>
  );
}

function NeedsAttentionSection() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ fontSize: "1.02rem", fontWeight: 800, color: "var(--admin-text)" }}>Needs Attention</div>
        <div style={{ fontSize: ".8rem", color: "var(--admin-muted)", marginTop: 2 }}>Live breakdown coming next</div>
      </div>
      <SectionCard title="Needs Attention" subtitle="This panel will switch to live finance alerts in a later phase.">
        <FinanceEmptyState message="Live breakdown coming next." />
      </SectionCard>
    </div>
  );
}

function RevenueView({
  onFinanceViewChange: _onFinanceViewChange,
  revenueItemsData,
}: {
  onFinanceViewChange: (value: string) => void;
  revenueItemsData: any[];
}) {
  const leadingCustomerType = [...revenueCustomerTypeDetails].sort((a, b) => b.revenue - a.revenue)[0];
  const revenueStageBadge = (status: string) => {
    const tones: Record<string, { color: string; background: string }> = {
      Completed: { color: "#25603C", background: "#E6F3EA" },
      Paid: { color: "#25603C", background: "#DFF0E5" },
      Scheduled: { color: "#8A6A12", background: "#F8F1D9" },
      "In Progress": { color: "#5B4A88", background: "#EEE9F8" },
      "Estimate Accepted": { color: "#25603C", background: "#E6F3EA" },
      Lost: { color: "#A14B40", background: "#F9E8E4" },
    };
    return tones[status] || { color: "var(--admin-text)", background: "var(--admin-card-soft)" };
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
        {revenueSummary.map(item => (
          <div key={item.id} className="finance-kpi-card">
            <div className="finance-kpi-label">{item.label}</div>
            <div className="finance-kpi-value" style={{ marginTop: 10 }}>{fmtMoney(item.value)}</div>
            <div className="finance-kpi-subtitle">{item.subtitle}</div>
          </div>
        ))}
      </div>

      <SectionCard title="Revenue Items" subtitle="Detailed job revenue records for this period.">
        <FinanceTable
          columns={["Customer / Builder", "Job / Project", "Service Type", "Customer Type", "Status", "Revenue", "Paid", "Balance", "Date / Stage"]}
          rows={revenueItemsData}
          renderRow={row => {
            const badge = revenueStageBadge(row.status);
            return (
              <tr key={`${row.customerBuilder}-${row.project}`} style={{ borderBottom: "1px solid var(--admin-border)" }}>
                <td style={{ padding: "12px", fontWeight: 700 }}>{row.customerBuilder}</td>
                <td style={{ padding: "12px", color: "var(--admin-muted)" }}>{row.project}</td>
                <td style={{ padding: "12px" }}>{row.serviceType}</td>
                <td style={{ padding: "12px", color: "var(--admin-muted)" }}>{row.customerType}</td>
                <td style={{ padding: "12px" }}>
                  <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: 999, background: badge.background, color: badge.color, fontSize: ".74rem", fontWeight: 700 }}>
                    {row.status}
                  </span>
                </td>
                <td style={{ padding: "12px", fontWeight: 700 }}>{fmtMoney(row.revenue)}</td>
                <td style={{ padding: "12px" }}>{fmtMoney(row.paid)}</td>
                <td style={{ padding: "12px", fontWeight: 700 }}>{fmtMoney(row.balance)}</td>
                <td style={{ padding: "12px", color: "var(--admin-muted)" }}>{fmtDate(row.dateStage)}</td>
              </tr>
            );
          }}
        />
      </SectionCard>

      <SectionCard title="Revenue by Job Status" subtitle="Detailed pipeline dollars by stage. Percentages compare each stage to total tracked revenue and are not additive.">
        <FinanceTable
          columns={["Status", "Jobs / Estimates", "Revenue Amount", "Percent of Total", "Notes / Next Action"]}
          rows={revenueStatusDetails}
          renderRow={row => (
            <tr key={row.status} style={{ borderBottom: "1px solid var(--admin-border)" }}>
              <td style={{ padding: "12px", fontWeight: 700 }}>{row.status}</td>
              <td style={{ padding: "12px", color: "var(--admin-muted)" }}>{row.count}</td>
              <td style={{ padding: "12px", fontWeight: 700 }}>{fmtMoney(row.revenue)}</td>
              <td style={{ padding: "12px", color: "var(--admin-muted)" }}>{row.percentOfTotal.toFixed(1)}%</td>
              <td style={{ padding: "12px", color: "var(--admin-muted)" }}>{row.note}</td>
            </tr>
          )}
        />
      </SectionCard>

      <SectionCard title="Revenue by Service Type" subtitle="Revenue concentration by service line.">
        <FinanceTable
          columns={["Service Type", "Number of Jobs", "Revenue", "Percent of Revenue", "Average Job Value"]}
          rows={revenueServiceTypeDetails}
          renderRow={row => (
            <tr key={row.serviceType} style={{ borderBottom: "1px solid var(--admin-border)" }}>
              <td style={{ padding: "12px", fontWeight: 700 }}>{row.serviceType}</td>
              <td style={{ padding: "12px", color: "var(--admin-muted)" }}>{row.count}</td>
              <td style={{ padding: "12px", fontWeight: 700 }}>{fmtMoney(row.revenue)}</td>
              <td style={{ padding: "12px", color: "var(--admin-muted)" }}>{row.percentOfRevenue.toFixed(1)}%</td>
              <td style={{ padding: "12px", color: "var(--admin-muted)" }}>{fmtMoney(row.averageJobValue)}</td>
            </tr>
          )}
        />
      </SectionCard>

      <SectionCard title="Residential vs Builder" subtitle="Detailed comparison by customer type.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
          {revenueCustomerTypeDetails.map(item => (
            <div key={item.customerType} className="finance-mini-card" style={{ padding: 18 }}>
              <div className="finance-mini-label">{item.customerType}</div>
              <div className="finance-mini-value">{fmtMoney(item.revenue)}</div>
              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div className="finance-mini-label">Percent of total</div>
                  <div style={{ marginTop: 4, fontWeight: 700, color: "var(--admin-text)" }}>{item.percentOfTotal}%</div>
                </div>
                <div>
                  <div className="finance-mini-label">Number of jobs</div>
                  <div style={{ marginTop: 4, fontWeight: 700, color: "var(--admin-text)" }}>{item.jobCount}</div>
                </div>
                <div>
                  <div className="finance-mini-label">Average job value</div>
                  <div style={{ marginTop: 4, fontWeight: 700, color: "var(--admin-text)" }}>{fmtMoney(item.averageJobValue)}</div>
                </div>
                <div>
                  <div className="finance-mini-label">Leading note</div>
                  <div style={{ marginTop: 4, color: "var(--admin-muted)", fontSize: ".78rem" }}>{item.note}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="finance-insight-note">
          {leadingCustomerType.customerType} is currently leading total revenue, while builder work continues to carry the stronger average job value.
        </div>
      </SectionCard>
    </div>
  );
}

function PaymentsView({
  receivablesData,
  paymentsData,
  isLoading,
  loadError,
  onRetry,
  onOpenPaymentModal,
}: {
  receivablesData: FinanceReceivableRecord[];
  paymentsData: FinancePaymentRecord[];
  isLoading: boolean;
  loadError: string | null;
  onRetry: () => void;
  onOpenPaymentModal: (receivableKey?: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "1.02rem", fontWeight: 800, color: "var(--admin-text)" }}>Payments</div>
            <div style={{ fontSize: ".8rem", color: "var(--admin-muted)", marginTop: 2 }}>Record payments and review current receivables.</div>
          </div>
          <button className="oak-button oak-button--primary" style={{ minHeight: 42, padding: "8px 14px", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: "none" }} onClick={() => onOpenPaymentModal()}>
            <i className="ti ti-plus" style={{ marginRight: 6 }} aria-hidden="true" />
            Add Payment
          </button>
        </div>
        {!isLoading && !loadError && <PaymentSummaryCards receivablesData={receivablesData} paymentsData={paymentsData} />}
      </div>

      {isLoading ? (
        <SectionCard title="Loading Payments" subtitle="Fetching receivables and recent payments from Supabase.">
          <FinanceEmptyState message="Loading receivables and payments..." />
        </SectionCard>
      ) : loadError ? (
        <SectionCard
          title="Unable to Load Payments"
          subtitle="The finance data could not be loaded."
          action={(
            <button className="oak-button oak-button--outline" style={{ minHeight: 36, padding: "6px 12px", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }} onClick={onRetry}>
              Retry
            </button>
          )}
        >
          <FinanceEmptyState message={loadError} />
        </SectionCard>
      ) : (
        <>
          <SectionCard title="Accounts Receivable" subtitle="Open balances and due dates">
            {receivablesData.length === 0 ? (
              <FinanceEmptyState message="No invoices found." />
            ) : (
              <FinanceTable
                columns={["Customer", "Job / Project", "Final Price", "Paid", "Balance Due", "Due Date", "Status", "Days Overdue", "Action"]}
                rows={receivablesData}
                renderRow={row => {
                  const badge = statusBadge(row.status);
                  const daysOverdue = computeDaysOverdue(row.dueDate, row.balanceDue, row.status);
                  return (
                    <tr key={row.invoiceId} style={{ borderBottom: "1px solid var(--admin-border)" }}>
                      <td style={{ padding: "12px" }}>{row.customer}</td>
                      <td style={{ padding: "12px", color: "var(--admin-muted)" }}>{row.project}</td>
                      <td style={{ padding: "12px" }}>{fmtMoney(row.totalAmount)}</td>
                      <td style={{ padding: "12px" }}>{fmtMoney(row.amountPaid)}</td>
                      <td style={{ padding: "12px", fontWeight: 700 }}>{fmtMoney(row.balanceDue)}</td>
                      <td style={{ padding: "12px" }}>{row.dueDate ? fmtDate(row.dueDate) : "-"}</td>
                      <td style={{ padding: "12px" }}>
                        <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: 999, background: badge.background, color: badge.color, fontSize: ".74rem", fontWeight: 700 }}>{row.status}</span>
                      </td>
                      <td style={{ padding: "12px" }}>{daysOverdue ?? "-"}</td>
                      <td style={{ padding: "12px" }}>
                        {row.balanceDue > 0 ? (
                          <button className="oak-button oak-button--outline" style={{ minHeight: 34, padding: "6px 10px", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }} onClick={() => onOpenPaymentModal(row.invoiceId)}>
                            Record Payment
                          </button>
                        ) : (
                          <span style={{ color: "var(--admin-muted)", fontSize: ".76rem" }}>Closed</span>
                        )}
                      </td>
                    </tr>
                  );
                }}
              />
            )}
          </SectionCard>

          <SectionCard title="Recent Payments" subtitle="Latest payment activity">
            {paymentsData.length === 0 ? (
              <FinanceEmptyState message="No payments recorded yet." />
            ) : (
              <FinanceTable
                columns={["Date", "Customer / Job", "Payment", "Method", "Reference", "Remaining Balance", "Notes"]}
                rows={paymentsData}
                renderRow={row => (
                  <tr key={row.id} style={{ borderBottom: "1px solid var(--admin-border)" }}>
                    <td style={{ padding: "12px" }}>{fmtDate(row.date)}</td>
                    <td style={{ padding: "12px", fontWeight: 600 }}>{row.customerJob}</td>
                    <td style={{ padding: "12px" }}>{fmtMoney(row.amount)}</td>
                    <td style={{ padding: "12px", color: "var(--admin-muted)" }}>{row.method}</td>
                    <td style={{ padding: "12px", color: "var(--admin-muted)" }}>{row.reference || "-"}</td>
                    <td style={{ padding: "12px" }}>{fmtMoney(row.remainingBalance)}</td>
                    <td style={{ padding: "12px", color: "var(--admin-muted)" }}>{row.notes || "-"}</td>
                  </tr>
                )}
              />
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}

function ReportsView() {
  const averageMargin = lowMarginJobs.reduce((sum, job) => sum + job.grossMargin, 0) / Math.max(lowMarginJobs.length, 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionCard title="Low Margin Jobs" subtitle="Below 25% margin target">
        <FinanceTable
          columns={["Customer", "Job / Project", "Final Price", "Total Cost", "Gross Profit", "Gross Margin", "Status"]}
          rows={lowMarginJobs}
          renderRow={row => (
            <tr key={`${row.customer}-${row.project}`} style={{ borderBottom: "1px solid var(--admin-border)" }}>
              <td style={{ padding: "12px" }}>{row.customer}</td>
              <td style={{ padding: "12px", color: "var(--admin-muted)" }}>{row.project}</td>
              <td style={{ padding: "12px" }}>{fmtMoney(row.finalPrice)}</td>
              <td style={{ padding: "12px" }}>{fmtMoney(row.totalCost)}</td>
              <td style={{ padding: "12px" }}>{fmtMoney(row.grossProfit)}</td>
              <td style={{ padding: "12px", fontWeight: 700, color: row.grossMargin < 0.25 ? "#A14B40" : "var(--admin-text)" }}>{pct(row.grossMargin)}</td>
              <td style={{ padding: "12px" }}>{row.status}</td>
            </tr>
          )}
        />
      </SectionCard>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
        <SectionCard title="Open Invoices by Customer Type">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[["Residential", financeJobs.filter(job => job.customerType === "Residential").length], ["Builder", financeJobs.filter(job => job.customerType === "Builder").length]].map(([label, count]) => (
              <div key={String(label)} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 14px", borderRadius: 12, background: "var(--admin-card-soft)", border: "1px solid var(--admin-border)" }}>
                <span style={{ color: "var(--admin-text)", fontWeight: 600 }}>{label}</span>
                <span style={{ color: "var(--admin-muted)" }}>{count} invoices</span>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="High-Level Profitability">
          <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(23,35,21,.06)", border: "1px solid rgba(23,35,21,.12)" }}>
            <div style={{ fontSize: ".74rem", color: "var(--admin-muted)", fontWeight: 700 }}>Average gross margin</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--admin-text)", marginTop: 8 }}>{pct(averageMargin)}</div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function FinanceDashboard({
  financeView,
  onFinanceViewChange,
}: {
  financeView: string;
  onFinanceViewChange: (value: string) => void;
}) {
  const [receivablesState, setReceivablesState] = useState<FinanceReceivableRecord[]>([]);
  const [paymentsState, setPaymentsState] = useState<FinancePaymentRecord[]>([]);
  const [revenueItemsState, setRevenueItemsState] = useState(() => parseStoredArray(FINANCE_REVENUE_ITEMS_STORAGE_KEY, revenueItems));
  const [overviewSummary, setOverviewSummary] = useState<FinanceOverviewSummary | null>(null);
  const [paymentDraft, setPaymentDraft] = useState<any | null>(null);
  const [paymentErrors, setPaymentErrors] = useState<string[]>([]);
  const [financeLoading, setFinanceLoading] = useState(true);
  const [financeError, setFinanceError] = useState<string | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const overdueCount = useMemo(
    () => receivablesState.filter(item => isPastDue(item.dueDate, Number(item.balanceDue || 0), item.status)).length,
    [receivablesState]
  );
  const overdueWarningText = useMemo(() => getOverdueWarningText(overdueCount), [overdueCount]);
  const receivableOptions = receivablesState
    .filter(item => Number(item.balanceDue || 0) > 0)
    .map(item => ({
      key: item.invoiceId,
      customer: item.customer,
      project: item.project,
      invoiceProject: item.invoiceProject,
      label: `${item.customer} - ${item.project} - Balance ${fmtMoney(item.balanceDue)}`,
      ...item,
    }));

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(LEGACY_FINANCE_PAYMENTS_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_FINANCE_RECEIVABLES_STORAGE_KEY);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(FINANCE_REVENUE_ITEMS_STORAGE_KEY, JSON.stringify(revenueItemsState));
  }, [revenueItemsState]);

  const refreshOverviewSummary = async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const summary = await fetchFinanceOverviewSummary();
      setOverviewSummary(summary);
    } catch (error) {
      setOverviewSummary(null);
      setOverviewError(error instanceof Error ? error.message : "Unable to load finance overview summary.");
    } finally {
      setOverviewLoading(false);
    }
  };

  const refreshPaymentsData = async () => {
    setFinanceLoading(true);
    setFinanceError(null);
    try {
      const snapshot = await fetchFinancePaymentsSnapshot();
      setReceivablesState(snapshot.receivables);
      setPaymentsState(snapshot.payments);
    } catch (error) {
      setFinanceError(error instanceof Error ? error.message : "Unable to load finance data.");
    } finally {
      setFinanceLoading(false);
    }
  };

  useEffect(() => {
    void refreshPaymentsData();
    void refreshOverviewSummary();
  }, []);

  const openPaymentModal = (receivableKey = "") => {
    const selected = receivableOptions.find(item => item.key === receivableKey);
    setPaymentDraft({
      ...getInitialPaymentDraft(receivableKey),
      invoiceProject: selected?.invoiceProject || "",
    });
    setPaymentErrors([]);
  };

  const handlePaymentDraftChange = (field: string, value: string) => {
    setPaymentErrors([]);
    setPaymentDraft((current: any) => {
      if (!current) return current;
      if (field === "receivableKey") {
        const selected = receivableOptions.find(item => item.key === value);
        return {
          ...current,
          receivableKey: value,
          invoiceProject: selected?.invoiceProject || "",
        };
      }
      return { ...current, [field]: value };
    });
  };

  const savePayment = async () => {
    if (!paymentDraft) return;
    const errors: string[] = [];
    const selected = receivableOptions.find(item => item.key === paymentDraft.receivableKey);
    const amount = Number(paymentDraft.amount);
    if (!selected) errors.push("Select a customer/job.");
    if (!paymentDraft.amount) errors.push("Enter a payment amount.");
    if (paymentDraft.amount && amount <= 0) errors.push("Payment amount must be greater than 0.");
    if (!paymentDraft.date) errors.push("Enter a payment date.");
    if (errors.length > 0) {
      setPaymentErrors(errors);
      return;
    }
    if (!selected) return;

    setPaymentSaving(true);

    try {
      await createPayment({
        invoiceId: selected.invoiceId,
        paymentDate: paymentDraft.date,
        amount,
        paymentMethod: paymentDraft.method,
        referenceNumber: paymentDraft.reference,
        notes: paymentDraft.notes,
      });
      await refreshPaymentsData();
      await refreshOverviewSummary();
      setPaymentDraft(null);
      setPaymentErrors([]);
    } catch (error) {
      setPaymentErrors([error instanceof Error ? error.message : "Unable to save payment."]);
    } finally {
      setPaymentSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <FinanceHeaderCard financeView={financeView} overdueWarningText={overdueWarningText} onFinanceViewChange={onFinanceViewChange} />

      {financeView === "overview" && (
        <>
          {overviewLoading ? (
            <SectionCard title="Loading Overview" subtitle="Fetching live finance totals from Supabase.">
              <FinanceEmptyState message="Loading collected revenue, receivables, expenses, and profit..." />
            </SectionCard>
          ) : overviewError ? (
            <SectionCard
              title="Unable to Load Overview"
              subtitle="The live finance summary could not be loaded."
              action={(
                <button className="oak-button oak-button--outline" style={{ minHeight: 36, padding: "6px 12px", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }} onClick={() => { void refreshOverviewSummary(); }}>
                  Retry
                </button>
              )}
            >
              <FinanceEmptyState message={overviewError} />
            </SectionCard>
          ) : hasOverviewSummaryData(overviewSummary) ? (
            <OverviewKpiGrid summary={overviewSummary as FinanceOverviewSummary} />
          ) : (
            <SectionCard title="Overview Totals" subtitle="All-time finance totals from Supabase.">
              <FinanceEmptyState message="No collected payments, open receivables, or recorded expenses found yet." />
            </SectionCard>
          )}
          <div className="finance-snapshot-grid">
            <OverviewPlaceholderCard title="Pipeline Health" subtitle="Live breakdown coming next" />
            <OverviewPlaceholderCard title="Revenue Mix" subtitle="Live breakdown coming next" />
            <OverviewPlaceholderCard title="Customer Split" subtitle="Live breakdown coming next" />
          </div>
          <NeedsAttentionSection />
        </>
      )}

      {financeView === "revenue" && <RevenueView onFinanceViewChange={onFinanceViewChange} revenueItemsData={revenueItemsState} />}
      {financeView === "payments" && (
        <PaymentsView
          receivablesData={receivablesState}
          paymentsData={paymentsState}
          isLoading={financeLoading}
          loadError={financeError}
          onRetry={() => {
            void refreshPaymentsData();
          }}
          onOpenPaymentModal={openPaymentModal}
        />
      )}
      {financeView === "reports" && <ReportsView />}
      {paymentDraft && (
        <AddPaymentModal
          receivableOptions={receivableOptions}
          draft={paymentDraft}
          errors={paymentErrors}
          onChange={handlePaymentDraftChange}
          onClose={() => {
            if (paymentSaving) return;
            setPaymentDraft(null);
            setPaymentErrors([]);
          }}
          onSave={() => {
            if (paymentSaving) return;
            void savePayment();
          }}
        />
      )}
    </div>
  );
}

export default FinanceDashboard;
