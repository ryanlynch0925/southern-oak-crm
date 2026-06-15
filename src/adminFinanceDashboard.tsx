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

const formatCurrency = (value: number) => `$${value.toLocaleString()}`;
const fmtDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
const DONUT_SIZE = 184;
const DONUT_RADIUS = 58;
const DONUT_STROKE = 18;
const GAUGE_SIZE = 220;
const GAUGE_OUTER_RADIUS = 82;
const GAUGE_INNER_RADIUS = 56;

type ChartRow = { label: string; value: number; color: string };
type ChartEditorKey = "status" | "service" | "customer";

const calculateTotal = (rows: ChartRow[]) => rows.reduce((sum, row) => sum + Math.max(row.value, 0), 0);
const calculatePercentage = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 100) : 0);
const cloneRows = (rows: ChartRow[]) => rows.map(row => ({ ...row }));

const STATUS_CHART_COLORS = ["#5D84B7", "#586574", "#2F6B45", "#B38728", "#8B6A3E", "#6A7350", "#1F5A3A", "#3E719D", "#A85A52"];
const SERVICE_CHART_COLORS = ["#2F6B45", "#B38728", "#5D84B7", "#8B6A3E", "#6A7350", "#586574", "#9AA0A6", "#A85A52"];

const DEFAULT_STATUS_CHART_ROWS: ChartRow[] = revenueByStatus.map((row, index) => ({
  ...row,
  color: STATUS_CHART_COLORS[index] ?? row.color,
}));

const DEFAULT_SERVICE_TYPE_CHART_ROWS: ChartRow[] = revenueByServiceType.map((row, index) => ({
  ...row,
  color: SERVICE_CHART_COLORS[index] ?? row.color,
}));

