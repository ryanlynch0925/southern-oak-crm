import { useEffect, useMemo, useState } from "react";

const B = {
  dark: "#1A1A1A",
  dark2: "#252525",
  mid: "#3A3A3A",
  gray: "#696969",
  lgray: "#A8A094",
  border: "#DDD5C5",
  sand: "#F5F0E8",
  sandD: "#EDE5D3",
  tan: "#C4A882",
  bronze: "#8B6914",
  bronzeL: "#B8900F",
  green: "#2D4A2D",
  green2: "#3A5C3A",
  white: "#FFFFFF",
};

const BRAND_LOGO_SRC = `${import.meta.env.BASE_URL}branding/main_logo.png`;
const RESIDENTIAL_EVENT_COLOR = "#6C3483";
const BUILDER_COLOR_PALETTE = ["#2D6A4F", "#A15C16", "#1F5F8B", "#8B3D5E", "#546A2E", "#6C4A8B"];

const INP = {
  width: "100%",
  padding: "9px 12px",
  border: "1.5px solid #DDD5C5",
  borderRadius: 6,
  fontSize: ".88rem",
  fontFamily: "inherit",
  background: B.white,
  color: B.dark,
  outline: "none",
  boxSizing: "border-box",
};

const ADMIN_SECTIONS = [
  { id: "tickets", label: "Estimate Tickets", icon: "ti-file-text" },
  { id: "calendar", label: "Calendar Schedule", icon: "ti-calendar-event" },
  { id: "jobs", label: "Jobs", icon: "ti-hammer" },
  { id: "crews", label: "Crews", icon: "ti-users-group" },
  { id: "builders", label: "Builders", icon: "ti-building-community" },
  { id: "settings", label: "Settings", icon: "ti-settings" },
];

const ESTIMATE_STATUSES = [
  "New Request",
  "Needs Review",
  "Rough Estimate Sent",
  "Site Visit Needed",
  "Scheduled",
  "Final Quote Sent",
  "Estimate Accepted",
  "Ready to Schedule",
  "Won",
  "Lost",
];

const JOB_STATUSES = [
  "Estimate Accepted",
  "Ready to Schedule",
  "Scheduled",
  "In Progress",
  "Completed",
  "Delayed",
  "Cancelled",
];

const STATUS_STYLES = {
  "New Request": { c: "#1A5276", bg: "#D6EAF8" },
  "Needs Review": { c: "#784212", bg: "#FDEBD0" },
  "Rough Estimate Sent": { c: "#6C3483", bg: "#F4ECF7" },
  "Site Visit Needed": { c: "#922B21", bg: "#FADBD8" },
  Scheduled: { c: "#1A5632", bg: "#D5F5E3" },
  "Final Quote Sent": { c: "#1B4F72", bg: "#D6EAF8" },
  "Estimate Accepted": { c: "#145A32", bg: "#D4EFDF" },
  "Ready to Schedule": { c: "#7D6608", bg: "#FCF3CF" },
  "In Progress": { c: "#884EA0", bg: "#EBDEF0" },
  Completed: { c: "#145A32", bg: "#A9DFBF" },
  Delayed: { c: "#922B21", bg: "#FADBD8" },
  Cancelled: { c: "#4D5656", bg: "#EAEDED" },
  Won: { c: "#145A32", bg: "#A9DFBF" },
  Lost: { c: "#4D5656", bg: "#EAEDED" },
  Pending: { c: "#5D6D7E", bg: "#E5E8E8" },
};

const RESPONSIBLE_PARTIES = [
  "Southern Oak Concrete",
  "Builder",
  "Plumber",
  "Inspector",
  "Other",
];

const BUILDER_PHASES = [
  { key: "prep_slab", label: "Prep Slab", responsible_party: "Southern Oak Concrete", counts_toward_crew: true },
  { key: "form_slab", label: "Form Slab", responsible_party: "Southern Oak Concrete", counts_toward_crew: true },
  { key: "pour_slab", label: "Pour Slab", responsible_party: "Southern Oak Concrete", counts_toward_crew: true },
];
const BUILDER_PHASE_INDEX = new Map(BUILDER_PHASES.map((phase, idx) => [phase.key, idx]));

const SCHEMA_TABLES = [
  "estimates",
  "estimate_status_history",
  "jobs",
  "job_phases",
  "builders",
  "crews",
  "calendar_events",
  "job_notes",
  "schedule_change_history",
  "conflict_override_history",
];

const DEFAULT_CREWS = [
  { id: "crew-1", number: 1, name: "Crew 1", foreman: "Luis Martinez", dailyCapacity: 1, notes: "Flatwork and residential pours." },
  { id: "crew-2", number: 2, name: "Crew 2", foreman: "Jason Webb", dailyCapacity: 1, notes: "Builder slab production crew." },
  { id: "crew-3", number: 3, name: "Crew 3", foreman: "Chris Mullins", dailyCapacity: 1, notes: "Repairs, small patios, punch work." },
];

const DEFAULT_BUILDERS = [
  { id: "builder-valor", name: "Valor", contact: "Matt Collins", phone: "(770) 555-1001", communities: ["Pine Brook", "Oak Trace"], color: BUILDER_COLOR_PALETTE[0] },
  { id: "builder-smith-douglas", name: "Smith Douglas", contact: "Amy Perry", phone: "(678) 555-2214", communities: ["The Reserve", "Pike Landing"], color: BUILDER_COLOR_PALETTE[1] },
];

const DEFAULT_SETTINGS = {
  skipWeekendsByDefault: true,
  allowWeekendOverride: true,
  defaultCrewCapacity: 1,
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const fmtDate = iso => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-";
const fmtDateShort = iso => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "-";
const fmtTime = value => value || "-";
const fmtMoney = n => n != null ? `$${Number(n).toLocaleString()}` : "-";
const fmtCap = n => `${Number(n || 0).toFixed(Number(n || 0) % 1 ? 2 : 0)} day`;
const clampDateValue = d => new Date(`${d}T12:00:00`);
const getDayOfWeek = d => clampDateValue(d).getDay();
const isSunday = d => getDayOfWeek(d) === 0;
const isSaturday = d => getDayOfWeek(d) === 6;
const isWeekend = d => isSaturday(d) || isSunday(d);
const plusDays = (dateStr, days) => {
  const dt = clampDateValue(dateStr);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
};
const nextWorkingDate = (dateStr, step = 1) => {
  let result = dateStr;
  let remaining = step;
  while (remaining > 0) {
    result = plusDays(result, 1);
    if (!isWeekend(result)) remaining -= 1;
  }
  return result;
};
const firstWorkingDate = dateStr => {
  let result = dateStr;
  while (isWeekend(result)) result = plusDays(result, 1);
  return result;
};
const suggestResidentialDuration = ticket => {
  if ((ticket.sqft || 0) >= 1800) return 2;
  if ((ticket.sqft || 0) >= 900) return 1;
  if ((ticket.sqft || 0) >= 350) return 0.75;
  if ((ticket.sqft || 0) >= 150) return 0.5;
  return 0.25;
};
const buildCapacitySegments = total => {
  let remaining = Number(total || 0);
  const parts = [];
  while (remaining > 0.001) {
    const chunk = Math.min(1, Number(remaining.toFixed(2)));
    parts.push(Number(chunk.toFixed(2)));
    remaining = Number((remaining - chunk).toFixed(2));
  }
  return parts.length ? parts : [0.25];
};
const sortBuilderPhases = phases => [...(phases || [])].sort((a, b) => (BUILDER_PHASE_INDEX.get(a.phase_key) ?? 999) - (BUILDER_PHASE_INDEX.get(b.phase_key) ?? 999));
const normalizeBuilderJob = job => job.schedule_type === "builder_slab" ? { ...job, phases: sortBuilderPhases(job.phases || []) } : job;
const eventColor = event => event.color || RESIDENTIAL_EVENT_COLOR;

function Logo({ sm = false }) {
  return (
    <img src={BRAND_LOGO_SRC} alt="Southern Oak Concrete & Construction" style={{ display: "block", height: sm ? 34 : 44, width: "auto" }} />
  );
}

function Btn({ children, onClick, v = "primary", sm = false, full = false, style = {}, disabled = false }) {
  const pads = sm ? "6px 14px" : "10px 20px";
  const variants = {
    primary: { background: B.bronze, color: B.white, border: "none" },
    dark: { background: B.dark, color: B.white, border: "none" },
    green: { background: B.green, color: B.white, border: "none" },
    outline: { background: "transparent", color: B.mid, border: `1.5px solid ${B.border}` },
    danger: { background: "#C0392B", color: B.white, border: "none" },
  };
  return (
    <button disabled={disabled} onClick={disabled ? undefined : onClick} style={{ padding: pads, borderRadius: 6, fontSize: sm ? ".78rem" : ".88rem", fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1, fontFamily: "inherit", display: full ? "block" : "inline-block", width: full ? "100%" : undefined, textAlign: "center", ...(variants[v] || variants.primary), ...style }}>
      {children}
    </button>
  );
}

function Pill({ status, label }) {
  const cfg = STATUS_STYLES[status] || { c: "#555", bg: "#eee" };
  return <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, background: cfg.bg, color: cfg.c, fontWeight: 700, fontSize: ".68rem", whiteSpace: "nowrap" }}>{label || status}</span>;
}

function Card({ children, style = {} }) {
  return <div style={{ background: B.white, borderRadius: 8, padding: 18, border: "0.5px solid var(--color-border-tertiary)", ...style }}>{children}</div>;
}

function Modal({ title, children, onClose, width = 720 }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 3000, padding: 20, overflowY: "auto" }}>
      <div style={{ maxWidth: width, margin: "40px auto", background: B.white, borderRadius: 10, border: "0.5px solid var(--color-border-tertiary)", overflow: "hidden" }}>
        <div style={{ padding: "16px 18px", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: B.dark }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: B.gray, cursor: "pointer", fontSize: "1rem" }}>
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>
        <div style={{ padding: 18 }}>{children}</div>
      </div>
    </div>
  );
}

function makePhase(template, date, time, crewId, status = "Ready to Schedule") {
  return {
    id: `${template.key}-${Math.random().toString(36).slice(2, 8)}`,
    phase_key: template.key,
    phase_label: template.label,
    responsible_party: template.responsible_party,
    counts_toward_crew: template.counts_toward_crew,
    scheduled_date: date || "",
    scheduled_time: time || "",
    crew_id: template.counts_toward_crew ? crewId || "" : "",
    work_order_number: "",
    day_capacity_used: template.counts_toward_crew ? (template.key === "pour_slab" ? 1 : 0.5) : 0,
    estimated_duration: template.counts_toward_crew ? (template.key === "pour_slab" ? 1 : 0.5) : 0,
    status,
    notes: "",
  };
}

function buildDefaultJobs() {
  const startA = firstWorkingDate(plusDays(todayIso(), 1));
  const startB = firstWorkingDate(plusDays(todayIso(), 3));
  return [
    {
      id: "job-res-1001",
      schedule_type: "residential",
      name: "Carla Simmons",
      sourceTicketId: "T-007",
      customer_name: "Carla Simmons",
      builder_id: "",
      builder_name: "",
      community: "",
      lot_number: "",
      job_type: "Decorative Pool Deck",
      job_address: "302 Old Mill Rd, Macon, GA",
      scheduled_date: firstWorkingDate(plusDays(todayIso(), 2)),
      scheduled_time: "07:00",
      estimated_duration: 1,
      day_capacity_used: 1,
      crew_id: "crew-1",
      work_order_number: "WO-24017",
      status: "Scheduled",
      notes: "Decorative overlay with prep day before pour if cracking is found.",
      created_from: "estimate",
      phases: [],
    },
    {
      id: "job-builder-2001",
      schedule_type: "builder_slab",
      name: "Valor Lot 12",
      customer_name: "",
      sourceTicketId: "",
      builder_id: "builder-valor",
      builder_name: "Valor",
      builder_color: BUILDER_COLOR_PALETTE[0],
      community: "Pine Brook",
      lot_number: "12",
      job_type: "Builder Slab",
      job_address: "145 Pine Brook Dr, Griffin, GA",
      scheduled_date: startA,
      scheduled_time: "07:00",
      estimated_duration: 3,
      day_capacity_used: 1,
      crew_id: "crew-2",
      work_order_number: "VAL-4412",
      status: "Scheduled",
      notes: "Coordinate with superintendent on access gate code.",
      created_from: "builder",
      phases: BUILDER_PHASES.map((phase, idx) => makePhase(phase, idx === 0 ? startA : nextWorkingDate(startA, idx), phase.key === "pour_slab" ? "06:30" : "07:00", "crew-2", idx === 0 ? "Scheduled" : "Ready to Schedule")),
    },
    {
      id: "job-builder-2002",
      schedule_type: "builder_slab",
      name: "Smith Douglas Lot 41",
      customer_name: "",
      sourceTicketId: "",
      builder_id: "builder-smith-douglas",
      builder_name: "Smith Douglas",
      builder_color: BUILDER_COLOR_PALETTE[1],
      community: "Pike Landing",
      lot_number: "41",
      job_type: "Builder Slab",
      job_address: "88 Pike Landing Pkwy, Thomaston, GA",
      scheduled_date: startB,
      scheduled_time: "07:00",
      estimated_duration: 3,
      day_capacity_used: 1,
      crew_id: "crew-2",
      work_order_number: "SD-1184",
      status: "In Progress",
      notes: "Builder is waiting on plumbing inspection window confirmation.",
      created_from: "builder",
      phases: BUILDER_PHASES.map((phase, idx) => makePhase(phase, idx === 0 ? startB : nextWorkingDate(startB, idx), phase.key === "pour_slab" ? "06:30" : "07:00", "crew-2", idx === 0 ? "Completed" : idx === 1 ? "Scheduled" : "Ready to Schedule")),
    },
  ];
}

