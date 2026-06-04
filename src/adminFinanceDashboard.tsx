import { useMemo, useState, type ReactNode } from "react";
import {
  financeKpis,
  financePayments,
  financeJobs,
  lowMarginJobs,
  receivables,
  residentialVsBuilder,
  revenueByServiceType,
  revenueByStatus,
} from "./data/financeData";

const CARD = {
  background: "var(--admin-card-bg)",
  border: "1px solid var(--admin-border)",
  borderRadius: 10,
  padding: 18,
};

const labelStyle = { display: "block", fontSize: ".74rem", fontWeight: 700, color: "var(--admin-muted)", marginBottom: 6 };

const fmtMoney = (value: number) => `$${value.toLocaleString()}`;
const fmtDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

function SectionCard({ title, subtitle, actionLabel, children }: { title: string; subtitle?: string; actionLabel?: string; children: ReactNode }) {
  return (
    <div style={CARD}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--admin-text)" }}>{title}</div>
          {subtitle && <div style={{ fontSize: ".8rem", color: "var(--admin-muted)", marginTop: 2 }}>{subtitle}</div>}
        </div>
        {actionLabel && <button className="oak-button oak-button--outline" style={{ padding: "8px 12px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{actionLabel}</button>}
      </div>
      {children}
    </div>
  );
}

function KpiGrid() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 18 }}>
      {financeKpis.map(item => (
        <div key={item.id} style={CARD}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: ".74rem", color: "var(--admin-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" }}>{item.label}</div>
              <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "var(--admin-text)", marginTop: 8 }}>{fmtMoney(item.value)}</div>
            </div>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(154,116,26,.12)", color: "var(--oak-gold)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <i className={`ti ${item.icon}`} style={{ fontSize: 18 }} aria-hidden="true" />
            </div>
          </div>
          <div style={{ fontSize: ".8rem", color: "var(--admin-muted)", marginBottom: 6 }}>{item.subtitle}</div>
          <div style={{ fontSize: ".78rem", color: item.trend === "up" ? "#25603C" : "#A14B40", fontWeight: 700 }}>
            {item.trend === "up" ? "↑" : "↓"} {item.trendLabel}
          </div>
        </div>
      ))}
    </div>
  );
}