const DEFAULT_CUSTOMER_TYPE_CHART_ROWS: ChartRow[] = [
  { label: "Residential", value: residentialVsBuilder.residential.value, color: "#2F6B45" },
  { label: "Builder", value: residentialVsBuilder.builder.value, color: "#B38728" },
];

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function describeDonutSegment(cx: number, cy: number, outerRadius: number, innerRadius: number, startAngle: number, endAngle: number) {
  const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerEnd.x} ${innerEnd.y}`,
    "Z",
  ].join(" ");
}

function buildChartSegments(rows: ChartRow[], total: number, startAngle: number, sweepAngle: number) {
  let currentAngle = startAngle;

  return rows
    .filter(row => row.value > 0)
    .map(row => {
      const angleSpan = total > 0 ? (row.value / total) * sweepAngle : 0;
      const segment = {
        ...row,
        percentage: calculatePercentage(row.value, total),
        startAngle: currentAngle,
        endAngle: currentAngle + angleSpan,
      };
      currentAngle += angleSpan;
      return segment;
    });
}

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
              <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "var(--admin-text)", marginTop: 8 }}>{formatCurrency(item.value)}</div>
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

function ChartLegend({ rows, total }: { rows: ChartRow[]; total: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 220, flex: "1 1 220px" }}>
      {rows.map(row => (
        <div key={row.label} style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto auto", gap: 10, alignItems: "center", padding: "8px 10px", borderRadius: 10, background: "var(--admin-card-soft)", border: "1px solid rgba(216,210,195,.65)" }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: row.color, display: "inline-block", flexShrink: 0 }} />
          <span style={{ color: "var(--admin-text)", fontWeight: 600, fontSize: ".82rem", minWidth: 0 }}>{row.label}</span>
          <span style={{ color: "var(--admin-text)", fontWeight: 700, fontSize: ".8rem" }}>{formatCurrency(row.value)}</span>
          <span style={{ color: "var(--admin-muted)", fontSize: ".76rem", fontWeight: 600 }}>{calculatePercentage(row.value, total)}%</span>
        </div>
      ))}
    </div>
  );
}

function ChartEditorButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="oak-button"
      style={{
        minHeight: 38,
        padding: "8px 12px",
        borderRadius: 8,
        cursor: "pointer",
        fontWeight: 700,
        fontFamily: "inherit",
        border: `1px solid ${active ? "rgba(154,116,26,.3)" : "var(--admin-border)"}`,
        background: active ? "rgba(154,116,26,.12)" : "var(--admin-card-bg)",
        color: active ? "var(--oak-gold)" : "var(--admin-text)",
      }}
    >
      {label}
    </button>
  );
}

function ChartTestModeCard({
  chartEditor,
  setChartEditor,
  statusRows,
  serviceRows,
  customerRows,
  updateRows,
  resetRows,
}: {
  chartEditor: ChartEditorKey;
  setChartEditor: (value: ChartEditorKey) => void;
  statusRows: ChartRow[];
  serviceRows: ChartRow[];
  customerRows: ChartRow[];
  updateRows: (key: ChartEditorKey, rowIndex: number, value: number) => void;
  resetRows: (key?: ChartEditorKey) => void;
}) {
  const rows = chartEditor === "status" ? statusRows : chartEditor === "service" ? serviceRows : customerRows;
  const totals = {
    status: calculateTotal(statusRows),
    service: calculateTotal(serviceRows),
    customer: calculateTotal(customerRows),
  };

  return (
    <SectionCard title="Chart Test Mode" subtitle="Adjust chart values locally to confirm the visuals respond to the data.">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <ChartEditorButton active={chartEditor === "status"} label="Job Status" onClick={() => setChartEditor("status")} />
        <ChartEditorButton active={chartEditor === "service"} label="Service Type" onClick={() => setChartEditor("service")} />
        <ChartEditorButton active={chartEditor === "customer"} label="Customer Mix" onClick={() => setChartEditor("customer")} />
        <button type="button" className="oak-button oak-button--outline" onClick={() => resetRows(chartEditor)} style={{ minHeight: 38, padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontFamily: "inherit" }}>
          Reset This Chart
        </button>
        <button type="button" className="oak-button oak-button--outline" onClick={() => resetRows()} style={{ minHeight: 38, padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontFamily: "inherit" }}>
          Reset All
        </button>
      </div>
      <div style={{ marginBottom: 14, fontSize: ".8rem", color: "var(--admin-muted)" }}>
        Current total: <span style={{ color: "var(--admin-text)", fontWeight: 700 }}>{formatCurrency(totals[chartEditor])}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
        {rows.map((row, index) => (
          <div key={row.label} style={{ padding: "12px 14px", borderRadius: 10, background: "var(--admin-card-soft)", border: "1px solid var(--admin-border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: row.color, display: "inline-block" }} />
              <span style={{ color: "var(--admin-text)", fontWeight: 700, fontSize: ".82rem" }}>{row.label}</span>
            </div>
            <label style={{ ...labelStyle, marginBottom: 4 }}>Value</label>
            <input
              type="number"
              min="0"
              step="50"
              value={row.value}
              onChange={e => updateRows(chartEditor, index, Number(e.target.value || 0))}
              style={{ width: "100%", minHeight: 42, border: "1px solid var(--admin-border)", borderRadius: 8, padding: "9px 12px", background: "var(--admin-card-bg)", color: "var(--admin-text)" }}
            />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function DonutChartCard({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: ChartRow[];
}) {
  const chartTotal = calculateTotal(rows);
  const outerRadius = DONUT_RADIUS + DONUT_STROKE / 2;
  const innerRadius = DONUT_RADIUS - DONUT_STROKE / 2;
  const segments = buildChartSegments(rows, chartTotal, -90, 360);

  return (
    <SectionCard title={title} subtitle={subtitle}>
      <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: "0 1 220px", width: "100%", maxWidth: 220, margin: "0 auto", display: "flex", justifyContent: "center" }}>
          <div style={{ position: "relative", width: DONUT_SIZE, height: DONUT_SIZE }}>
            <svg width={DONUT_SIZE} height={DONUT_SIZE} viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`} aria-hidden="true">
              <path
                d={describeDonutSegment(DONUT_SIZE / 2, DONUT_SIZE / 2, outerRadius, innerRadius, 0, 359.999)}
                fill="rgba(22,19,13,.08)"
              />
              {segments.map(segment => {
                const span = segment.endAngle - segment.startAngle;
                const gapAngle = span > 8 ? 1.4 : 0;
                return (
                  <path
                    key={segment.label}
                    d={describeDonutSegment(
                      DONUT_SIZE / 2,
                      DONUT_SIZE / 2,
                      outerRadius,
                      innerRadius,
                      segment.startAngle + gapAngle / 2,
                      segment.endAngle - gapAngle / 2,
                    )}
                    fill={segment.color}
                  />
                );
              })}
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", pointerEvents: "none" }}>
              <div style={{ fontSize: ".78rem", color: "var(--admin-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" }}>Total</div>
              <div style={{ fontSize: "1.25rem", color: "var(--admin-text)", fontWeight: 800, marginTop: 4 }}>{formatCurrency(chartTotal)}</div>
            </div>
          </div>
        </div>
        <ChartLegend rows={rows} total={chartTotal} />
      </div>
    </SectionCard>
  );
}