function buildResidentialEvents(job) {
  if (!job.scheduled_date) return [];
  const segments = buildCapacitySegments(job.estimated_duration || job.day_capacity_used || 1);
  let dateCursor = job.scheduled_date;
  return segments.map((capacity, idx) => {
    if (idx > 0) dateCursor = nextWorkingDate(dateCursor, 1);
    return {
      id: `${job.id}-res-${idx + 1}`,
      jobId: job.id,
      phaseId: "",
      schedule_type: "residential",
      type_label: "Residential",
      title: `${job.customer_name} - ${job.job_type}`,
      customer_name: job.customer_name,
      builder_name: "",
      job_type: job.job_type,
      address: job.job_address,
      community: "",
      lot_number: "",
      work_order_number: job.work_order_number,
      date: dateCursor,
      time: idx === 0 ? (job.scheduled_time || "07:00") : "07:00",
      crew_id: job.crew_id,
      crew_number: "",
      capacity_used: idx === 0 ? Number(job.day_capacity_used || capacity) : capacity,
      counts_toward_crew: true,
      status: job.status,
      phase_label: idx > 0 ? `Day ${idx + 1}` : "Scheduled Work",
      color: RESIDENTIAL_EVENT_COLOR,
    };
  });
}

function buildBuilderEvents(job) {
  return sortBuilderPhases(job.phases || [])
    .filter(phase => phase.scheduled_date)
    .map(phase => ({
      id: `${job.id}-${phase.id}`,
      jobId: job.id,
      phaseId: phase.id,
      schedule_type: "builder_slab",
      type_label: "Builder",
      title: `${job.builder_name} - Lot ${job.lot_number} - ${phase.phase_label}`,
      customer_name: "",
      builder_id: job.builder_id,
      builder_name: job.builder_name,
      color: job.builder_color || BUILDER_COLOR_PALETTE[0],
      job_type: "Builder Slab",
      address: job.job_address,
      community: job.community,
      lot_number: job.lot_number,
      work_order_number: job.work_order_number,
      date: phase.scheduled_date,
      time: phase.scheduled_time || "07:00",
      crew_id: phase.crew_id || "",
      capacity_used: Number(phase.day_capacity_used || 0),
      counts_toward_crew: phase.counts_toward_crew && !!phase.crew_id,
      status: phase.status,
      phase_label: phase.phase_label,
    }));
}

function buildCalendarEvents(jobs) {
  return jobs.flatMap(job => job.schedule_type === "builder_slab" ? buildBuilderEvents(job) : buildResidentialEvents(job));
}

function findCrewById(crews, id) {
  return crews.find(crew => crew.id === id);
}

function detectCrewConflicts({ candidateEvents, jobs, crews, ignoreEventIds = [] }) {
  const existingEvents = buildCalendarEvents(jobs).filter(event => !ignoreEventIds.includes(event.id) && event.counts_toward_crew);
  const conflicts = [];
  candidateEvents.filter(event => event.counts_toward_crew && event.crew_id && event.date).forEach(candidate => {
    const sameDay = existingEvents.filter(event => event.crew_id === candidate.crew_id && event.date === candidate.date);
    const crew = findCrewById(crews, candidate.crew_id);
    const load = sameDay.reduce((sum, event) => sum + Number(event.capacity_used || 0), 0) + Number(candidate.capacity_used || 0);
    const limit = Number(crew?.dailyCapacity || 1);
    if (load > limit + 0.0001 && sameDay.length) {
      conflicts.push({
        crew,
        candidate,
        capacityTotal: load,
        capacityLimit: limit,
        conflictingEvents: sameDay,
      });
    }
  });
  return conflicts;
}

function makeResidentialJobFromDraft(draft) {
  return {
    id: `job-res-${Math.random().toString(36).slice(2, 7)}`,
    schedule_type: "residential",
    name: draft.customer_name,
    customer_name: draft.customer_name,
    sourceTicketId: draft.estimateTicketId,
    builder_id: "",
    builder_name: "",
    community: "",
    lot_number: "",
    job_type: draft.job_type,
    job_address: draft.job_address,
    scheduled_date: draft.scheduled_date,
    scheduled_time: draft.scheduled_time,
    estimated_duration: Number(draft.estimated_duration || 1),
    day_capacity_used: Number(draft.day_capacity_used || 1),
    crew_id: draft.crew_id,
    work_order_number: draft.work_order_number,
    status: draft.status,
    notes: draft.notes,
    created_from: "estimate",
    conflict_override_reason: draft.conflict_override_reason || "",
    phases: [],
  };
}

function buildBuilderJobFromDraft(draft, builders) {
  const builder = builders.find(item => item.id === draft.builder_id);
  return {
    id: `job-builder-${Math.random().toString(36).slice(2, 7)}`,
    schedule_type: "builder_slab",
    name: `${builder?.name || "Builder"} Lot ${draft.lot_number}`,
    customer_name: "",
    sourceTicketId: "",
    builder_id: draft.builder_id,
    builder_name: builder?.name || "",
    builder_color: builder?.color || BUILDER_COLOR_PALETTE[0],
    community: draft.community,
    lot_number: draft.lot_number,
    job_type: "Builder Slab",
    job_address: draft.job_address,
    scheduled_date: "",
    scheduled_time: "",
    estimated_duration: 3,
    day_capacity_used: 1,
    crew_id: draft.crew_id,
    work_order_number: draft.work_order_number,
    status: "Estimate Accepted",
    notes: draft.notes,
    created_from: "builder",
    phases: BUILDER_PHASES.map(phase => makePhase(phase, "", "", draft.crew_id, "Ready to Schedule")),
  };
}

function AdminHeader({ section, setSection, onLogout, setPage, alerts }) {
  return (
    <div style={{ background: B.dark }}>
      <div style={{ maxWidth: 1220, margin: "0 auto", padding: "0 16px" }}>
        <div style={{ height: 62, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Logo sm />
            <div style={{ width: 1, height: 22, background: "rgba(255,255,255,.15)" }} />
            <span style={{ fontSize: ".8rem", color: "rgba(255,255,255,.68)", fontWeight: 700 }}>Operations Dashboard</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {alerts > 0 && <span style={{ fontSize: ".74rem", color: B.tan, fontWeight: 700 }}>{alerts} jobs need attention</span>}
            <button onClick={() => setPage("home")} style={{ background: "none", border: "1px solid rgba(255,255,255,.2)", color: "rgba(255,255,255,.7)", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: ".76rem", fontFamily: "inherit" }}>
              <i className="ti ti-world" style={{ marginRight: 5, fontSize: 12 }} aria-hidden="true" />View Site
            </button>
            <button onClick={onLogout} style={{ background: "none", border: "1px solid rgba(255,255,255,.2)", color: "rgba(255,255,255,.7)", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: ".76rem", fontFamily: "inherit" }}>
              <i className="ti ti-logout" style={{ marginRight: 5, fontSize: 12 }} aria-hidden="true" />Sign Out
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 0 14px" }}>
          {ADMIN_SECTIONS.map(item => (
            <button key={item.id} onClick={() => setSection(item.id)} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,.1)", background: section === item.id ? "rgba(255,255,255,.14)" : "rgba(255,255,255,.04)", color: section === item.id ? B.white : "rgba(255,255,255,.65)", cursor: "pointer", fontSize: ".78rem", fontWeight: 700, fontFamily: "inherit", whiteSpace: "nowrap" }}>
              <i className={`ti ${item.icon}`} style={{ marginRight: 6, fontSize: 13 }} aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryCards({ tickets, jobs, events, conflicts }) {
  const readyTickets = tickets.filter(ticket => ["Estimate Accepted", "Ready to Schedule"].includes(ticket.status)).length;
  const today = todayIso();
  const todayEvents = events.filter(event => event.date === today).length;
  const delayed = jobs.filter(job => job.status === "Delayed").length;
  const cards = [
    { label: "New requests", value: tickets.filter(ticket => ticket.status === "New Request").length, icon: "ti-bell", color: "#1A5276" },
    { label: "Ready to schedule", value: readyTickets, icon: "ti-calendar-plus", color: "#7D6608" },
    { label: "Work on calendar today", value: todayEvents, icon: "ti-calendar-event", color: "#1A5632" },
    { label: "Crew conflicts", value: conflicts.length, icon: "ti-alert-triangle", color: "#922B21" },
    { label: "Delayed jobs", value: delayed, icon: "ti-clock-exclamation", color: "#6C3483" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 18 }}>
      {cards.map(card => (
        <Card key={card.label} style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <i className={`ti ${card.icon}`} style={{ fontSize: 16, color: card.color }} aria-hidden="true" />
            <span style={{ fontSize: ".72rem", color: B.gray, textTransform: "uppercase", letterSpacing: .5 }}>{card.label}</span>
          </div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, color: card.color }}>{card.value}</div>
        </Card>
      ))}
    </div>
  );
}

function EstimateTicketsSection({ tickets, onSelectTicket, onAcceptTicket, onScheduleTicket, jobs }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortBy, setSortBy] = useState("date");
  const scheduledTicketIds = new Set(jobs.filter(job => job.sourceTicketId).map(job => job.sourceTicketId));
  const filtered = useMemo(() => {
    let list = tickets;
    if (statusFilter !== "All") list = list.filter(item => item.status === statusFilter);
    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter(item => item.name.toLowerCase().includes(term) || item.city.toLowerCase().includes(term) || item.ptype.toLowerCase().includes(term) || item.id.toLowerCase().includes(term));
    }
    if (sortBy === "date") list = [...list].sort((a, b) => new Date(b.at) - new Date(a.at));
    if (sortBy === "amount") list = [...list].sort((a, b) => (b.rHigh || 0) - (a.rHigh || 0));
    if (sortBy === "followup") list = [...list].sort((a, b) => (a.followUp || "").localeCompare(b.followUp || ""));
    return list;
  }, [tickets, statusFilter, search, sortBy]);

  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>Estimate Tickets</h1>
            <p style={{ fontSize: ".8rem", color: B.gray }}>Keep the current estimate queue moving, accept estimates, and convert approved work into scheduled jobs.</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...INP, width: "auto", cursor: "pointer" }}>
              <option value="All">All statuses</option>
              {ESTIMATE_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ ...INP, width: "auto", cursor: "pointer" }}>
              <option value="date">Newest first</option>
              <option value="amount">Largest estimate</option>
              <option value="followup">Follow-up date</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: 12, position: "relative" }}>
          <i className="ti ti-search" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 15, color: B.lgray }} aria-hidden="true" />
          <input style={{ ...INP, paddingLeft: 32 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by ticket, name, city, or project type..." />
        </div>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(ticket => {
          const isScheduled = scheduledTicketIds.has(ticket.id);
          return (
            <Card key={ticket.id} style={{ padding: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, alignItems: "center" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 700, color: B.dark, fontSize: ".94rem" }}>{ticket.name}</div>
                      <span style={{ fontSize: ".72rem", color: B.gray }}>{ticket.id}</span>
                    </div>
                    <div style={{ fontSize: ".76rem", color: B.gray, marginTop: 3 }}>
                      <i className="ti ti-map-pin" style={{ marginRight: 4, fontSize: 12 }} aria-hidden="true" />{ticket.city}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: ".78rem", color: B.mid, fontWeight: 700 }}>{ticket.ptype}</div>
                    <div style={{ fontSize: ".72rem", color: B.gray }}>{ticket.sqft > 0 ? `${ticket.sqft.toLocaleString()} sqft` : "Field measure required"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 3 }}>Estimate</div>
                    <div style={{ fontSize: ".86rem", fontWeight: 700, color: B.dark }}>{fmtMoney(ticket.quote) !== "-" ? fmtMoney(ticket.quote) : `${fmtMoney(ticket.rLow)} - ${fmtMoney(ticket.rHigh)}`}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 3 }}>Follow-up</div>
                    <div style={{ fontSize: ".8rem", color: ticket.followUp ? B.bronze : B.gray }}>{ticket.followUp ? fmtDate(ticket.followUp) : "Not set"}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <Pill status={ticket.status} />
                  {!["Estimate Accepted", "Ready to Schedule", "Scheduled", "Won", "Lost"].includes(ticket.status) && (
                    <Btn sm v="green" onClick={() => onAcceptTicket(ticket)}>
                      <i className="ti ti-check" style={{ marginRight: 5, fontSize: 12 }} aria-hidden="true" />Accept Estimate
                    </Btn>
                  )}
                  {["Estimate Accepted", "Ready to Schedule"].includes(ticket.status) && !isScheduled && (
                    <Btn sm v="dark" onClick={() => onScheduleTicket(ticket)}>
                      <i className="ti ti-calendar-event" style={{ marginRight: 5, fontSize: 12 }} aria-hidden="true" />Schedule Job
                    </Btn>
                  )}
                  {isScheduled && <span style={{ fontSize: ".72rem", color: B.green, fontWeight: 700 }}>Job created</span>}
                  <Btn sm v="outline" onClick={() => onSelectTicket(ticket)}>
                    Open
                  </Btn>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