function BarList({ rows }: { rows: Array<{ label: string; value: number; color: string }> }) {
  const max = Math.max(...rows.map(row => row.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map(row => (
        <div key={row.label}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 6, fontSize: ".8rem" }}>
            <span style={{ color: "var(--admin-text)", fontWeight: 600 }}>{row.label}</span>
            <span style={{ color: "var(--admin-muted)" }}>{fmtMoney(row.value)}</span>
          </div>
          <div style={{ height: 10, borderRadius: 999, background: "rgba(22,19,13,.08)", overflow: "hidden" }}>
            <div style={{ width: `${(row.value / max) * 100}%`, height: "100%", background: row.color, borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function CompareCard() {
  return (
    <SectionCard title="Residential vs Builder Revenue" subtitle="Current mix by customer type">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ padding: 14, borderRadius: 10, background: "rgba(23,35,21,.06)", border: "1px solid rgba(23,35,21,.12)" }}>
            <div style={{ fontSize: ".74rem", color: "var(--admin-muted)", fontWeight: 700 }}>Residential</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--admin-text)", marginTop: 8 }}>{fmtMoney(residentialVsBuilder.residential.value)}</div>
            <div style={{ fontSize: ".8rem", color: "#25603C", marginTop: 4 }}>{residentialVsBuilder.residential.percent}%</div>
          </div>
          <div style={{ padding: 14, borderRadius: 10, background: "rgba(154,116,26,.08)", border: "1px solid rgba(154,116,26,.14)" }}>
            <div style={{ fontSize: ".74rem", color: "var(--admin-muted)", fontWeight: 700 }}>Builder</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--admin-text)", marginTop: 8 }}>{fmtMoney(residentialVsBuilder.builder.value)}</div>
            <div style={{ fontSize: ".8rem", color: "var(--oak-gold)", marginTop: 4 }}>{residentialVsBuilder.builder.percent}%</div>
          </div>
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8, fontSize: ".8rem" }}>
            <span style={{ color: "var(--admin-muted)" }}>Total Revenue</span>
            <span style={{ color: "var(--admin-text)", fontWeight: 700 }}>{fmtMoney(residentialVsBuilder.total)}</span>
          </div>
          <div style={{ height: 14, borderRadius: 999, background: "rgba(22,19,13,.08)", overflow: "hidden", display: "flex" }}>
            <div style={{ width: `${residentialVsBuilder.residential.percent}%`, background: "#2F6A47" }} />
            <div style={{ width: `${residentialVsBuilder.builder.percent}%`, background: "var(--oak-gold)" }} />
          </div>
        </div>
      </div>
    </SectionCard>
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

function statusBadge(status: string) {
  const map: Record<string, { color: string; background: string }> = {
    "Past Due": { color: "#A14B40", background: "#F9E8E4" },
    "Due Soon": { color: "#8A6A12", background: "#F8F1D9" },
    "Not Due": { color: "#25603C", background: "#E6F3EA" },
  };
  return map[status] || { color: "var(--admin-text)", background: "var(--admin-card-soft)" };
}

function FinanceDashboard({
  financeView,
  onFinanceViewChange,
}: {
  financeView: string;
  onFinanceViewChange: (value: string) => void;
}) {
  const [dateRange, setDateRange] = useState("May 1 - May 31, 2026");
  const [jobType, setJobType] = useState("All Job Types");
  const [customerType, setCustomerType] = useState("All Customers");
  const [status, setStatus] = useState("All Statuses");

  const overdueCount = useMemo(() => receivables.filter(item => item.status === "Past Due").length, []);

  const showOverview = financeView === "overview";
  const showRevenue = financeView === "overview" || financeView === "revenue";
  const showPayments = financeView === "overview" || financeView === "payments";
  const showReports = financeView === "overview" || financeView === "reports";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <SectionCard title="Finance Dashboard" subtitle="Track revenue, profitability, and payments across your business.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
          <div>
            <label style={labelStyle}>Date range</label>
            <select value={dateRange} onChange={e => setDateRange(e.target.value)} style={{ width: "100%", minHeight: 44, border: "1px solid var(--admin-border)", borderRadius: 8, padding: "10px 12px", background: "var(--admin-card-bg)", color: "var(--admin-text)" }}>
              <option>May 1 - May 31, 2026</option>
              <option>Apr 1 - Apr 30, 2026</option>
              <option>Year to Date</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Job type</label>
            <select value={jobType} onChange={e => setJobType(e.target.value)} style={{ width: "100%", minHeight: 44, border: "1px solid var(--admin-border)", borderRadius: 8, padding: "10px 12px", background: "var(--admin-card-bg)", color: "var(--admin-text)" }}>
              <option>All Job Types</option>
              <option>Driveways</option>
              <option>Patios</option>
              <option>Builder Slabs</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Customer type</label>
            <select value={customerType} onChange={e => setCustomerType(e.target.value)} style={{ width: "100%", minHeight: 44, border: "1px solid var(--admin-border)", borderRadius: 8, padding: "10px 12px", background: "var(--admin-card-bg)", color: "var(--admin-text)" }}>
              <option>All Customers</option>
              <option>Residential</option>
              <option>Builder</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)} style={{ width: "100%", minHeight: 44, border: "1px solid var(--admin-border)", borderRadius: 8, padding: "10px 12px", background: "var(--admin-card-bg)", color: "var(--admin-text)" }}>
              <option>All Statuses</option>
              <option>Past Due</option>
              <option>Due Soon</option>
              <option>Completed</option>
            </select>
          </div>
          <div style={{ alignSelf: "end" }}>
            <button className="oak-button oak-button--primary" style={{ width: "100%", minHeight: 44, border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              <i className="ti ti-download" style={{ marginRight: 6 }} aria-hidden="true" />
              Export
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          {[
            { id: "overview", label: "Overview" },
            { id: "revenue", label: "Revenue" },
            { id: "payments", label: "Payments" },
            { id: "reports", label: "Reports" },
          ].map(item => (
            <button
              key={item.id}
              className="oak-button"
              onClick={() => onFinanceViewChange(item.id)}
              style={{
                minHeight: 40,
                padding: "8px 12px",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 700,
                fontFamily: "inherit",
                border: `1px solid ${financeView === item.id ? "rgba(154,116,26,.3)" : "var(--admin-border)"}`,
                background: financeView === item.id ? "rgba(154,116,26,.12)" : "var(--admin-card-bg)",
                color: financeView === item.id ? "var(--oak-gold)" : "var(--admin-text)",
              }}
            >
              {item.label}
            </button>
          ))}
          <div style={{ marginLeft: "auto", fontSize: ".76rem", color: "var(--admin-muted)", alignSelf: "center" }}>
            {overdueCount} receivables past due
          </div>
        </div>
      </SectionCard>

      {showOverview && <KpiGrid />}
      {!showOverview && financeView === "revenue" && <KpiGrid />}

      {showRevenue && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
          <SectionCard title="Revenue by Job Status" subtitle="Current dollars by job stage">
            <BarList rows={revenueByStatus} />
          </SectionCard>
          <SectionCard title="Revenue by Service Type" subtitle="Top service categories this period">
            <BarList rows={revenueByServiceType} />
          </SectionCard>
          <CompareCard />
        </div>
      )}

      {showPayments && (
        <SectionCard title="Accounts Receivable" subtitle="Open Balances" actionLabel="View All">
          <FinanceTable
            columns={["Customer", "Job / Project", "Final Price", "Paid", "Balance Due", "Due Date", "Status", "Days Overdue"]}
            rows={receivables}
            renderRow={row => {
              const badge = statusBadge(row.status);
              return (
                <tr key={`${row.customer}-${row.project}`} style={{ borderBottom: "1px solid var(--admin-border)" }}>
                  <td style={{ padding: "12px" }}>{row.customer}</td>
                  <td style={{ padding: "12px", color: "var(--admin-muted)" }}>{row.project}</td>
                  <td style={{ padding: "12px" }}>{fmtMoney(row.finalPrice)}</td>
                  <td style={{ padding: "12px" }}>{fmtMoney(row.paid)}</td>
                  <td style={{ padding: "12px", fontWeight: 700 }}>{fmtMoney(row.balanceDue)}</td>
                  <td style={{ padding: "12px" }}>{fmtDate(row.dueDate)}</td>
                  <td style={{ padding: "12px" }}>
                    <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: 999, background: badge.background, color: badge.color, fontSize: ".74rem", fontWeight: 700 }}>{row.status}</span>
                  </td>
                  <td style={{ padding: "12px" }}>{row.daysOverdue ?? "-"}</td>
                </tr>
              );
            }}
          />
        </SectionCard>
      )}

      {showPayments && (
        <SectionCard title="Recent Payments" actionLabel="View All">
          <FinanceTable
            columns={["Date", "Customer / Job", "Payment", "Method", "Remaining Balance"]}
            rows={financePayments}
            renderRow={row => (
              <tr key={`${row.date}-${row.customerJob}`} style={{ borderBottom: "1px solid var(--admin-border)" }}>
                <td style={{ padding: "12px" }}>{fmtDate(row.date)}</td>
                <td style={{ padding: "12px", fontWeight: 600 }}>{row.customerJob}</td>
                <td style={{ padding: "12px" }}>{fmtMoney(row.amount)}</td>
                <td style={{ padding: "12px", color: "var(--admin-muted)" }}>{row.method}</td>
                <td style={{ padding: "12px" }}>{fmtMoney(row.remainingBalance)}</td>
              </tr>
            )}
          />
        </SectionCard>
      )}

      {showReports && (
        <SectionCard title="Low Margin Jobs" subtitle="Below 25% Margin" actionLabel="View All">
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
      )}

      {financeView === "reports" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
          <SectionCard title="Open Invoices by Customer Type">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[["Residential", financeJobs.filter(job => job.customerType === "Residential").length], ["Builder", financeJobs.filter(job => job.customerType === "Builder").length]].map(([label, count]) => (
                <div key={String(label)} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 14px", borderRadius: 10, background: "var(--admin-card-soft)", border: "1px solid var(--admin-border)" }}>
                  <span style={{ color: "var(--admin-text)", fontWeight: 600 }}>{label}</span>
                  <span style={{ color: "var(--admin-muted)" }}>{count} invoices</span>
                </div>
              ))}
            </div>
          </SectionCard>
          <SectionCard title="High-Level Profitability">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(23,35,21,.06)", border: "1px solid rgba(23,35,21,.12)" }}>
                <div style={{ fontSize: ".74rem", color: "var(--admin-muted)", fontWeight: 700 }}>Average gross margin</div>
                <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--admin-text)", marginTop: 8 }}>{pct(lowMarginJobs.reduce((sum, job) => sum + job.grossMargin, 0) / lowMarginJobs.length)}</div>
              </div>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}

export default FinanceDashboard;