function GaugeChartCard({ rows }: { rows: ChartRow[] }) {
  const total = calculateTotal(rows);
  const segments = buildChartSegments(rows, total, 180, 180);

  return (
    <SectionCard title="Residential vs Builder Revenue" subtitle="Current mix by customer type">
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
          <div style={{ position: "relative", width: GAUGE_SIZE, height: 138 }}>
            <svg width={GAUGE_SIZE} height={138} viewBox={`0 0 ${GAUGE_SIZE} 138`} aria-hidden="true">
              <path
                d={describeDonutSegment(GAUGE_SIZE / 2, GAUGE_SIZE / 2, GAUGE_OUTER_RADIUS, GAUGE_INNER_RADIUS, 180, 360)}
                fill="rgba(22,19,13,.08)"
              />
              {segments.map(segment => {
                const span = segment.endAngle - segment.startAngle;
                const gapAngle = span > 6 ? 1.4 : 0;
                return (
                  <path
                    key={segment.label}
                    d={describeDonutSegment(
                      GAUGE_SIZE / 2,
                      GAUGE_SIZE / 2,
                      GAUGE_OUTER_RADIUS,
                      GAUGE_INNER_RADIUS,
                      segment.startAngle + gapAngle / 2,
                      segment.endAngle - gapAngle / 2,
                    )}
                    fill={segment.color}
                  />
                );
              })}
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", pointerEvents: "none" }}>
              <div style={{ fontSize: ".76rem", color: "var(--admin-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", marginTop: 34 }}>Total</div>
              <div style={{ fontSize: "1.28rem", color: "var(--admin-text)", fontWeight: 800, marginTop: 4 }}>{formatCurrency(total)}</div>
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
          {segments.map(segment => (
            <div key={segment.label} style={{ padding: "14px 16px", borderRadius: 12, background: "var(--admin-card-soft)", border: "1px solid rgba(216,210,195,.65)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--admin-text)", fontWeight: 700 }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: segment.color, display: "inline-block" }} />
                {segment.label}
              </div>
              <div style={{ marginTop: 10, fontSize: "1.1rem", fontWeight: 800, color: "var(--admin-text)" }}>{formatCurrency(segment.value)}</div>
              <div style={{ marginTop: 4, fontSize: ".8rem", color: "var(--admin-muted)" }}>{segment.percentage}% of total</div>
            </div>
          ))}
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
  const [chartTestMode, setChartTestMode] = useState(false);
  const [chartEditor, setChartEditor] = useState<ChartEditorKey>("status");
  const [testStatusRows, setTestStatusRows] = useState<ChartRow[]>(() => cloneRows(DEFAULT_STATUS_CHART_ROWS));
  const [testServiceRows, setTestServiceRows] = useState<ChartRow[]>(() => cloneRows(DEFAULT_SERVICE_TYPE_CHART_ROWS));
  const [testCustomerRows, setTestCustomerRows] = useState<ChartRow[]>(() => cloneRows(DEFAULT_CUSTOMER_TYPE_CHART_ROWS));

  const overdueCount = useMemo(() => receivables.filter(item => item.status === "Past Due").length, []);
  const activeStatusRows = chartTestMode ? testStatusRows : DEFAULT_STATUS_CHART_ROWS;
  const activeServiceRows = chartTestMode ? testServiceRows : DEFAULT_SERVICE_TYPE_CHART_ROWS;
  const activeCustomerRows = chartTestMode ? testCustomerRows : DEFAULT_CUSTOMER_TYPE_CHART_ROWS;

  const showOverview = financeView === "overview";
  const showRevenue = financeView === "overview" || financeView === "revenue";
  const showPayments = financeView === "overview" || financeView === "payments";
  const showReports = financeView === "overview" || financeView === "reports";

  const updateChartRows = (key: ChartEditorKey, rowIndex: number, value: number) => {
    const safeValue = Math.max(0, value);
    const updater = (rows: ChartRow[]) => rows.map((row, index) => index === rowIndex ? { ...row, value: safeValue } : row);
    if (key === "status") setTestStatusRows(prev => updater(prev));
    if (key === "service") setTestServiceRows(prev => updater(prev));
    if (key === "customer") setTestCustomerRows(prev => updater(prev));
  };

  const resetChartRows = (key?: ChartEditorKey) => {
    if (!key || key === "status") setTestStatusRows(cloneRows(DEFAULT_STATUS_CHART_ROWS));
    if (!key || key === "service") setTestServiceRows(cloneRows(DEFAULT_SERVICE_TYPE_CHART_ROWS));
    if (!key || key === "customer") setTestCustomerRows(cloneRows(DEFAULT_CUSTOMER_TYPE_CHART_ROWS));
  };

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
          <button
            className="oak-button oak-button--outline"
            onClick={() => {
              setChartTestMode(prev => !prev);
              if (!chartTestMode) {
                resetChartRows();
              }
            }}
            style={{ minHeight: 40, padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontFamily: "inherit" }}
          >
            <i className="ti ti-flask-2" style={{ marginRight: 6 }} aria-hidden="true" />
            {chartTestMode ? "Exit Test Mode" : "Chart Test Mode"}
          </button>
          <div style={{ marginLeft: "auto", fontSize: ".76rem", color: "var(--admin-muted)", alignSelf: "center" }}>
            {overdueCount} receivables past due
          </div>
        </div>
      </SectionCard>

      {showOverview && <KpiGrid />}
      {!showOverview && financeView === "revenue" && <KpiGrid />}

      {chartTestMode && showRevenue && (
        <ChartTestModeCard
          chartEditor={chartEditor}
          setChartEditor={setChartEditor}
          statusRows={testStatusRows}
          serviceRows={testServiceRows}
          customerRows={testCustomerRows}
          updateRows={updateChartRows}
          resetRows={resetChartRows}
        />
      )}

      {showRevenue && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
          <DonutChartCard title="Revenue by Job Status" subtitle="Current dollars by job stage" rows={activeStatusRows} />
          <DonutChartCard title="Revenue by Service Type" subtitle="Top service categories this period" rows={activeServiceRows} />
          <GaugeChartCard rows={activeCustomerRows} />
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
                  <td style={{ padding: "12px" }}>{formatCurrency(row.finalPrice)}</td>
                  <td style={{ padding: "12px" }}>{formatCurrency(row.paid)}</td>
                  <td style={{ padding: "12px", fontWeight: 700 }}>{formatCurrency(row.balanceDue)}</td>
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
                <td style={{ padding: "12px" }}>{formatCurrency(row.amount)}</td>
                <td style={{ padding: "12px", color: "var(--admin-muted)" }}>{row.method}</td>
                <td style={{ padding: "12px" }}>{formatCurrency(row.remainingBalance)}</td>
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
                <td style={{ padding: "12px" }}>{formatCurrency(row.finalPrice)}</td>
                <td style={{ padding: "12px" }}>{formatCurrency(row.totalCost)}</td>
                <td style={{ padding: "12px" }}>{formatCurrency(row.grossProfit)}</td>
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