function TicketDetailView({ ticket, onBack, onUpdateTicket, onOpenSchedule, sourceJob }) {
  const [t, setT] = useState({ ...ticket });
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  const save = () => {
    onUpdateTicket(t);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onBack();
    }, 350);
  };

  const changeStatus = status => {
    const entry = { s: status, d: new Date().toISOString(), n: "Status updated in admin dashboard" };
    setT(prev => ({ ...prev, status, history: [...(prev.history || []), entry] }));
  };

  const addNote = () => {
    if (!note.trim()) return;
    const stamped = `${new Date().toLocaleDateString()}: ${note}`;
    setT(prev => ({ ...prev, adminNotes: prev.adminNotes ? `${prev.adminNotes}\n\n${stamped}` : stamped }));
    setNote("");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F0F2F5" }}>
      <div style={{ background: B.dark, padding: "0 16px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,.7)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", fontSize: ".82rem" }}>
              <i className="ti ti-arrow-left" style={{ fontSize: 16 }} aria-hidden="true" />Back to tickets
            </button>
            <div style={{ width: 1, height: 20, background: "rgba(255,255,255,.15)" }} />
            <span style={{ color: "rgba(255,255,255,.5)", fontSize: ".78rem" }}>{t.id}</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {saved && <span style={{ fontSize: ".75rem", color: "#A9DFBF", fontWeight: 600 }}><i className="ti ti-check" style={{ marginRight: 4 }} aria-hidden="true" />Saved</span>}
            <Btn onClick={save} v="green" sm><i className="ti ti-device-floppy" style={{ marginRight: 5, fontSize: 13, verticalAlign: -2 }} aria-hidden="true" />Save Changes</Btn>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px 60px" }}>
        <Card style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <h1 style={{ fontSize: "1.2rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>{t.name}</h1>
              <div style={{ fontSize: ".82rem", color: B.gray }}>{t.ptype} Â· {t.city} Â· Submitted {fmtDateShort(t.at?.slice?.(0, 10) || todayIso())}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Pill status={t.status} />
              {sourceJob && <span style={{ fontSize: ".76rem", color: B.green, fontWeight: 700 }}>Linked job: {sourceJob.work_order_number || sourceJob.id}</span>}
            </div>
          </div>
        </Card>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Card>
              <h3 style={{ fontSize: ".82rem", fontWeight: 700, color: B.dark, textTransform: "uppercase", letterSpacing: .5, marginBottom: 14 }}><i className="ti ti-user" style={{ marginRight: 6, color: B.bronze }} aria-hidden="true" />Customer Info</h3>
              <div style={{ display: "grid", gap: 8 }}>
                {[["Name", t.name], ["Phone", t.phone || "-"], ["Email", t.email || "-"], ["Address", t.addr || "-"], ["City", t.city || "-"]].map(([label, value]) => (
                  <div key={label} style={{ display: "flex", gap: 10 }}>
                    <span style={{ fontSize: ".76rem", color: B.gray, minWidth: 60 }}>{label}</span>
                    <span style={{ fontSize: ".82rem", color: B.dark, fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h3 style={{ fontSize: ".82rem", fontWeight: 700, color: B.dark, textTransform: "uppercase", letterSpacing: .5, marginBottom: 14 }}><i className="ti ti-tools" style={{ marginRight: 6, color: B.bronze }} aria-hidden="true" />Project Details</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[["Project type", t.ptype], ["Dimensions", t.len && t.wid ? `${t.len} ft x ${t.wid} ft` : "N/A"], ["Square footage", t.sqft > 0 ? `~${t.sqft.toLocaleString()} sqft` : "N/A"], ["Thickness", t.thick || "-"], ["Finish", t.finish || "-"], ["Tear-out", t.tear || "-"], ["Grading", t.grade || "-"], ["Access", t.access || "-"], ["Timeline", t.timeline || "-"]].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ fontSize: ".7rem", color: B.gray, marginBottom: 1 }}>{label}</div>
                    <div style={{ fontSize: ".82rem", color: B.dark, fontWeight: 500 }}>{value}</div>
                  </div>
                ))}
              </div>
              {t.notes && <div style={{ marginTop: 14, paddingTop: 12, borderTop: "0.5px solid var(--color-border-tertiary)" }}>
                <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 4, textTransform: "uppercase", letterSpacing: .5 }}>Customer notes</div>
                <p style={{ fontSize: ".82rem", color: B.mid, lineHeight: 1.6, background: B.sandD, padding: "10px 12px", borderRadius: 6 }}>{t.notes}</p>
              </div>}
            </Card>

            {t.files && t.files.length > 0 && <Card>
              <h3 style={{ fontSize: ".82rem", fontWeight: 700, color: B.dark, textTransform: "uppercase", letterSpacing: .5, marginBottom: 12 }}><i className="ti ti-paperclip" style={{ marginRight: 6, color: B.bronze }} aria-hidden="true" />Files Uploaded ({t.files.length})</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {t.files.map((file, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: B.sandD, borderRadius: 6 }}>
                    <i className={file.endsWith(".pdf") ? "ti ti-file-text" : "ti ti-photo"} style={{ fontSize: 14, color: B.bronze }} aria-hidden="true" />
                    <span style={{ fontSize: ".78rem", color: B.mid }}>{file}</span>
                  </div>
                ))}
              </div>
            </Card>}

            <Card>
              <h3 style={{ fontSize: ".82rem", fontWeight: 700, color: B.dark, textTransform: "uppercase", letterSpacing: .5, marginBottom: 12 }}><i className="ti ti-notes" style={{ marginRight: 6, color: B.bronze }} aria-hidden="true" />Internal Notes</h3>
              {t.adminNotes && <div style={{ background: B.sandD, padding: "10px 12px", borderRadius: 6, fontSize: ".8rem", color: B.mid, lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 10 }}>{t.adminNotes}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <input style={{ ...INP, flex: 1 }} placeholder="Add a note..." value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addNote(); }} />
                <Btn onClick={addNote} sm><i className="ti ti-plus" style={{ fontSize: 13 }} aria-hidden="true" /></Btn>
              </div>
            </Card>

            <Card>
              <h3 style={{ fontSize: ".82rem", fontWeight: 700, color: B.dark, textTransform: "uppercase", letterSpacing: .5, marginBottom: 14 }}><i className="ti ti-timeline" style={{ marginRight: 6, color: B.bronze }} aria-hidden="true" />Status History</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[...(t.history || [])].reverse().map((h, idx) => (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "12px 1fr", gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: (STATUS_STYLES[h.s] || { c: B.lgray }).c, marginTop: 4 }} />
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                        <span style={{ fontSize: ".78rem", fontWeight: 700, color: B.dark }}>{h.s}</span>
                        <span style={{ fontSize: ".68rem", color: B.gray }}>{new Date(h.d).toLocaleString()}</span>
                      </div>
                      {h.n && <p style={{ fontSize: ".74rem", color: B.gray, marginTop: 2, lineHeight: 1.5 }}>{h.n}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Card>
              <h3 style={{ fontSize: ".82rem", fontWeight: 700, color: B.dark, textTransform: "uppercase", letterSpacing: .5, marginBottom: 12 }}><i className="ti ti-tag" style={{ marginRight: 6, color: B.bronze }} aria-hidden="true" />Status</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {ESTIMATE_STATUSES.map(status => (
                  <button key={status} onClick={() => changeStatus(status)} style={{ padding: "8px 12px", borderRadius: 6, border: `1.5px solid ${t.status === status ? B.green : B.border}`, background: t.status === status ? "#deeade" : B.white, color: t.status === status ? B.green : B.mid, fontWeight: t.status === status ? 700 : 500, fontSize: ".76rem", cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>{status}</span>
                    {t.status === status && <i className="ti ti-check" style={{ fontSize: 13, color: B.green }} aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </Card>

            <Card>
              <h3 style={{ fontSize: ".82rem", fontWeight: 700, color: B.dark, textTransform: "uppercase", letterSpacing: .5, marginBottom: 12 }}><i className="ti ti-coin" style={{ marginRight: 6, color: B.bronze }} aria-hidden="true" />Pricing</h3>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 2 }}>Rough estimate range</div>
                <div style={{ fontWeight: 700, color: B.dark, fontSize: "1rem" }}>{fmtMoney(t.rLow)} - {fmtMoney(t.rHigh)}</div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "block", fontSize: ".76rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>Final quote amount</label>
                <input style={INP} type="number" placeholder="e.g. 8500" value={t.quote || ""} onChange={e => setT(prev => ({ ...prev, quote: e.target.value ? parseFloat(e.target.value) : null }))} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: ".76rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>Follow-up date</label>
                <input style={INP} type="date" value={t.followUp || ""} onChange={e => setT(prev => ({ ...prev, followUp: e.target.value }))} />
              </div>
            </Card>

            <Card>
              <h3 style={{ fontSize: ".82rem", fontWeight: 700, color: B.dark, textTransform: "uppercase", letterSpacing: .5, marginBottom: 12 }}><i className="ti ti-bolt" style={{ marginRight: 6, color: B.bronze }} aria-hidden="true" />Quick Actions</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Btn full sm v="green" onClick={() => { changeStatus("Estimate Accepted"); }}>
                  <i className="ti ti-check" style={{ marginRight: 5, fontSize: 13 }} aria-hidden="true" />Accept Estimate
                </Btn>
                <Btn full sm v="dark" onClick={() => onOpenSchedule(t)}>
                  <i className="ti ti-calendar-event" style={{ marginRight: 5, fontSize: 13 }} aria-hidden="true" />Schedule Job
                </Btn>
                {sourceJob && <div style={{ fontSize: ".75rem", color: B.green, fontWeight: 700 }}>This estimate already has a scheduled job.</div>}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function CalendarSection({ jobs, crews, builders, onOpenJob, pendingResidentialDraft, onPendingResidentialDraftChange, onSavePendingResidentialSchedule, onCancelPendingResidentialSchedule, pendingBuilderSchedule, onPendingBuilderScheduleChange, onSavePendingBuilderSchedule, onCancelPendingBuilderSchedule }) {
  const [view, setView] = useState("month");
  const [anchorDate, setAnchorDate] = useState(todayIso());
  const [filters, setFilters] = useState({ crewId: "All", builderId: "All", scheduleType: "All", jobType: "All", status: "All" });
  const events = useMemo(() => buildCalendarEvents(jobs), [jobs]);
  const schedulingLocked = !!pendingResidentialDraft || !!pendingBuilderSchedule;
  useEffect(() => {
    const activeDraft = pendingResidentialDraft || pendingBuilderSchedule;
    if (activeDraft?.scheduled_date) {
      setAnchorDate(activeDraft.scheduled_date);
      setFilters(prev => ({ ...prev, scheduleType: prev.scheduleType === "builder_slab" ? "All" : prev.scheduleType }));
    }
  }, [pendingResidentialDraft?.scheduled_date, pendingBuilderSchedule?.scheduled_date]);
  const filtered = events.filter(event => {
    if (filters.crewId !== "All" && event.crew_id !== filters.crewId) return false;
    if (filters.builderId !== "All" && event.builder_name !== filters.builderId) return false;
    if (filters.scheduleType !== "All" && event.schedule_type !== filters.scheduleType) return false;
    if (filters.jobType !== "All" && event.job_type !== filters.jobType) return false;
    if (filters.status !== "All" && event.status !== filters.status) return false;
    return true;
  });

  const monthStart = new Date(`${anchorDate}T12:00:00`);
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());
  const monthDays = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    monthDays.push({ iso, inMonth: d.getMonth() === month, events: filtered.filter(event => event.date === iso) });
  }
  const weekDays = [];
  const selected = clampDateValue(anchorDate);
  const weekStart = new Date(selected);
  weekStart.setDate(selected.getDate() - selected.getDay());
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    weekDays.push({ iso, events: filtered.filter(event => event.date === iso) });
  }
  const dayEvents = filtered.filter(event => event.date === anchorDate);

  const shiftView = dir => {
    if (view === "month") setAnchorDate(new Date(year, month + dir, 1).toISOString().slice(0, 10));
    else setAnchorDate(plusDays(anchorDate, view === "week" ? dir * 7 : dir));
  };
  const pickScheduleDate = iso => {
    setAnchorDate(iso);
    if (pendingResidentialDraft) {
      onPendingResidentialDraftChange({ ...pendingResidentialDraft, scheduled_date: iso });
    }
    if (pendingBuilderSchedule) {
      onPendingBuilderScheduleChange({ ...pendingBuilderSchedule, scheduled_date: iso });
    }
  };

  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>Calendar Schedule</h1>
            <p style={{ fontSize: ".8rem", color: B.gray }}>View residential jobs and builder slab phases by month, week, or day with crew and builder filters.</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["month", "week", "day"].map(item => (
              <button key={item} onClick={() => setView(item)} style={{ padding: "8px 12px", borderRadius: 6, border: `1.5px solid ${view === item ? B.green : B.border}`, background: view === item ? "#deeade" : B.white, color: view === item ? B.green : B.mid, fontWeight: 700, fontSize: ".76rem", cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>
                {item}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginTop: 12 }}>
          <select value={filters.crewId} onChange={e => setFilters(prev => ({ ...prev, crewId: e.target.value }))} style={{ ...INP, cursor: "pointer" }}>
            <option value="All">All crews</option>
            {crews.map(crew => <option key={crew.id} value={crew.id}>{crew.name}</option>)}
          </select>
          <select value={filters.builderId} onChange={e => setFilters(prev => ({ ...prev, builderId: e.target.value }))} style={{ ...INP, cursor: "pointer" }}>
            <option value="All">All builders</option>
            {builders.map(builder => <option key={builder.id} value={builder.name}>{builder.name}</option>)}
          </select>
          <select value={filters.scheduleType} onChange={e => setFilters(prev => ({ ...prev, scheduleType: e.target.value }))} style={{ ...INP, cursor: "pointer" }}>
            <option value="All">Residential and builder jobs</option>
            <option value="residential">Residential jobs</option>
            <option value="builder_slab">Builder jobs</option>
          </select>
          <select value={filters.status} onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))} style={{ ...INP, cursor: "pointer" }}>
            <option value="All">All statuses</option>
            {JOB_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: schedulingLocked ? "minmax(0,1fr) 320px" : "1fr", gap: 14 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Btn sm v="outline" onClick={() => shiftView(-1)}><i className="ti ti-chevron-left" aria-hidden="true" /></Btn>
            <Btn sm v="outline" onClick={() => setAnchorDate(todayIso())}>Today</Btn>
            <Btn sm v="outline" onClick={() => shiftView(1)}><i className="ti ti-chevron-right" aria-hidden="true" /></Btn>
          </div>
          <div style={{ fontSize: ".92rem", fontWeight: 700, color: B.dark }}>
            {view === "month" && new Date(`${anchorDate}T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            {view === "week" && `Week of ${fmtDate(anchorDate)}`}
            {view === "day" && fmtDate(anchorDate)}
          </div>
        </div>

        {view === "month" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 8 }}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <div key={day} style={{ fontSize: ".72rem", color: B.gray, fontWeight: 700, textTransform: "uppercase", padding: "0 4px 4px" }}>{day}</div>)}
            {monthDays.map(day => (
              <div key={day.iso} onClick={() => pickScheduleDate(day.iso)} style={{ minHeight: 124, border: `1px solid ${(pendingResidentialDraft?.scheduled_date === day.iso || pendingBuilderSchedule?.scheduled_date === day.iso) ? B.bronze : anchorDate === day.iso ? B.green : B.border}`, borderRadius: 8, padding: 8, background: day.inMonth ? B.white : "#FAFAF8", cursor: "pointer", boxShadow: (pendingResidentialDraft?.scheduled_date === day.iso || pendingBuilderSchedule?.scheduled_date === day.iso) ? `inset 0 0 0 1px ${B.bronze}` : "none" }}>
                <div style={{ fontSize: ".74rem", fontWeight: 700, color: isWeekend(day.iso) ? "#922B21" : B.dark, marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                  <span>{new Date(`${day.iso}T12:00:00`).getDate()}</span>
                  <span style={{ color: (pendingResidentialDraft?.scheduled_date === day.iso || pendingBuilderSchedule?.scheduled_date === day.iso) ? B.bronze : B.gray }}>{day.events.length > 0 ? day.events.length : (pendingResidentialDraft?.scheduled_date === day.iso || pendingBuilderSchedule?.scheduled_date === day.iso) ? "Pick" : ""}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {day.events.slice(0, 3).map(event => (
                    <button key={event.id} onClick={e => { e.stopPropagation(); if (!schedulingLocked) onOpenJob(event.jobId); }} style={{ background: eventColor(event), color: B.white, border: "none", borderRadius: 6, fontSize: ".66rem", padding: "4px 6px", textAlign: "left", cursor: schedulingLocked ? "default" : "pointer" }}>
                      <div style={{ fontWeight: 700 }}>{event.customer_name || `${event.builder_name} Lot ${event.lot_number}`}</div>
                      <div style={{ opacity: .85 }}>{event.time} Â· Crew {findCrewById(crews, event.crew_id)?.number || "-"}</div>
                    </button>
                  ))}
                  {day.events.length > 3 && <div style={{ fontSize: ".66rem", color: B.gray }}>+{day.events.length - 3} more</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {view === "week" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 10 }}>
            {weekDays.map(day => (
              <div key={day.iso} onClick={() => pickScheduleDate(day.iso)} style={{ border: `1px solid ${(pendingResidentialDraft?.scheduled_date === day.iso || pendingBuilderSchedule?.scheduled_date === day.iso) ? B.bronze : anchorDate === day.iso ? B.green : B.border}`, borderRadius: 8, padding: 10, minHeight: 260, cursor: "pointer" }}>
                <div style={{ fontSize: ".76rem", fontWeight: 700, color: isWeekend(day.iso) ? "#922B21" : B.dark, marginBottom: 8 }}>{fmtDateShort(day.iso)}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {day.events.length === 0 && <div style={{ fontSize: ".72rem", color: B.gray }}>No scheduled work.</div>}
                  {day.events.map(event => (
                    <button key={event.id} onClick={e => { e.stopPropagation(); if (!schedulingLocked) onOpenJob(event.jobId); }} style={{ background: `${eventColor(event)}14`, color: B.dark, border: `1px solid ${eventColor(event)}30`, borderRadius: 6, padding: "8px 9px", textAlign: "left", cursor: schedulingLocked ? "default" : "pointer" }}>
                      <div style={{ fontSize: ".72rem", fontWeight: 700 }}>{event.customer_name || `${event.builder_name} Lot ${event.lot_number}`}</div>
                      <div style={{ fontSize: ".7rem", color: B.gray }}>{event.phase_label}</div>
                      <div style={{ fontSize: ".68rem", color: B.gray }}>{event.time} · Crew {findCrewById(crews, event.crew_id)?.number || "-"}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {view === "day" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {schedulingLocked && <button onClick={() => pickScheduleDate(anchorDate)} style={{ alignSelf: "flex-start", background: `${B.bronze}12`, border: `1px solid ${B.bronze}40`, color: B.bronze, borderRadius: 6, padding: "8px 12px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: ".76rem" }}>Use {fmtDate(anchorDate)} for this job</button>}
            {dayEvents.length === 0 && <div style={{ fontSize: ".82rem", color: B.gray }}>No work scheduled for {fmtDate(anchorDate)}.</div>}
            {dayEvents.map(event => (
              <Card key={event.id} style={{ padding: 14, background: `${eventColor(event)}10`, borderColor: `${eventColor(event)}35` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: ".86rem", fontWeight: 700, color: B.dark }}>{event.customer_name || `${event.builder_name} Lot ${event.lot_number}`}</div>
                    <div style={{ fontSize: ".76rem", color: B.gray }}>{event.schedule_type === "builder_slab" ? `${event.phase_label} · ${event.community}` : `${event.job_type} · ${event.address}`}</div>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: ".74rem", color: B.gray }}>{event.time} · Crew {findCrewById(crews, event.crew_id)?.number || "-"} · {fmtCap(event.capacity_used)}</span>
                    <Pill status={event.status} />
                    {!schedulingLocked && <Btn sm v="outline" onClick={() => onOpenJob(event.jobId)}>Open job</Btn>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
      {pendingResidentialDraft && (
        <Card style={{ alignSelf: "start", position: "sticky", top: 18 }}>
          <div style={{ fontSize: ".82rem", fontWeight: 700, color: B.dark, textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>Schedule Residential Job</div>
          <div style={{ fontSize: ".88rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>{pendingResidentialDraft.customer_name}</div>
          <div style={{ fontSize: ".76rem", color: B.gray, marginBottom: 12 }}>{pendingResidentialDraft.job_type}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label style={labelStyle}>Scheduled date</label>
              <input style={INP} type="date" value={pendingResidentialDraft.scheduled_date} onChange={e => onPendingResidentialDraftChange({ ...pendingResidentialDraft, scheduled_date: e.target.value })} />
              <div style={{ fontSize: ".7rem", color: B.gray, marginTop: 4 }}>Click a date in the calendar to schedule from the live view.</div>
            </div>
            <div>
              <label style={labelStyle}>Start time</label>
              <input style={INP} type="time" value={pendingResidentialDraft.scheduled_time} onChange={e => onPendingResidentialDraftChange({ ...pendingResidentialDraft, scheduled_time: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Crew</label>
              <select style={{ ...INP, cursor: "pointer" }} value={pendingResidentialDraft.crew_id} onChange={e => onPendingResidentialDraftChange({ ...pendingResidentialDraft, crew_id: e.target.value })}>
                {crews.map(crew => <option key={crew.id} value={crew.id}>{crew.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Estimated duration (days)</label>
              <input style={INP} type="number" step="0.25" value={pendingResidentialDraft.estimated_duration} onChange={e => onPendingResidentialDraftChange({ ...pendingResidentialDraft, estimated_duration: Number(e.target.value || 0.25) })} />
            </div>
            <div>
              <label style={labelStyle}>Day capacity used</label>
              <input style={INP} type="number" step="0.25" value={pendingResidentialDraft.day_capacity_used} onChange={e => onPendingResidentialDraftChange({ ...pendingResidentialDraft, day_capacity_used: Number(e.target.value || 0.25) })} />
            </div>
            <div>
              <label style={labelStyle}>Work order number</label>
              <input style={INP} value={pendingResidentialDraft.work_order_number} onChange={e => onPendingResidentialDraftChange({ ...pendingResidentialDraft, work_order_number: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select style={{ ...INP, cursor: "pointer" }} value={pendingResidentialDraft.status} onChange={e => onPendingResidentialDraftChange({ ...pendingResidentialDraft, status: e.target.value })}>
                {JOB_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea style={{ ...INP, minHeight: 90 }} value={pendingResidentialDraft.notes} onChange={e => onPendingResidentialDraftChange({ ...pendingResidentialDraft, notes: e.target.value })} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn v="outline" onClick={onCancelPendingResidentialSchedule}>Cancel</Btn>
              <Btn v="green" onClick={() => onSavePendingResidentialSchedule(pendingResidentialDraft)}>Save Scheduled Job</Btn>
            </div>
          </div>
        </Card>
      )}
      {pendingBuilderSchedule && (
        <Card style={{ alignSelf: "start", position: "sticky", top: 18 }}>
          <div style={{ fontSize: ".82rem", fontWeight: 700, color: B.dark, textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>Schedule Builder Job</div>
          <div style={{ fontSize: ".88rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>{pendingBuilderSchedule.builder_name}</div>
          <div style={{ fontSize: ".76rem", color: B.gray, marginBottom: 12 }}>{pendingBuilderSchedule.community} · Lot {pendingBuilderSchedule.lot_number}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label style={labelStyle}>Start date</label>
              <input style={INP} type="date" value={pendingBuilderSchedule.scheduled_date} onChange={e => onPendingBuilderScheduleChange({ ...pendingBuilderSchedule, scheduled_date: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Start time</label>
              <input style={INP} type="time" value={pendingBuilderSchedule.scheduled_time} onChange={e => onPendingBuilderScheduleChange({ ...pendingBuilderSchedule, scheduled_time: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Crew</label>
              <select style={{ ...INP, cursor: "pointer" }} value={pendingBuilderSchedule.crew_id} onChange={e => onPendingBuilderScheduleChange({ ...pendingBuilderSchedule, crew_id: e.target.value })}>
                {crews.map(crew => <option key={crew.id} value={crew.id}>{crew.name}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn v="outline" onClick={onCancelPendingBuilderSchedule}>Cancel</Btn>
              <Btn v="green" onClick={() => onSavePendingBuilderSchedule(pendingBuilderSchedule)}>Save Builder Schedule</Btn>
            </div>
          </div>
        </Card>
      )}
      </div>
    </>
  );
}

function JobsSection({ jobs, onSelectJob, onCreateBuilderJob }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const filtered = jobs.filter(job => {
    if (typeFilter !== "All" && job.schedule_type !== typeFilter) return false;
    if (statusFilter !== "All" && job.status !== statusFilter) return false;
    if (search.trim()) {
      const term = search.toLowerCase();
      return [job.customer_name, job.builder_name, job.community, job.lot_number, job.job_address, job.work_order_number].join(" ").toLowerCase().includes(term);
    }
    return true;
  });

  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>Jobs</h1>
            <p style={{ fontSize: ".8rem", color: B.gray }}>Track accepted residential work and builder slab production jobs from scheduling through completion.</p>
          </div>
          <Btn v="green" onClick={onCreateBuilderJob}><i className="ti ti-plus" style={{ marginRight: 6 }} aria-hidden="true" />New Builder Job</Btn>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10, marginTop: 12 }}>
          <input style={INP} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search jobs, communities, work orders..." />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ ...INP, cursor: "pointer" }}>
            <option value="All">All job types</option>
            <option value="residential">Residential</option>
            <option value="builder_slab">Builder slab</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...INP, cursor: "pointer" }}>
            <option value="All">All statuses</option>
            {JOB_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(job => (
          <Card key={job.id} style={{ padding: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, alignItems: "center" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: ".92rem", color: B.dark }}>{job.schedule_type === "residential" ? job.customer_name : `${job.builder_name} Â· Lot ${job.lot_number}`}</div>
                  <div style={{ fontSize: ".74rem", color: B.gray }}>{job.schedule_type === "residential" ? job.job_address : `${job.community} Â· ${job.job_address}`}</div>
                </div>
                <div>
                  <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 2 }}>Job type</div>
                  <div style={{ fontSize: ".82rem", fontWeight: 700, color: B.mid }}>{job.schedule_type === "residential" ? job.job_type : "Builder Slab Workflow"}</div>
                </div>
                <div>
                  <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 2 }}>Next scheduled work</div>
                  <div style={{ fontSize: ".82rem", color: B.dark }}>
                    {job.schedule_type === "residential"
                      ? `${fmtDate(job.scheduled_date)} Â· ${job.scheduled_time || "-"}`
                      : (() => {
                        const nextPhase = sortBuilderPhases(job.phases || []).find(phase => !["Completed", "Cancelled"].includes(phase.status));
                        return nextPhase ? `${nextPhase.phase_label} Â· ${fmtDate(nextPhase.scheduled_date)}${nextPhase.scheduled_time ? ` Â· ${nextPhase.scheduled_time}` : ""}` : "All phases complete";
                      })()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 2 }}>Work order</div>
                  <div style={{ fontSize: ".82rem", color: B.dark }}>{job.work_order_number || "-"}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <Pill status={job.status} />
                <Btn sm v="outline" onClick={() => onSelectJob(job.id)}>Open job</Btn>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function CrewsSection({ crews, jobs, onUpdateCrew }) {
  const events = useMemo(() => buildCalendarEvents(jobs), [jobs]);
  const crewSummaries = crews.map(crew => {
    const todaysEvents = events.filter(event => event.crew_id === crew.id && event.date === todayIso() && event.counts_toward_crew);
    const todayLoad = todaysEvents.reduce((sum, event) => sum + Number(event.capacity_used || 0), 0);
    const upcoming = events.filter(event => event.crew_id === crew.id && event.date >= todayIso()).slice(0, 4);
    return { crew, todayLoad, upcoming };
  });
  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>Crews</h1>
        <p style={{ fontSize: ".8rem", color: B.gray }}>Set daily capacity, review active workload, and catch crew assignments that are overbooked.</p>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
        {crewSummaries.map(({ crew, todayLoad, upcoming }) => (
          <Card key={crew.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, color: B.dark, fontSize: ".95rem" }}>{crew.name}</div>
                <div style={{ fontSize: ".74rem", color: B.gray }}>Foreman: {crew.foreman}</div>
              </div>
              <Pill status={todayLoad > crew.dailyCapacity ? "Delayed" : "Scheduled"} label={`${todayLoad.toFixed(2)} / ${crew.dailyCapacity.toFixed(2)} day`} />
            </div>
            <div style={{ fontSize: ".76rem", color: B.gray, lineHeight: 1.6, marginBottom: 10 }}>{crew.notes}</div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: "block", fontSize: ".72rem", color: B.gray, marginBottom: 4 }}>Daily capacity</label>
              <input style={INP} type="number" step="0.25" value={crew.dailyCapacity} onChange={e => onUpdateCrew(crew.id, { dailyCapacity: Number(e.target.value || 1) })} />
            </div>
            <div style={{ fontSize: ".74rem", color: B.gray, fontWeight: 700, marginBottom: 6 }}>Upcoming assignments</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {upcoming.length === 0 && <div style={{ fontSize: ".74rem", color: B.gray }}>No upcoming scheduled work.</div>}
              {upcoming.map(event => (
                <div key={event.id} style={{ padding: "8px 10px", borderRadius: 6, background: B.sand, fontSize: ".74rem", color: B.mid }}>
                  <div style={{ fontWeight: 700 }}>{event.phase_label}</div>
                  <div>{fmtDate(event.date)} Â· {event.time}</div>
                  <div>{event.schedule_type === "builder_slab" ? `${event.builder_name} Â· Lot ${event.lot_number}` : event.customer_name}</div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function BuildersSection({ builders, jobs, onCreateBuilderJob, onCreateBuilder, onOpenJob }) {
  const builderSummaries = builders.map(builder => {
    const builderJobs = jobs.filter(job => job.builder_id === builder.id);
    const openJobs = builderJobs.filter(job => !["Completed", "Cancelled"].includes(job.status)).length;
    const nextPour = builderJobs.flatMap(job => sortBuilderPhases(job.phases || [])).find(phase => phase.phase_key === "pour_slab" && phase.scheduled_date);
    return { builder, builderJobs, openJobs, nextPour };
  });
  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>Builders</h1>
            <p style={{ fontSize: ".8rem", color: B.gray }}>Manage production builder relationships, active communities, and slab workflow volume.</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn v="outline" onClick={onCreateBuilder}><i className="ti ti-building-plus" style={{ marginRight: 6 }} aria-hidden="true" />Add Builder</Btn>
            <Btn v="green" onClick={onCreateBuilderJob}><i className="ti ti-plus" style={{ marginRight: 6 }} aria-hidden="true" />New Builder Job</Btn>
          </div>
        </div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12 }}>
        {builderSummaries.map(({ builder, builderJobs, openJobs, nextPour }) => (
          <Card key={builder.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 700, color: B.dark, fontSize: ".95rem" }}>{builder.name}</div>
                <div style={{ fontSize: ".74rem", color: B.gray }}>{builder.contact} Â· {builder.phone}</div>
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 20, background: `${builder.color}14`, color: builder.color, fontWeight: 700, fontSize: ".68rem", whiteSpace: "nowrap" }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: builder.color, display: "inline-block" }} />
                {openJobs} active
              </span>
            </div>
            <div style={{ fontSize: ".76rem", color: B.gray, marginBottom: 10 }}>Communities: {builder.communities.length ? builder.communities.join(", ") : "None entered yet"}</div>
            <div style={{ fontSize: ".74rem", color: B.gray, fontWeight: 700, marginBottom: 6 }}>Current jobs</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
              {builderJobs.length === 0 && <div style={{ fontSize: ".74rem", color: B.gray }}>No jobs yet.</div>}
              {builderJobs.map(job => (
                <button key={job.id} onClick={() => onOpenJob(job.id)} style={{ textAlign: "left", background: B.sand, border: "1px solid var(--color-border-tertiary)", borderRadius: 6, padding: "8px 10px", cursor: "pointer", fontFamily: "inherit" }}>
                  <div style={{ fontSize: ".76rem", fontWeight: 700, color: B.dark }}>{job.community} Â· Lot {job.lot_number}</div>
                  <div style={{ fontSize: ".72rem", color: B.gray }}>{job.work_order_number || "No work order"} Â· {job.status}</div>
                </button>
              ))}
            </div>
            <div style={{ fontSize: ".74rem", color: B.gray }}>{nextPour ? `Next pour on ${fmtDate(nextPour.scheduled_date)}` : "No pour scheduled yet."}</div>
          </Card>
        ))}
      </div>
    </>
  );
}

function BuilderRecordModal({ draft, onClose, onSave }) {
  const [local, setLocal] = useState(draft);
  return (
    <Modal title="Add Builder" onClose={onClose} width={640}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label style={labelStyle}>Builder name</label><input style={INP} value={local.name} onChange={e => setLocal(prev => ({ ...prev, name: e.target.value }))} /></div>
        <div><label style={labelStyle}>Primary contact</label><input style={INP} value={local.contact} onChange={e => setLocal(prev => ({ ...prev, contact: e.target.value }))} /></div>
        <div><label style={labelStyle}>Phone</label><input style={INP} value={local.phone} onChange={e => setLocal(prev => ({ ...prev, phone: e.target.value }))} /></div>
        <div style={{ gridColumn: "1 / -1" }}><label style={labelStyle}>Communities</label><input style={INP} value={local.communities} onChange={e => setLocal(prev => ({ ...prev, communities: e.target.value }))} placeholder="Pine Brook, Oak Trace" /></div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: ".76rem", color: B.gray }}>Enter communities as a comma-separated list.</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn v="outline" onClick={onClose}>Cancel</Btn>
          <Btn v="green" onClick={() => onSave(local)} disabled={!local.name.trim()}>Save Builder</Btn>
        </div>
      </div>
    </Modal>
  );
}

function SettingsSection({ settings, onUpdateSettings, historyCounts }) {
  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>Settings</h1>
        <p style={{ fontSize: ".8rem", color: B.gray }}>Scheduling rules, crew defaults, and schema planning for the dashboard backend.</p>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr .8fr", gap: 14 }}>
        <Card>
          <div style={{ fontSize: ".82rem", fontWeight: 700, color: B.dark, textTransform: "uppercase", letterSpacing: .5, marginBottom: 12 }}>Scheduling Rules</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, fontSize: ".82rem", color: B.mid }}>
              <span>Do not schedule weekends by default</span>
              <input type="checkbox" checked={settings.skipWeekendsByDefault} onChange={e => onUpdateSettings({ skipWeekendsByDefault: e.target.checked })} />
            </label>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, fontSize: ".82rem", color: B.mid }}>
              <span>Allow weekend override with confirmation</span>
              <input type="checkbox" checked={settings.allowWeekendOverride} onChange={e => onUpdateSettings({ allowWeekendOverride: e.target.checked })} />
            </label>
            <div>
              <label style={{ display: "block", fontSize: ".76rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>Default crew daily capacity</label>
              <input style={{ ...INP, maxWidth: 180 }} type="number" step="0.25" value={settings.defaultCrewCapacity} onChange={e => onUpdateSettings({ defaultCrewCapacity: Number(e.target.value || 1) })} />
            </div>
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: ".82rem", fontWeight: 700, color: B.dark, textTransform: "uppercase", letterSpacing: .5, marginBottom: 12 }}>Audit History</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: ".8rem", color: B.mid }}>
            <div>Schedule changes recorded: <strong>{historyCounts.scheduleChanges}</strong></div>
            <div>Conflict overrides recorded: <strong>{historyCounts.overrides}</strong></div>
            <div>Schema tables planned: <strong>{SCHEMA_TABLES.length}</strong></div>
          </div>
        </Card>
      </div>
      <Card style={{ marginTop: 14 }}>
        <div style={{ fontSize: ".82rem", fontWeight: 700, color: B.dark, textTransform: "uppercase", letterSpacing: .5, marginBottom: 12 }}>Schema Planning</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
          {SCHEMA_TABLES.map(table => (
            <div key={table} style={{ padding: "10px 12px", borderRadius: 6, background: B.sand, fontSize: ".78rem", color: B.mid, fontWeight: 700 }}>
              <i className="ti ti-database" style={{ marginRight: 6, color: B.bronze }} aria-hidden="true" />
              {table}
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function JobDetailView({ job, crews, onBack, onSaveJob, onOpenPhaseEdit }) {
  const crew = findCrewById(crews, job.crew_id);
  return (
    <div style={{ minHeight: "100vh", background: "#F0F2F5" }}>
      <div style={{ background: B.dark, padding: "0 16px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,.7)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", fontSize: ".82rem" }}>
            <i className="ti ti-arrow-left" style={{ fontSize: 16 }} aria-hidden="true" />Back to jobs
          </button>
          <Pill status={job.status} />
        </div>
      </div>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px 60px" }}>
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <h1 style={{ fontSize: "1.2rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>{job.schedule_type === "residential" ? job.customer_name : `${job.builder_name} Â· ${job.community} Â· Lot ${job.lot_number}`}</h1>
              <div style={{ fontSize: ".82rem", color: B.gray }}>{job.job_address}</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: ".78rem", color: B.gray }}>Work order {job.work_order_number || "-"}</span>
              {crew && <span style={{ fontSize: ".78rem", color: B.gray }}>Crew {crew.number}</span>}
            </div>
          </div>
        </Card>

        {job.schedule_type === "residential" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr .8fr", gap: 16 }}>
            <Card>
              <div style={{ fontSize: ".82rem", fontWeight: 700, color: B.dark, textTransform: "uppercase", letterSpacing: .5, marginBottom: 12 }}>Residential Schedule</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[["Scheduled date", fmtDate(job.scheduled_date)], ["Start time", job.scheduled_time || "-"], ["Estimated duration", fmtCap(job.estimated_duration)], ["Day capacity used", fmtCap(job.day_capacity_used)], ["Status", job.status], ["Crew", crew ? `${crew.name}` : "-"]].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ fontSize: ".7rem", color: B.gray, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: ".84rem", color: B.dark, fontWeight: 700 }}>{value}</div>
                  </div>
                ))}
              </div>
              {job.notes && <div style={{ marginTop: 14, fontSize: ".8rem", color: B.mid, lineHeight: 1.6 }}>{job.notes}</div>}
            </Card>
            <Card>
              <div style={{ fontSize: ".82rem", fontWeight: 700, color: B.dark, textTransform: "uppercase", letterSpacing: .5, marginBottom: 12 }}>Actions</div>
              <Btn full v="outline" onClick={() => onOpenPhaseEdit(job.id, null)}><i className="ti ti-calendar-time" style={{ marginRight: 6 }} aria-hidden="true" />Reschedule Job</Btn>
              <div style={{ height: 10 }} />
              <Btn full v="green" onClick={() => onSaveJob({ ...job, status: "Completed" })}><i className="ti ti-check" style={{ marginRight: 6 }} aria-hidden="true" />Mark Completed</Btn>
              <div style={{ height: 10 }} />
              <Btn full v="outline" onClick={() => onSaveJob({ ...job, status: "Delayed" })}><i className="ti ti-clock-exclamation" style={{ marginRight: 6 }} aria-hidden="true" />Mark Delayed</Btn>
            </Card>
          </div>
        ) : (
          <Card>
            <div style={{ fontSize: ".82rem", fontWeight: 700, color: B.dark, textTransform: "uppercase", letterSpacing: .5, marginBottom: 12 }}>Builder Slab Workflow</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sortBuilderPhases(job.phases || []).map((phase, idx) => (
                <div key={phase.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, alignItems: "center", padding: "12px 10px", border: "1px solid var(--color-border-tertiary)", borderRadius: 8, background: phase.counts_toward_crew ? B.white : "#FAFAF8" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: ".84rem", fontWeight: 700, color: B.dark }}>{idx + 1}. {phase.phase_label}</div>
                      <div style={{ fontSize: ".72rem", color: B.gray }}>{phase.responsible_party}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: ".7rem", color: B.gray, marginBottom: 2 }}>Scheduled</div>
                      <div style={{ fontSize: ".8rem", color: B.dark }}>{phase.scheduled_date ? `${fmtDate(phase.scheduled_date)} Â· ${phase.scheduled_time || "-"}` : "Not scheduled"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: ".7rem", color: B.gray, marginBottom: 2 }}>Crew / capacity</div>
                      <div style={{ fontSize: ".8rem", color: B.dark }}>
                        {phase.crew_id ? `Crew ${findCrewById(crews, phase.crew_id)?.number || "-"}` : "Dependency task"}
                        {phase.crew_id && ` Â· ${fmtCap(phase.day_capacity_used)}`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <Pill status={phase.status} />
                    <Btn sm v="outline" onClick={() => onOpenPhaseEdit(job.id, phase.id)}>Edit phase</Btn>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function ResidentialScheduleModal({ draft, crews, onClose, onSave }) {
  const [local, setLocal] = useState(draft);
  return (
    <Modal title="Convert to Scheduled Job" onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label style={labelStyle}>Customer name</label><input style={INP} value={local.customer_name} onChange={e => setLocal(prev => ({ ...prev, customer_name: e.target.value }))} /></div>
        <div><label style={labelStyle}>Estimate ticket ID</label><input style={INP} value={local.estimateTicketId} onChange={e => setLocal(prev => ({ ...prev, estimateTicketId: e.target.value }))} /></div>
        <div><label style={labelStyle}>Job type</label><input style={INP} value={local.job_type} onChange={e => setLocal(prev => ({ ...prev, job_type: e.target.value }))} /></div>
        <div><label style={labelStyle}>Job address</label><input style={INP} value={local.job_address} onChange={e => setLocal(prev => ({ ...prev, job_address: e.target.value }))} /></div>
        <div><label style={labelStyle}>Scheduled date</label><input style={INP} type="date" value={local.scheduled_date} onChange={e => setLocal(prev => ({ ...prev, scheduled_date: e.target.value }))} /></div>
        <div><label style={labelStyle}>Scheduled start time</label><input style={INP} type="time" value={local.scheduled_time} onChange={e => setLocal(prev => ({ ...prev, scheduled_time: e.target.value }))} /></div>
        <div><label style={labelStyle}>Estimated duration (days)</label><input style={INP} type="number" step="0.25" value={local.estimated_duration} onChange={e => setLocal(prev => ({ ...prev, estimated_duration: Number(e.target.value || 0.25) }))} /></div>
        <div><label style={labelStyle}>Day capacity used</label><input style={INP} type="number" step="0.25" value={local.day_capacity_used} onChange={e => setLocal(prev => ({ ...prev, day_capacity_used: Number(e.target.value || 0.25) }))} /></div>
        <div><label style={labelStyle}>Crew number</label>
          <select style={{ ...INP, cursor: "pointer" }} value={local.crew_id} onChange={e => setLocal(prev => ({ ...prev, crew_id: e.target.value }))}>
            {crews.map(crew => <option key={crew.id} value={crew.id}>{crew.name}</option>)}
          </select>
        </div>
        <div><label style={labelStyle}>Work order number</label><input style={INP} value={local.work_order_number} onChange={e => setLocal(prev => ({ ...prev, work_order_number: e.target.value }))} /></div>
        <div><label style={labelStyle}>Status</label>
          <select style={{ ...INP, cursor: "pointer" }} value={local.status} onChange={e => setLocal(prev => ({ ...prev, status: e.target.value }))}>
            {JOB_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: "1 / -1" }}><label style={labelStyle}>Notes</label><textarea style={{ ...INP, minHeight: 96 }} value={local.notes} onChange={e => setLocal(prev => ({ ...prev, notes: e.target.value }))} /></div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: ".76rem", color: B.gray }}>Jobs longer than one day will span multiple workdays and skip weekends.</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn v="outline" onClick={onClose}>Cancel</Btn>
          <Btn v="green" onClick={() => onSave(local)}>Save Scheduled Job</Btn>
        </div>
      </div>
    </Modal>
  );
}

function BuilderJobModal({ draft, crews, builders, onClose, onSave }) {
  const [local, setLocal] = useState(draft);
  return (
    <Modal title="New Builder Slab Job" onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label style={labelStyle}>Builder name</label><select style={{ ...INP, cursor: "pointer" }} value={local.builder_id} onChange={e => setLocal(prev => ({ ...prev, builder_id: e.target.value }))}>{builders.map(builder => <option key={builder.id} value={builder.id}>{builder.name}</option>)}</select></div>
        <div><label style={labelStyle}>Community / subdivision</label><input style={INP} value={local.community} onChange={e => setLocal(prev => ({ ...prev, community: e.target.value }))} /></div>
        <div><label style={labelStyle}>Lot number</label><input style={INP} value={local.lot_number} onChange={e => setLocal(prev => ({ ...prev, lot_number: e.target.value }))} /></div>
        <div><label style={labelStyle}>Job address</label><input style={INP} value={local.job_address} onChange={e => setLocal(prev => ({ ...prev, job_address: e.target.value }))} /></div>
        <div><label style={labelStyle}>Work order number</label><input style={INP} value={local.work_order_number} onChange={e => setLocal(prev => ({ ...prev, work_order_number: e.target.value }))} /></div>
        <div><label style={labelStyle}>Default crew</label><select style={{ ...INP, cursor: "pointer" }} value={local.crew_id} onChange={e => setLocal(prev => ({ ...prev, crew_id: e.target.value }))}>{crews.map(crew => <option key={crew.id} value={crew.id}>{crew.name}</option>)}</select></div>
        <div style={{ gridColumn: "1 / -1" }}><label style={labelStyle}>Notes</label><textarea style={{ ...INP, minHeight: 96 }} value={local.notes} onChange={e => setLocal(prev => ({ ...prev, notes: e.target.value }))} /></div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <Btn v="outline" onClick={onClose}>Cancel</Btn>
        <Btn v="green" onClick={() => onSave(local)}>Schedule Job</Btn>
      </div>
    </Modal>
  );
}

function PhaseEditModal({ draft, crews, onClose, onSave, isResidential }) {
  const [local, setLocal] = useState(draft);
  return (
    <Modal title={isResidential ? "Reschedule Residential Job" : `Edit ${draft.phase_label}`} onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label style={labelStyle}>Scheduled date</label><input style={INP} type="date" value={local.scheduled_date} onChange={e => setLocal(prev => ({ ...prev, scheduled_date: e.target.value }))} /></div>
        <div><label style={labelStyle}>Scheduled time</label><input style={INP} type="time" value={local.scheduled_time} onChange={e => setLocal(prev => ({ ...prev, scheduled_time: e.target.value }))} /></div>
        <div><label style={labelStyle}>Crew</label><select style={{ ...INP, cursor: "pointer" }} value={local.crew_id} onChange={e => setLocal(prev => ({ ...prev, crew_id: e.target.value }))}>{crews.map(crew => <option key={crew.id} value={crew.id}>{crew.name}</option>)}</select></div>
        <div><label style={labelStyle}>Status</label><select style={{ ...INP, cursor: "pointer" }} value={local.status} onChange={e => setLocal(prev => ({ ...prev, status: e.target.value }))}>{JOB_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}</select></div>
        <div><label style={labelStyle}>Day capacity used</label><input style={INP} type="number" step="0.25" value={local.day_capacity_used} onChange={e => setLocal(prev => ({ ...prev, day_capacity_used: Number(e.target.value || 0) }))} /></div>
        <div><label style={labelStyle}>Responsible party</label><input disabled style={{ ...INP, background: "#F5F5F3" }} value={local.responsible_party || "Southern Oak Concrete"} /></div>
        <div style={{ gridColumn: "1 / -1" }}><label style={labelStyle}>Notes</label><textarea style={{ ...INP, minHeight: 90 }} value={local.notes || ""} onChange={e => setLocal(prev => ({ ...prev, notes: e.target.value }))} /></div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
        {!isResidential && <div style={{ fontSize: ".76rem", color: B.gray }}>If this phase is pushed later, following phases will move forward automatically and skip weekends.</div>}
        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          <Btn v="outline" onClick={onClose}>Cancel</Btn>
          <Btn v="green" onClick={() => onSave(local)}>Save Schedule</Btn>
        </div>
      </div>
    </Modal>
  );
}

function PushSummaryModal({ preview, onClose, onConfirm }) {
  return (
    <Modal title="Confirm Builder Schedule Push" onClose={onClose} width={860}>
      <div style={{ fontSize: ".8rem", color: B.gray, marginBottom: 12 }}>Following phases will be shifted forward in order. Saturdays and Sundays are skipped automatically.</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", fontSize: ".72rem", color: B.gray }}>
              <th style={thStyle}>Phase</th>
              <th style={thStyle}>Original date</th>
              <th style={thStyle}>New date</th>
              <th style={thStyle}>Assigned crew</th>
              <th style={thStyle}>Conflict</th>
              <th style={thStyle}>Suggested action</th>
            </tr>
          </thead>
          <tbody>
            {preview.summary.map(item => (
              <tr key={item.phaseId}>
                <td style={tdStyle}>{item.phase_label}</td>
                <td style={tdStyle}>{item.original_date ? fmtDate(item.original_date) : "Not set"}</td>
                <td style={tdStyle}>{fmtDate(item.new_date)}</td>
                <td style={tdStyle}>{item.crew_label || "-"}</td>
                <td style={tdStyle}>{item.conflict ? <span style={{ color: "#922B21", fontWeight: 700 }}>Conflict</span> : <span style={{ color: B.green, fontWeight: 700 }}>Clear</span>}</td>
                <td style={tdStyle}>{item.conflict ? "Review crew load or override with note." : "Save update."}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <Btn v="outline" onClick={onClose}>Cancel</Btn>
        <Btn v="green" onClick={onConfirm}>Apply Schedule Push</Btn>
      </div>
    </Modal>
  );
}

function ConflictModal({ state, crews, onClose, onChooseAnotherDate, onApplyReassign, onApplyOverride, onCancelChange }) {
  const [selectedCrewId, setSelectedCrewId] = useState(state.defaultCrewId || crews[0]?.id || "");
  const [note, setNote] = useState("");
  const sharedCrew = state.conflicts.every(conflict => conflict.candidate.crew_id === state.conflicts[0].candidate.crew_id);
  return (
    <Modal title="Crew Conflict Warning" onClose={onClose} width={920}>
      <div style={{ fontSize: ".8rem", color: B.gray, marginBottom: 12 }}>This crew already has work scheduled on the selected date. Review the conflict before saving.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {state.conflicts.map((conflict, idx) => (
          <Card key={idx} style={{ padding: 14, background: "#FFF8F7", borderColor: "#F5C6C0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              <div style={{ fontWeight: 700, color: "#922B21" }}>Crew {conflict.crew?.number || "-"} capacity would hit {conflict.capacityTotal.toFixed(2)} / {conflict.capacityLimit.toFixed(2)} day</div>
              <div style={{ fontSize: ".76rem", color: B.gray }}>{fmtDate(conflict.candidate.date)} Â· {conflict.candidate.time}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 8 }}>
              {conflict.conflictingEvents.map(event => (
                <div key={event.id} style={{ padding: "8px 10px", borderRadius: 6, background: B.white, border: "1px solid #F2D7D5" }}>
                  <div style={{ fontSize: ".78rem", fontWeight: 700, color: B.dark }}>{event.phase_label}</div>
                  <div style={{ fontSize: ".72rem", color: B.gray }}>{event.schedule_type === "builder_slab" ? `${event.builder_name} Â· ${event.community || ""} Lot ${event.lot_number || ""}` : `${event.customer_name}`}</div>
                  <div style={{ fontSize: ".72rem", color: B.gray }}>{event.address || "-"} {event.work_order_number ? `Â· ${event.work_order_number}` : ""}</div>
                  <div style={{ fontSize: ".72rem", color: B.gray }}>{event.time} Â· {fmtCap(event.capacity_used)} Â· {event.status}</div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <Card style={{ padding: 14 }}>
          <div style={{ fontSize: ".82rem", fontWeight: 700, color: B.dark, marginBottom: 10 }}>Resolve conflict</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ fontSize: ".76rem", color: B.gray, marginBottom: 4 }}>1. Reassign crew</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <select disabled={!sharedCrew} style={{ ...INP, maxWidth: 220, cursor: "pointer", background: sharedCrew ? B.white : "#F5F5F3" }} value={selectedCrewId} onChange={e => setSelectedCrewId(e.target.value)}>
                  {crews.map(crew => <option key={crew.id} value={crew.id}>{crew.name}</option>)}
                </select>
                <Btn sm v="outline" disabled={!sharedCrew} onClick={() => onApplyReassign(selectedCrewId)}>Reassign crew</Btn>
                {!sharedCrew && <span style={{ fontSize: ".72rem", color: B.gray }}>This conflict set spans different phase crews. Use another date or override.</span>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontSize: ".76rem", color: B.gray }}>2. Choose another date</div>
              <Btn sm v="outline" onClick={onChooseAnotherDate}>Return to scheduler</Btn>
            </div>
            <div>
              <div style={{ fontSize: ".76rem", color: B.gray, marginBottom: 4 }}>3. Override conflict with required note</div>
              <textarea style={{ ...INP, minHeight: 80 }} value={note} onChange={e => setNote(e.target.value)} placeholder="Why this conflict is acceptable..." />
              <div style={{ marginTop: 8 }}>
                <Btn sm v="danger" disabled={!note.trim()} onClick={() => onApplyOverride(note)}>Override and save</Btn>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontSize: ".76rem", color: B.gray }}>4. Cancel schedule change</div>
              <Btn sm v="outline" onClick={onCancelChange}>Cancel change</Btn>
            </div>
          </div>
        </Card>
      </div>
    </Modal>
  );
}

function WeekendOverrideModal({ state, crews, onClose, onConfirm, onCancel }) {
  const [crewId, setCrewId] = useState(state.defaultCrewId || crews[0]?.id || "");
  const [chargeWeekendFee, setChargeWeekendFee] = useState(false);
  return (
    <Modal title="Weekend Schedule Override" onClose={onClose} width={640}>
      <div style={{ fontSize: ".8rem", color: B.gray, marginBottom: 14 }}>
        {state.message || "This schedule lands on a weekend. Pick the assigned crew and choose whether to apply a weekend fee before saving."}
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <label style={labelStyle}>Assigned crew</label>
          <select style={{ ...INP, cursor: "pointer" }} value={crewId} onChange={e => setCrewId(e.target.value)}>
            {crews.map(crew => <option key={crew.id} value={crew.id}>{crew.name}</option>)}
          </select>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: ".82rem", color: B.mid }}>
          <input type="checkbox" checked={chargeWeekendFee} onChange={e => setChargeWeekendFee(e.target.checked)} />
          <span>Charge weekend fee</span>
        </label>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
        <Btn v="outline" onClick={onCancel}>Cancel</Btn>
        <Btn v="green" onClick={() => onConfirm({ crew_id: crewId, charge_weekend_fee: chargeWeekendFee })}>Apply Override</Btn>
      </div>
    </Modal>
  );
}

function WarningModal({ state, onClose }) {
  return (
    <Modal title={state.title || "Warning"} onClose={onClose} width={560}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ width: 42, height: 42, borderRadius: 999, background: "#FDEBD0", color: "#9C640C", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <i className="ti ti-alert-triangle" style={{ fontSize: 20 }} aria-hidden="true" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: ".84rem", color: B.mid, lineHeight: 1.6 }}>{state.message}</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
        <Btn v="dark" onClick={onClose}>Okay</Btn>
      </div>
    </Modal>
  );
}

const labelStyle = { display: "block", fontSize: ".76rem", fontWeight: 700, color: B.dark, marginBottom: 4 };
const thStyle = { padding: "8px 10px", borderBottom: "1px solid var(--color-border-tertiary)" };
const tdStyle = { padding: "10px", borderBottom: "1px solid #F1EEE7", fontSize: ".78rem", color: B.mid };

export default function AdminWorkspace({ tickets, onUpdateTicket, onLogout, setPage }) {
  const [section, setSection] = useState("tickets");
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [jobs, setJobs] = useState(() => buildDefaultJobs().map(normalizeBuilderJob));
  const [crews, setCrews] = useState(DEFAULT_CREWS);
  const [builders, setBuilders] = useState(DEFAULT_BUILDERS);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [scheduleHistory, setScheduleHistory] = useState([]);
  const [overrideHistory, setOverrideHistory] = useState([]);
  const [residentialDraft, setResidentialDraft] = useState(null);
  const [builderScheduleDraft, setBuilderScheduleDraft] = useState(null);
  const [builderDraft, setBuilderDraft] = useState(null);
  const [builderRecordDraft, setBuilderRecordDraft] = useState(null);
  const [phaseDraft, setPhaseDraft] = useState(null);
  const [pushPreview, setPushPreview] = useState(null);
  const [conflictState, setConflictState] = useState(null);
  const [weekendOverrideState, setWeekendOverrideState] = useState(null);
  const [warningState, setWarningState] = useState(null);

  const selectedTicket = tickets.find(ticket => ticket.id === selectedTicketId) || null;
  const selectedJob = jobs.find(job => job.id === selectedJobId) || null;
  const allEvents = useMemo(() => buildCalendarEvents(jobs), [jobs]);
  const activeConflicts = useMemo(() => detectCrewConflicts({ candidateEvents: [], jobs, crews }), [jobs, crews]);

  const openBuilderJobModal = () => {
    if (!builders.length) {
      window.alert("Add a builder first before creating a builder job.");
      return;
    }
    setBuilderDraft({ builder_id: builders[0]?.id || "", community: "", lot_number: "", job_address: "", work_order_number: "", crew_id: crews[0]?.id || "", notes: "" });
  };

  const createBuilderRecord = draft => {
    const name = draft.name.trim();
    if (!name) return;
    const communities = draft.communities.split(",").map(item => item.trim()).filter(Boolean);
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `${Date.now()}`;
    let builderId = `builder-${baseSlug}`;
    if (builders.some(builder => builder.id === builderId)) builderId = `${builderId}-${Date.now().toString().slice(-4)}`;
    const color = BUILDER_COLOR_PALETTE[builders.length % BUILDER_COLOR_PALETTE.length];
    setBuilders(prev => [...prev, { id: builderId, name, contact: draft.contact.trim(), phone: draft.phone.trim(), communities, color }]);
    setBuilderRecordDraft(null);
  };
  const jobsNeedingAttention = jobs.filter(job => job.status === "Delayed" || job.status === "Ready to Schedule").length;

  const updateTicket = updated => {
    onUpdateTicket(updated);
    setSelectedTicketId(updated.id);
  };

  const applyTicketStatus = (ticket, status, note) => {
    const updated = {
      ...ticket,
      status,
      history: [...(ticket.history || []), { s: status, d: new Date().toISOString(), n: note }],
    };
    onUpdateTicket(updated);
  };

  const openResidentialSchedule = ticket => {
    setBuilderScheduleDraft(null);
    setResidentialDraft({
      return_section: "tickets",
      customer_name: ticket.name,
      estimateTicketId: ticket.id,
      job_type: ticket.ptype,
      job_address: [ticket.addr, ticket.city].filter(Boolean).join(", "),
      scheduled_date: firstWorkingDate(plusDays(todayIso(), 1)),
      scheduled_time: "07:00",
      estimated_duration: suggestResidentialDuration(ticket),
      day_capacity_used: Math.min(1, suggestResidentialDuration(ticket)),
      crew_id: crews[0]?.id || "",
      work_order_number: "",
      status: "Scheduled",
      notes: ticket.notes || "",
    });
    setSelectedTicketId(null);
    setSelectedJobId(null);
    setSection("calendar");
  };

  const openResidentialReschedule = job => {
    setBuilderScheduleDraft(null);
    setResidentialDraft({
      job_id: job.id,
      return_section: "jobs",
      customer_name: job.customer_name,
      estimateTicketId: job.sourceTicketId || "",
      job_type: job.job_type,
      job_address: job.job_address,
      scheduled_date: job.scheduled_date || firstWorkingDate(plusDays(todayIso(), 1)),
      scheduled_time: job.scheduled_time || "07:00",
      estimated_duration: job.estimated_duration || 1,
      day_capacity_used: job.day_capacity_used || 1,
      crew_id: job.crew_id || crews[0]?.id || "",
      work_order_number: job.work_order_number || "",
      status: job.status || "Scheduled",
      notes: job.notes || "",
      charge_weekend_fee: !!job.charge_weekend_fee,
    });
    setSelectedJobId(null);
    setSection("calendar");
  };

  const blockSundaySchedule = label => {
    setWarningState({
      title: "Sunday Scheduling Not Allowed",
      message: `${label} cannot be scheduled on Sunday. Please choose another date on the calendar.`,
    });
  };

  const saveResidentialSchedule = (draft, conflictOverrideReason = "") => {
    if (!draft.scheduled_date) return;
    if (isSunday(draft.scheduled_date)) {
      blockSundaySchedule("Jobs");
      return;
    }
    if (isSaturday(draft.scheduled_date) && settings.skipWeekendsByDefault && !draft.weekend_override) {
      if (!settings.allowWeekendOverride) {
        window.alert("Saturday scheduling requires an override, and weekend overrides are currently disabled.");
        return;
      }
      setWeekendOverrideState({
        defaultCrewId: draft.crew_id,
        message: `Residential work for ${draft.customer_name} is being scheduled on Saturday, ${fmtDate(draft.scheduled_date)}.`,
        onConfirm: override => {
          setWeekendOverrideState(null);
          saveResidentialSchedule({ ...draft, crew_id: override.crew_id, charge_weekend_fee: override.charge_weekend_fee, weekend_override: true }, conflictOverrideReason);
        },
        onCancel: () => setWeekendOverrideState(null),
      });
      return;
    }
    if (draft.job_id) {
      const updated = {
        ...(jobs.find(job => job.id === draft.job_id) || {}),
        customer_name: draft.customer_name,
        job_type: draft.job_type,
        job_address: draft.job_address,
        scheduled_date: draft.scheduled_date,
        scheduled_time: draft.scheduled_time,
        estimated_duration: Number(draft.estimated_duration || 1),
        day_capacity_used: Number(draft.day_capacity_used || 1),
        crew_id: draft.crew_id,
        work_order_number: draft.work_order_number,
        status: draft.status,
        notes: draft.notes,
        conflict_override_reason: conflictOverrideReason || "",
        charge_weekend_fee: !!draft.charge_weekend_fee,
      };
      const candidateEvents = buildResidentialEvents(updated);
      const conflicts = detectCrewConflicts({ candidateEvents, jobs: jobs.filter(job => job.id !== updated.id), crews });
      if (conflicts.length && !conflictOverrideReason) {
        setConflictState({
          conflicts,
          defaultCrewId: draft.crew_id,
          reopen: () => setResidentialDraft(draft),
          onReassign: newCrewId => saveResidentialSchedule({ ...draft, crew_id: newCrewId }, ""),
          onOverride: note => saveResidentialSchedule({ ...draft }, note),
          onCancel: () => setResidentialDraft(null),
        });
        setResidentialDraft(null);
        return;
      }
      setJobs(prev => prev.map(job => job.id === updated.id ? updated : job));
      setScheduleHistory(prev => [{ id: `sch-${Date.now()}`, type: "residential-reschedule", jobId: updated.id, note: `Rescheduled ${updated.customer_name} for ${updated.scheduled_date}` }, ...prev]);
      if (conflictOverrideReason) {
        setOverrideHistory(prev => [{ id: `ovr-${Date.now()}`, jobId: updated.id, note: conflictOverrideReason, createdAt: new Date().toISOString() }, ...prev]);
      }
      setResidentialDraft(null);
      setSection(draft.return_section || "jobs");
      setSelectedJobId(null);
      return;
    }
    const job = makeResidentialJobFromDraft({ ...draft, conflict_override_reason: conflictOverrideReason });
    const candidateEvents = buildResidentialEvents(job);
    const conflicts = detectCrewConflicts({ candidateEvents, jobs, crews });
    if (conflicts.length && !conflictOverrideReason) {
      setConflictState({
        conflicts,
        defaultCrewId: draft.crew_id,
        reopen: () => setResidentialDraft(draft),
        onReassign: newCrewId => saveResidentialSchedule({ ...draft, crew_id: newCrewId }, ""),
        onOverride: note => saveResidentialSchedule({ ...draft }, note),
        onCancel: () => setResidentialDraft(null),
      });
      setResidentialDraft(null);
      return;
    }

    setJobs(prev => [job, ...prev]);
    const source = tickets.find(ticket => ticket.id === draft.estimateTicketId);
    if (source) {
      applyTicketStatus({ ...source }, "Scheduled", `Converted to scheduled residential job${job.work_order_number ? ` (${job.work_order_number})` : ""}.`);
    }
    setScheduleHistory(prev => [{ id: `sch-${Date.now()}`, type: "residential", jobId: job.id, note: `Scheduled ${job.customer_name} for ${job.scheduled_date}` }, ...prev]);
    if (conflictOverrideReason) {
      setOverrideHistory(prev => [{ id: `ovr-${Date.now()}`, jobId: job.id, note: conflictOverrideReason, createdAt: new Date().toISOString() }, ...prev]);
    }
    setResidentialDraft(null);
    setSelectedJobId(null);
    setSection(draft.return_section || "tickets");
  };

  const createBuilderJob = draft => {
    const job = buildBuilderJobFromDraft(draft, builders);
    setResidentialDraft(null);
    setJobs(prev => [job, ...prev]);
    setBuilderScheduleDraft({
      job_id: job.id,
      builder_name: job.builder_name,
      community: job.community,
      lot_number: job.lot_number,
      scheduled_date: firstWorkingDate(plusDays(todayIso(), 1)),
      scheduled_time: "07:00",
      crew_id: job.crew_id || crews[0]?.id || "",
      notes: job.notes || "",
      charge_weekend_fee: false,
    });
    setBuilderDraft(null);
    setSelectedJobId(null);
    setSection("calendar");
  };

  const saveBuilderSchedule = draft => {
    if (!draft.scheduled_date) return;
    if (isSunday(draft.scheduled_date)) {
      blockSundaySchedule("Builder jobs");
      return;
    }
    if (isSaturday(draft.scheduled_date) && settings.skipWeekendsByDefault && !draft.weekend_override) {
      if (!settings.allowWeekendOverride) {
        window.alert("Saturday scheduling requires an override, and weekend overrides are currently disabled.");
        return;
      }
      setWeekendOverrideState({
        defaultCrewId: draft.crew_id,
        message: `${draft.builder_name} Lot ${draft.lot_number} is being scheduled on Saturday, ${fmtDate(draft.scheduled_date)}.`,
        onConfirm: override => {
          setWeekendOverrideState(null);
          saveBuilderSchedule({ ...draft, crew_id: override.crew_id, charge_weekend_fee: override.charge_weekend_fee, weekend_override: true });
        },
        onCancel: () => setWeekendOverrideState(null),
      });
      return;
    }
    const current = jobs.find(job => job.id === draft.job_id);
    if (!current) return;
    const currentPhases = sortBuilderPhases(current.phases || []);
    const updated = {
      ...current,
      scheduled_date: draft.scheduled_date,
      scheduled_time: draft.scheduled_time,
      crew_id: draft.crew_id,
      status: "Scheduled",
      charge_weekend_fee: !!draft.charge_weekend_fee,
      phases: currentPhases.map((phase, idx) => ({
        ...phase,
        scheduled_date: idx === 0 ? draft.scheduled_date : nextWorkingDate(draft.scheduled_date, idx),
        scheduled_time: draft.scheduled_time || "07:00",
        crew_id: phase.counts_toward_crew ? draft.crew_id : phase.crew_id,
        status: idx === 0 ? "Scheduled" : "Ready to Schedule",
        charge_weekend_fee: !!draft.charge_weekend_fee,
      })),
    };
    const candidateEvents = buildBuilderEvents(updated);
    const conflicts = detectCrewConflicts({ candidateEvents, jobs, crews, ignoreEventIds: buildBuilderEvents(current).map(event => event.id) });
    if (conflicts.length) {
      setConflictState({
        conflicts,
        defaultCrewId: draft.crew_id,
        reopen: () => setBuilderScheduleDraft(draft),
        onReassign: newCrewId => saveBuilderSchedule({ ...draft, crew_id: newCrewId }),
        onOverride: note => {
          setOverrideHistory(prev => [{ id: `ovr-${Date.now()}`, jobId: draft.job_id, note, createdAt: new Date().toISOString() }, ...prev]);
          setJobs(prev => prev.map(job => job.id === updated.id ? { ...updated, conflict_override_reason: note } : job));
          setBuilderScheduleDraft(null);
        },
        onCancel: () => setBuilderScheduleDraft(null),
      });
      setBuilderScheduleDraft(null);
      return;
    }
    setJobs(prev => prev.map(job => job.id === updated.id ? updated : job));
    setScheduleHistory(prev => [{ id: `sch-${Date.now()}`, type: "builder-start", jobId: draft.job_id, note: `Scheduled builder workflow start for ${draft.scheduled_date}` }, ...prev]);
    setBuilderScheduleDraft(null);
  };

  const openPhaseEdit = (jobId, phaseId) => {
    const job = jobs.find(item => item.id === jobId);
    if (!job) return;
    if (job.schedule_type === "residential") {
      openResidentialReschedule(job);
      return;
    }
    const phase = sortBuilderPhases(job.phases || []).find(item => item.id === phaseId);
    if (!phase) return;
    setPhaseDraft({
      ...phase,
      job_id: job.id,
      phase_id: phase.id,
      isResidential: false,
    });
  };

  const saveResidentialReschedule = (draft, overrideReason = "") => {
    setJobs(prev => prev.map(job => {
      if (job.id !== draft.job_id) return job;
      const updated = {
        ...job,
        scheduled_date: draft.scheduled_date,
        scheduled_time: draft.scheduled_time,
        crew_id: draft.crew_id,
        status: draft.status,
        day_capacity_used: Number(draft.day_capacity_used || job.day_capacity_used),
        notes: draft.notes,
        conflict_override_reason: overrideReason || job.conflict_override_reason || "",
      };
      const candidateEvents = buildResidentialEvents(updated);
      const conflicts = detectCrewConflicts({ candidateEvents, jobs: prev.filter(item => item.id !== job.id), crews });
      if (conflicts.length && !overrideReason) {
        setConflictState({
          conflicts,
          defaultCrewId: draft.crew_id,
          reopen: () => setPhaseDraft(draft),
          onReassign: newCrewId => saveResidentialReschedule({ ...draft, crew_id: newCrewId }, ""),
          onOverride: note => saveResidentialReschedule({ ...draft }, note),
          onCancel: () => setPhaseDraft(null),
        });
        setPhaseDraft(null);
        return job;
      }
      setScheduleHistory(history => [{ id: `sch-${Date.now()}`, type: "residential-reschedule", jobId: updated.id, note: `Rescheduled ${updated.customer_name} to ${updated.scheduled_date}` }, ...history]);
      if (overrideReason) setOverrideHistory(history => [{ id: `ovr-${Date.now()}`, jobId: updated.id, note: overrideReason, createdAt: new Date().toISOString() }, ...history]);
      setPhaseDraft(null);
      return updated;
    }));
  };

  const saveBuilderPhase = (draft, overrideReason = "") => {
    const job = jobs.find(item => item.id === draft.job_id);
    if (!job) return;
    const sortedPhases = sortBuilderPhases(job.phases || []);
    const phaseIndex = sortedPhases.findIndex(phase => phase.id === draft.phase_id);
    if (phaseIndex < 0) return;
    const previousPhase = sortedPhases[phaseIndex - 1];
    if (previousPhase?.scheduled_date && draft.scheduled_date && draft.scheduled_date < previousPhase.scheduled_date) {
      window.alert(`${draft.phase_label} cannot be scheduled before ${previousPhase.phase_label}.`);
      return;
    }
    if (draft.scheduled_date && isSunday(draft.scheduled_date)) {
      blockSundaySchedule(draft.phase_label);
      return;
    }
    if (draft.scheduled_date && isSaturday(draft.scheduled_date) && settings.skipWeekendsByDefault && !draft.weekend_override) {
      if (!settings.allowWeekendOverride) {
        window.alert("Saturday scheduling requires an override, and weekend overrides are currently disabled.");
        return;
      }
      setWeekendOverrideState({
        defaultCrewId: draft.crew_id,
        message: `${draft.phase_label} is being scheduled on Saturday, ${fmtDate(draft.scheduled_date)}.`,
        onConfirm: override => {
          setWeekendOverrideState(null);
          saveBuilderPhase({ ...draft, crew_id: override.crew_id, charge_weekend_fee: override.charge_weekend_fee, weekend_override: true }, overrideReason);
        },
        onCancel: () => setWeekendOverrideState(null),
      });
      return;
    }

    const existingPhase = sortedPhases[phaseIndex];
    const willPushForward = existingPhase.scheduled_date && draft.scheduled_date && draft.scheduled_date > existingPhase.scheduled_date && phaseIndex < sortedPhases.length - 1;
    if (willPushForward) {
      const updatedPhases = sortedPhases.map((phase, idx) => idx === phaseIndex ? { ...phase, ...draft, conflict_override_reason: overrideReason } : { ...phase });
      let cursor = draft.scheduled_date;
      for (let idx = phaseIndex + 1; idx < updatedPhases.length; idx += 1) {
        cursor = nextWorkingDate(cursor, 1);
        updatedPhases[idx] = { ...updatedPhases[idx], scheduled_date: cursor };
      }
      const updatedJob = { ...job, phases: updatedPhases };
      const candidateEvents = buildBuilderEvents(updatedJob);
      const ignoreEventIds = buildBuilderEvents(job).map(event => event.id);
      const conflicts = detectCrewConflicts({ candidateEvents, jobs, crews, ignoreEventIds });
      const summary = updatedPhases.slice(phaseIndex).map(phase => {
        const original = sortedPhases.find(item => item.id === phase.id);
        const phaseConflict = conflicts.find(conflict => conflict.candidate.phaseId === phase.id);
        return {
          phaseId: phase.id,
          phase_label: phase.phase_label,
          original_date: original?.scheduled_date || "",
          new_date: phase.scheduled_date,
          crew_label: phase.crew_id ? `Crew ${findCrewById(crews, phase.crew_id)?.number || "-"}` : "-",
          conflict: !!phaseConflict,
        };
      });
      setPushPreview({
        jobId: job.id,
        updatedJob,
        conflicts,
        summary,
        overrideReason,
      });
      setPhaseDraft(null);
      return;
    }

    const updatedJob = {
      ...job,
      phases: sortedPhases.map((phase, idx) => idx === phaseIndex ? { ...phase, ...draft, conflict_override_reason: overrideReason } : { ...phase }),
    };
    const candidateEvents = buildBuilderEvents(updatedJob);
    const ignoreEventIds = buildBuilderEvents(job).map(event => event.id);
    const conflicts = detectCrewConflicts({ candidateEvents, jobs, crews, ignoreEventIds });
    if (conflicts.length && !overrideReason) {
      setConflictState({
        conflicts,
        defaultCrewId: draft.crew_id,
        reopen: () => setPhaseDraft(draft),
        onReassign: newCrewId => saveBuilderPhase({ ...draft, crew_id: newCrewId }, ""),
        onOverride: note => saveBuilderPhase({ ...draft }, note),
        onCancel: () => setPhaseDraft(null),
      });
      setPhaseDraft(null);
      return;
    }

    setJobs(prev => prev.map(item => item.id === updatedJob.id ? updatedJob : item));
    setScheduleHistory(prev => [{ id: `sch-${Date.now()}`, type: "builder-phase", jobId: updatedJob.id, note: `Updated ${draft.phase_label} to ${draft.scheduled_date}` }, ...prev]);
    if (overrideReason) setOverrideHistory(prev => [{ id: `ovr-${Date.now()}`, jobId: updatedJob.id, note: overrideReason, createdAt: new Date().toISOString() }, ...prev]);
    setPhaseDraft(null);
  };

  const applyPushPreview = (overrideReason = "") => {
    if (!pushPreview) return;
    if (pushPreview.conflicts.length && !overrideReason) {
      setConflictState({
        conflicts: pushPreview.conflicts,
        defaultCrewId: pushPreview.updatedJob.crew_id,
        reopen: () => {},
        onReassign: newCrewId => {
          const revised = JSON.parse(JSON.stringify(pushPreview.updatedJob));
          revised.phases = revised.phases.map(phase => phase.counts_toward_crew ? { ...phase, crew_id: newCrewId } : phase);
          setPushPreview({ ...pushPreview, updatedJob: revised, conflicts: [] });
          setConflictState(null);
          setJobs(prev => prev.map(job => job.id === revised.id ? revised : job));
          setScheduleHistory(prev => [{ id: `sch-${Date.now()}`, type: "builder-push", jobId: revised.id, note: "Builder phases pushed with reassigned crew." }, ...prev]);
          setPushPreview(null);
        },
        onOverride: note => applyPushPreview(note),
        onCancel: () => { setPushPreview(null); },
      });
      setPushPreview(null);
      return;
    }
    setJobs(prev => prev.map(job => job.id === pushPreview.updatedJob.id ? { ...pushPreview.updatedJob, conflict_override_reason: overrideReason || job.conflict_override_reason || "" } : job));
    setScheduleHistory(prev => [{ id: `sch-${Date.now()}`, type: "builder-push", jobId: pushPreview.updatedJob.id, note: "Builder phases shifted forward in order." }, ...prev]);
    if (overrideReason) setOverrideHistory(prev => [{ id: `ovr-${Date.now()}`, jobId: pushPreview.updatedJob.id, note: overrideReason, createdAt: new Date().toISOString() }, ...prev]);
    setPushPreview(null);
  };

  const content = (() => {
    if (selectedTicket) {
      const sourceJob = jobs.find(job => job.sourceTicketId === selectedTicket.id) || null;
      return <TicketDetailView ticket={selectedTicket} onBack={() => setSelectedTicketId(null)} onUpdateTicket={updateTicket} onOpenSchedule={openResidentialSchedule} sourceJob={sourceJob} />;
    }
    if (selectedJob) {
      return <JobDetailView job={selectedJob} crews={crews} onBack={() => setSelectedJobId(null)} onSaveJob={job => setJobs(prev => prev.map(item => item.id === job.id ? job : item))} onOpenPhaseEdit={openPhaseEdit} />;
    }
    if (section === "tickets") return <EstimateTicketsSection tickets={tickets} onSelectTicket={ticket => setSelectedTicketId(ticket.id)} onAcceptTicket={ticket => applyTicketStatus(ticket, "Estimate Accepted", "Estimate accepted and ready for office scheduling.")} onScheduleTicket={openResidentialSchedule} jobs={jobs} />;
    if (section === "calendar") return <CalendarSection jobs={jobs} crews={crews} builders={builders} onOpenJob={jobId => setSelectedJobId(jobId)} pendingResidentialDraft={residentialDraft} onPendingResidentialDraftChange={setResidentialDraft} onSavePendingResidentialSchedule={saveResidentialSchedule} onCancelPendingResidentialSchedule={() => setResidentialDraft(null)} pendingBuilderSchedule={builderScheduleDraft} onPendingBuilderScheduleChange={setBuilderScheduleDraft} onSavePendingBuilderSchedule={saveBuilderSchedule} onCancelPendingBuilderSchedule={() => setBuilderScheduleDraft(null)} />;
    if (section === "jobs") return <JobsSection jobs={jobs} onSelectJob={jobId => setSelectedJobId(jobId)} onCreateBuilderJob={openBuilderJobModal} />;
    if (section === "crews") return <CrewsSection crews={crews} jobs={jobs} onUpdateCrew={(crewId, patch) => setCrews(prev => prev.map(crew => crew.id === crewId ? { ...crew, ...patch } : crew))} />;
    if (section === "builders") return <BuildersSection builders={builders} jobs={jobs} onCreateBuilderJob={openBuilderJobModal} onCreateBuilder={() => setBuilderRecordDraft({ name: "", contact: "", phone: "", communities: "" })} onOpenJob={jobId => setSelectedJobId(jobId)} />;
    return <SettingsSection settings={settings} onUpdateSettings={patch => setSettings(prev => ({ ...prev, ...patch }))} historyCounts={{ scheduleChanges: scheduleHistory.length, overrides: overrideHistory.length }} />;
  })();

  return (
    <div style={{ minHeight: "100vh", background: "#F0F2F5" }}>
      {!selectedTicket && !selectedJob && <AdminHeader section={section} setSection={setSection} onLogout={onLogout} setPage={setPage} alerts={jobsNeedingAttention} />}
      {!selectedTicket && !selectedJob && (
        <div style={{ maxWidth: 1220, margin: "0 auto", padding: "22px 16px 60px" }}>
          <SummaryCards tickets={tickets} jobs={jobs} events={allEvents} conflicts={activeConflicts} />
          {content}
        </div>
      )}
      {(selectedTicket || selectedJob) && content}

      {builderDraft && <BuilderJobModal draft={builderDraft} crews={crews} builders={builders} onClose={() => setBuilderDraft(null)} onSave={createBuilderJob} />}
      {builderRecordDraft && <BuilderRecordModal draft={builderRecordDraft} onClose={() => setBuilderRecordDraft(null)} onSave={createBuilderRecord} />}
      {phaseDraft && <PhaseEditModal draft={phaseDraft} crews={crews} onClose={() => setPhaseDraft(null)} onSave={phaseDraft.isResidential ? saveResidentialReschedule : saveBuilderPhase} isResidential={phaseDraft.isResidential} />}
      {pushPreview && <PushSummaryModal preview={pushPreview} onClose={() => setPushPreview(null)} onConfirm={() => applyPushPreview("")} />}
      {weekendOverrideState && (
        <WeekendOverrideModal
          state={weekendOverrideState}
          crews={crews}
          onClose={() => setWeekendOverrideState(null)}
          onConfirm={override => weekendOverrideState.onConfirm?.(override)}
          onCancel={() => weekendOverrideState.onCancel?.()}
        />
      )}
      {warningState && <WarningModal state={warningState} onClose={() => setWarningState(null)} />}
      {conflictState && (
        <ConflictModal
          state={conflictState}
          crews={crews}
          onClose={() => setConflictState(null)}
          onChooseAnotherDate={() => {
            const reopen = conflictState.reopen;
            setConflictState(null);
            reopen?.();
          }}
          onApplyReassign={crewId => {
            setConflictState(null);
            conflictState.onReassign?.(crewId);
          }}
          onApplyOverride={note => {
            setConflictState(null);
            conflictState.onOverride?.(note);
          }}
          onCancelChange={() => {
            setConflictState(null);
            conflictState.onCancel?.();
          }}
        />
      )}
    </div>
  );
}


