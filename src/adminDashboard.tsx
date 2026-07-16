import { useEffect, useMemo, useState } from "react";


import FinanceDashboard from "./adminFinanceDashboard";
import { supabase } from "./lib/supabase";
import BuildersSection from "./features/admin/builders/BuildersSection";
import BuilderRecordModal from "./features/admin/builders/BuilderRecordModal";
import { BUILDER_COLOR_PALETTE, BUILDER_PHASES, BUILDER_SLAB_WORKFLOW, sortBuilderPhases } from "./features/admin/builders/builderUtils";
import { canAccessFinance, canAccessEstimates, canManageCalendar, canViewCalendar, hasFullAccess } from "./features/admin/auth/roles";
import { fetchProfileDisplayNames } from "./features/admin/calendar/calendarService";
import { calendarStatusToDatabaseStatus, databaseStatusToCalendarStatus, toDatabaseBuilderStep, toUiBuilderPhaseKey } from "./features/admin/calendar/calendarUtils";
import CrewsSection from "./features/admin/crews/CrewsSection";
import { appCrewToDatabaseCrew, databaseCrewToAppCrew, normalizeCrew } from "./features/admin/crews/crewMappers";
import { buildBuilderEvents, buildCalendarEvents, buildResidentialEvents, findCrewById, getCrewNumber } from "./features/admin/crews/crewUtils";
import { buildCustomerSearchText, formatCustomerDisplayName, formatCustomerEmailLink, formatCustomerPhoneLink, formatCustomerTypeLabel, normalizeCustomerText } from "./features/admin/customers/customerService";
import { useBuilders } from "./features/admin/hooks/useBuilders";
import { useCustomers } from "./features/admin/hooks/useCustomers";
import { useJobs } from "./features/admin/hooks/useJobs";
import { useScheduleEvents } from "./features/admin/hooks/useScheduleEvents";
import { Btn, Card, Modal } from "./features/admin/shared/AdminPrimitives";
import { fmtDate, fmtMetricNumber, todayIso } from "./features/admin/shared/adminFormatters";
import { B, INP, labelStyle } from "./features/admin/shared/adminStyles";

const BRAND_LOGO_SRC = `${import.meta.env.BASE_URL}branding/main_logo.png`;
const RESIDENTIAL_EVENT_COLOR = "#6C3483";
const ADMIN_SECTION_STORAGE_KEY = "southern-oak-admin-section";
const ADMIN_SECTIONS = [
  { id: "dashboard", label: "Dashboard", icon: "ti-layout-dashboard" },
  { id: "tickets", label: "Estimate Tickets", icon: "ti-file-text" },
  { id: "calendar", label: "Calendar Schedule", icon: "ti-calendar-event" },
  { id: "jobs", label: "Jobs", icon: "ti-hammer" },
  { id: "customers", label: "Customers", icon: "ti-users" },
  { id: "crews", label: "Crews", icon: "ti-users-group" },
  { id: "builders", label: "Builders", icon: "ti-building-community" },
  { id: "finance", label: "Finance", icon: "ti-chart-pie-3" },
  { id: "settings", label: "Settings", icon: "ti-settings" },
];

const getAllowedAdminSections = role => ADMIN_SECTIONS.filter(section => {
  if (section.id === "dashboard") return role !== "field";
  if (section.id === "tickets") return canAccessEstimates(role);
  if (section.id === "calendar") return canViewCalendar(role);
  if (section.id === "jobs") return role !== "field";
  if (section.id === "customers") return canAccessEstimates(role);
  if (section.id === "crews") return hasFullAccess(role);
  if (section.id === "builders") return hasFullAccess(role);
  if (section.id === "finance") return canAccessFinance(role);
  if (section.id === "settings") return hasFullAccess(role);
  return false;
});

const getDefaultAdminSection = role => getAllowedAdminSections(role)[0]?.id || "calendar";

const SECTION_SUBTITLES = {
  dashboard: "Operations overview and quick access",
  tickets: "Estimate intake and follow-up queue",
  calendar: "Scheduling, crews, and work assignments",
  jobs: "Accepted and active work across the board",
  customers: "Customer records and related estimate and job activity",
  crews: "Capacity, assignments, and workload",
  builders: "Production builder relationships and communities",
  finance: "Revenue, payments, and profitability reporting",
  settings: "Scheduling rules and planning settings",
};

function formatRoleLabel(role) {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "office":
      return "Office";
    case "field":
      return "Field";
    default:
      return "";
  }
}

function resolveAccountDisplayName(fullName, email) {
  const normalizedFullName = String(fullName || "").trim();
  if (normalizedFullName) {
    return normalizedFullName;
  }

  const normalizedEmail = String(email || "").trim();
  if (normalizedEmail) {
    return normalizedEmail;
  }

  return "Signed-in user";
}

function buildInitials(fullName, email) {
  const normalizedFullName = String(fullName || "").trim();
  if (normalizedFullName) {
    const words = normalizedFullName.split(/\s+/).filter(Boolean);
    if (words.length === 1) {
      return words[0].slice(0, 1).toUpperCase();
    }

    return `${words[0].slice(0, 1)}${words[words.length - 1].slice(0, 1)}`.toUpperCase();
  }

  const normalizedEmail = String(email || "").trim();
  if (normalizedEmail) {
    const emailPrefix = normalizedEmail.split("@")[0]?.trim() || "";
    if (emailPrefix) {
      return emailPrefix.slice(0, 1).toUpperCase();
    }
  }

  return "U";
}

const ESTIMATE_STATUSES = [
  "New Request",
  "Needs Review",
  "Rough Estimate Sent",
  "Interested",
  "Site Visit Requested",
  "Follow Up Needed",
  "Declined",
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
  Active: { c: "#25603C", bg: "#E6F3EA" },
  Inactive: { c: "#5F645D", bg: "#ECEEE9" },
  "New Request": { c: "#275A85", bg: "#E8F1FA" },
  "Needs Review": { c: "#7C6320", bg: "#F7F1DF" },
  "Rough Estimate Sent": { c: "#6A4D8E", bg: "#F1ECF8" },
  Interested: { c: "#25603C", bg: "#E6F3EA" },
  "Site Visit Requested": { c: "#1E8449", bg: "#DCF3E4" },
  "Follow Up Needed": { c: "#9C640C", bg: "#FCF3CF" },
  Declined: { c: "#5F645D", bg: "#ECEEE9" },
  "Site Visit Needed": { c: "#A14B40", bg: "#F9E8E4" },
  Scheduled: { c: "#25603C", bg: "#E6F3EA" },
  "Final Quote Sent": { c: "#275A85", bg: "#E8F1FA" },
  "Estimate Accepted": { c: "#25603C", bg: "#E6F3EA" },
  "Ready to Schedule": { c: "#8A6A12", bg: "#F8F1D9" },
  "In Progress": { c: "#5B4A88", bg: "#EEE9F8" },
  Completed: { c: "#25603C", bg: "#DFF0E5" },
  Delayed: { c: "#6B4EA0", bg: "#EEE9F8" },
  Cancelled: { c: "#5F645D", bg: "#ECEEE9" },
  Won: { c: "#25603C", bg: "#DFF0E5" },
  Lost: { c: "#5F645D", bg: "#ECEEE9" },
  Pending: { c: "#586455", bg: "#EEF1EC" },
};
const YES_DECISION_STATUSES = new Set(["Interested", "Site Visit Requested"]);
const NO_DECISION_STATUSES = new Set(["Follow Up Needed", "Declined"]);
const CUSTOMER_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DECISION_STYLES = {
  yes: { label: "Yes / Interested", short: "Yes", c: "#25603C", bg: "#E6F3EA" },
  no: { label: "No / Follow Up Needed", short: "No", c: "#9C640C", bg: "#FCF3CF" },
  pending: { label: "Awaiting decision", short: "Pending", c: "#5F645D", bg: "#F3F4F2" },
};

const RESPONSIBLE_PARTIES = [
  "Southern Oak Concrete",
  "Builder",
  "Plumber",
  "Inspector",
  "Other",
];
const STANDARD_RESCHEDULE_REASONS = [
  "Weather Delay",
  "Crew Availability",
  "Customer Request",
  "Builder Request",
  "Material Delay",
  "Site Not Ready",
  "Inspection / Permit",
  "Other",
];
const parseRescheduleReasonDraft = reason => {
  const normalizedReason = String(reason || "").trim();
  if (!normalizedReason) {
    return { preset: "", custom: "" };
  }

  const matchedReason = STANDARD_RESCHEDULE_REASONS.find(option => option.toLowerCase() === normalizedReason.toLowerCase());
  if (matchedReason) {
    return { preset: matchedReason, custom: "" };
  }

  return { preset: "Other", custom: normalizedReason };
};
const buildRescheduleReasonValue = (preset, custom = "") => {
  if (!preset) {
    return "";
  }

  if (preset === "Other") {
    return String(custom || "").trim();
  }

  return preset;
};

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

const DEFAULT_SETTINGS = {
  skipWeekendsByDefault: true,
  allowWeekendOverride: true,
  defaultCrewCapacity: 1,
};

const fmtDateShort = iso => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "-";
const fmtTime = value => value || "-";
const fmtMoney = n => n != null ? `$${Number(n).toLocaleString()}` : "-";
const getDecisionCategory = ticket => {
  if (ticket.estimateDecision === "yes" || YES_DECISION_STATUSES.has(ticket.status)) return "yes";
  if (ticket.estimateDecision === "no" || NO_DECISION_STATUSES.has(ticket.status)) return "no";
  return "pending";
};
const getDecisionStyle = ticket => DECISION_STYLES[getDecisionCategory(ticket)];
const getLatestNotification = ticket => {
  const notifications = ticket.notifications || [];
  return notifications.length ? notifications[notifications.length - 1] : null;
};
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
const recalculateWorkflowPhaseDates = (phases, startIndex = 0) => {
  const nextPhases = phases.map(phase => ({ ...phase }));

  for (let idx = Math.max(1, startIndex + 1); idx < nextPhases.length; idx += 1) {
    if (nextPhases[idx].manual_date_override) {
      continue;
    }

    const previousPhase = nextPhases[idx - 1];
    const workingDaysAfterPrevious = BUILDER_SLAB_WORKFLOW[idx]?.workingDaysAfterPrevious ?? 0;
    nextPhases[idx].scheduled_date = previousPhase?.scheduled_date
      ? nextWorkingDate(previousPhase.scheduled_date, workingDaysAfterPrevious)
      : "";
  }

  return nextPhases;
};
const formatDateTime = value => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};
const EMPTY_FIELD = "—";
const formatDisplayField = value => normalizeCustomerText(value) || EMPTY_FIELD;
const formatCustomerLocation = customer => [customer.city, customer.state].map(value => normalizeCustomerText(value)).filter(Boolean).join(", ") || EMPTY_FIELD;
const customerContactLinkStyle = {
  color: B.dark,
  textDecoration: "underline",
  textUnderlineOffset: 2,
};
const formatEstimateAmountLabel = ticket => {
  if (ticket.quote != null) {
    return fmtMoney(ticket.quote);
  }

  if (ticket.rLow != null || ticket.rHigh != null) {
    return `${fmtMoney(ticket.rLow)} - ${fmtMoney(ticket.rHigh)}`;
  }

  return EMPTY_FIELD;
};
const getCustomerJobDisplayName = job => {
  if (job.schedule_type === "residential") {
    return job.name || job.customer_name || "Residential Job";
  }

  if (job.lot_number) {
    return `${job.builder_name} - Lot ${job.lot_number}`;
  }

  return job.name || job.builder_name || "Builder Job";
};
const getCustomerJobReference = job => job.schedule_type === "residential" ? (job.work_order_number || EMPTY_FIELD) : EMPTY_FIELD;
const getCustomerJobScheduledLabel = job => job.scheduled_date ? `${fmtDate(job.scheduled_date)} · ${job.scheduled_time || EMPTY_FIELD}` : EMPTY_FIELD;
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
const normalizeBuilderJob = job => job.schedule_type === "builder_slab" ? { ...job, phases: sortBuilderPhases(job.phases || []) } : job;
const eventColor = event => event.color || RESIDENTIAL_EVENT_COLOR;

function Logo({ sm = false }) {
  return (
    <img src={BRAND_LOGO_SRC} alt="Southern Oak Concrete & Construction" style={{ display: "block", height: sm ? 34 : 44, width: "auto" }} />
  );
}

function Pill({ status, label }) {
  const cfg = STATUS_STYLES[status] || { c: "#555", bg: "#eee" };
  return <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, background: cfg.bg, color: cfg.c, fontWeight: 700, fontSize: ".68rem", whiteSpace: "nowrap" }}>{label || status}</span>;
}

function getCustomerStatusLabel(customer) {
  return customer?.is_active === false ? "Inactive" : "Active";
}

function buildCustomerEditDraft(customer) {
  return {
    first_name: customer?.first_name || "",
    last_name: customer?.last_name || "",
    company_name: customer?.company_name || "",
    phone: customer?.phone || "",
    email: customer?.email || "",
    street_address: customer?.street_address || "",
    city: customer?.city || "",
    state: customer?.state || "",
    zip_code: customer?.zip_code || "",
    customer_type: normalizeCustomerText(customer?.customer_type).toLowerCase() || "residential",
    notes: customer?.notes || "",
  };
}

function validateCustomerEditDraft(draft) {
  const firstName = normalizeCustomerText(draft.first_name);
  const lastName = normalizeCustomerText(draft.last_name);
  const companyName = normalizeCustomerText(draft.company_name);
  const email = normalizeCustomerText(draft.email);
  const customerType = normalizeCustomerText(draft.customer_type).toLowerCase() || "residential";

  if (!["residential", "builder", "commercial"].includes(customerType)) {
    return "Choose a valid customer type.";
  }

  if (!firstName && !lastName && !companyName) {
    return "Enter at least a first name, last name, or company name.";
  }

  if (customerType === "residential" && !firstName) {
    return "Residential customers require a first name.";
  }

  if (email && !CUSTOMER_EMAIL_PATTERN.test(email)) {
    return "Enter a valid email address.";
  }

  return "";
}

function DecisionPill({ ticket, short = false }) {
  const cfg = getDecisionStyle(ticket);
  return <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, background: cfg.bg, color: cfg.c, fontWeight: 700, fontSize: ".68rem", whiteSpace: "nowrap" }}>{short ? cfg.short : cfg.label}</span>;
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

function detectCrewConflicts({ candidateEvents, jobs = [], crews, ignoreEventIds = [], existingEvents = null }) {
  const scheduledEvents = (existingEvents || buildCalendarEvents(jobs))
    .filter(event => !ignoreEventIds.includes(event.id) && event.counts_toward_crew);
  const conflicts = [];
  candidateEvents.filter(event => event.counts_toward_crew && event.crew_id && event.date).forEach(candidate => {
    const sameDay = scheduledEvents.filter(event => event.crew_id === candidate.crew_id && event.date === candidate.date);
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

function AdminHeader({ section, setSection, onLogout, setPage, alerts, sections = ADMIN_SECTIONS }) {
  return (
    <div className="admin-header-shell" style={{ background: B.dark }}>
      <div style={{ maxWidth: 1220, margin: "0 auto", padding: "0 16px" }}>
        <div className="admin-header" style={{ height: 62, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
          <div className="admin-brand-row" style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Logo sm />
            <div style={{ width: 1, height: 22, background: "rgba(255,255,255,.15)" }} />
            <span style={{ fontSize: ".8rem", color: "rgba(255,255,255,.68)", fontWeight: 700 }}>Operations Dashboard</span>
          </div>
          <div className="admin-actions" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {alerts > 0 && <span className="admin-alert" style={{ fontSize: ".74rem", color: B.tan, fontWeight: 700 }}>{alerts} jobs need attention</span>}
            <button className="admin-action-button" onClick={() => setPage("home")} style={{ background: "none", border: "1px solid rgba(255,255,255,.2)", color: "rgba(255,255,255,.7)", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: ".76rem", fontFamily: "inherit" }}>
              <i className="ti ti-world" style={{ marginRight: 5, fontSize: 12 }} aria-hidden="true" />View Site
            </button>
            <button className="admin-action-button" onClick={onLogout} style={{ background: "none", border: "1px solid rgba(255,255,255,.2)", color: "rgba(255,255,255,.7)", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: ".76rem", fontFamily: "inherit" }}>
              <i className="ti ti-logout" style={{ marginRight: 5, fontSize: 12 }} aria-hidden="true" />Sign Out
            </button>
          </div>
        </div>
        <div className="admin-tabs" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 0 14px" }}>
          {sections.map(item => (
            <button className="admin-tab-button" key={item.id} onClick={() => setSection(item.id)} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,.1)", background: section === item.id ? "rgba(255,255,255,.14)" : "rgba(255,255,255,.04)", color: section === item.id ? B.white : "rgba(255,255,255,.65)", cursor: "pointer", fontSize: ".78rem", fontWeight: 700, fontFamily: "inherit", whiteSpace: "nowrap" }}>
              <i className={`ti ${item.icon}`} style={{ marginRight: 6, fontSize: 13 }} aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SidebarBrand() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Logo sm />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: ".82rem", fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--oak-cream)", lineHeight: 1.15 }}>Southern Oak</div>
        <div style={{ fontSize: ".68rem", color: "rgba(243,232,208,.68)", fontWeight: 700 }}>Construction</div>
      </div>
    </div>
  );
}

function AdminSidebar({
  section,
  setSection,
  financeView,
  setFinanceView,
  alerts,
  mobileOpen,
  onClose,
  appRole,
  profileFullName,
  userEmail,
  onLogout,
  sections = ADMIN_SECTIONS,
}) {
  const financeSubsections = [
    { id: "overview", label: "Overview" },
    { id: "revenue", label: "Revenue" },
    { id: "payments", label: "Payments" },
    { id: "reports", label: "Reports" },
  ];
  const navSections = sections.filter(item => item.id !== "settings");
  const hasSettingsAccess = sections.some(item => item.id === "settings");
  const displayName = resolveAccountDisplayName(profileFullName, userEmail);
  const roleLabel = formatRoleLabel(appRole);
  const initials = buildInitials(profileFullName, userEmail);
  return (
    <>
      {mobileOpen && <button onClick={onClose} aria-label="Close navigation" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.42)", border: "none", padding: 0, zIndex: 3090 }} />}
      <aside className={`admin-sidebar${mobileOpen ? " is-open" : ""}`} style={{ background: "linear-gradient(180deg,var(--oak-black),var(--oak-deep-green))", color: "var(--oak-cream)" }}>
        <div style={{ padding: 20, borderBottom: "1px solid rgba(243,232,208,.08)" }}>
          <SidebarBrand />
        </div>
        <div className="admin-sidebar-nav-shell">
          <div className="admin-sidebar-nav">
          {alerts > 0 && (
            <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(154,116,26,.12)", color: "var(--oak-tan)", fontSize: ".78rem", fontWeight: 700 }}>
              {alerts} jobs need attention
            </div>
          )}
          {navSections.map(item => {
            const active = section === item.id;
            return (
              <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button
                  onClick={() => {
                    setSection(item.id);
                    onClose();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    minHeight: 44,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: `1px solid ${active ? "rgba(154,116,26,.32)" : "rgba(243,232,208,.08)"}`,
                    background: active ? "rgba(154,116,26,.14)" : "transparent",
                    color: active ? "var(--oak-cream)" : "rgba(243,232,208,.78)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontWeight: 700,
                    fontSize: ".82rem",
                    textAlign: "left",
                  }}
                >
                  <i className={`ti ${item.icon}`} style={{ fontSize: 16 }} aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
                {item.id === "finance" && section === "finance" && (
                  <div style={{ marginLeft: 10, display: "flex", flexDirection: "column", gap: 6, paddingLeft: 12, borderLeft: "1px solid rgba(243,232,208,.14)" }}>
                    {financeSubsections.map(subItem => {
                      const subActive = financeView === subItem.id;
                      return (
                        <button
                          key={subItem.id}
                          onClick={() => setFinanceView(subItem.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            minHeight: 40,
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "none",
                            background: subActive ? "rgba(23,35,21,.48)" : "transparent",
                            color: subActive ? "var(--oak-tan)" : "rgba(243,232,208,.68)",
                            cursor: "pointer",
                            fontFamily: "inherit",
                            fontWeight: 700,
                            fontSize: ".76rem",
                            textAlign: "left",
                          }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: 999, background: subActive ? "var(--oak-gold)" : "rgba(243,232,208,.24)", display: "inline-block" }} />
                          {subItem.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </div>
        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-account">
            <div className="admin-sidebar-account-avatar" aria-hidden="true">{initials}</div>
            <div className="admin-sidebar-account-copy">
              <div className="admin-sidebar-account-name" title={displayName}>{displayName}</div>
              <div className="admin-sidebar-account-role">{roleLabel}</div>
            </div>
          </div>
          <div className="admin-sidebar-footer-separator" aria-hidden="true" />
          <div className="admin-sidebar-footer-actions">
            {hasSettingsAccess && (
              <button
                className={`admin-sidebar-footer-button${section === "settings" ? " is-active" : ""}`}
                onClick={() => {
                  setSection("settings");
                  onClose();
                }}
              >
                <i className="ti ti-settings" style={{ fontSize: 15 }} aria-hidden="true" />
                <span>Settings</span>
              </button>
            )}
            <button
              className="admin-sidebar-footer-button admin-sidebar-footer-button--danger"
              onClick={() => {
                onClose();
                onLogout();
              }}
            >
              <i className="ti ti-logout" style={{ fontSize: 15 }} aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function AdminTopBar({ section, financeView, onOpenMenu, setPage, sections = ADMIN_SECTIONS }) {
  const title = section === "finance"
    ? `Finance${financeView !== "overview" ? ` / ${financeView[0].toUpperCase()}${financeView.slice(1)}` : ""}`
    : sections.find(item => item.id === section)?.label || "Dashboard";
  return (
    <div className="admin-topbar-shell">
      <div className="admin-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <button className="admin-menu-toggle" onClick={onOpenMenu} style={{ width: 42, height: 42, borderRadius: 10, border: "1px solid var(--admin-border)", background: "var(--admin-card-bg)", color: "var(--admin-text)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="ti ti-menu-2" style={{ fontSize: 18 }} aria-hidden="true" />
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--admin-text)" }}>{title}</div>
            <div style={{ fontSize: ".76rem", color: "var(--admin-muted)" }}>{SECTION_SUBTITLES[section] || "Operations workspace"}</div>
          </div>
        </div>
        <div className="admin-topbar-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="oak-button oak-button--outline" onClick={() => setPage("home")} style={{ minHeight: 42, padding: "8px 12px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontFamily: "inherit" }}>
            <i className="ti ti-world" style={{ marginRight: 6, fontSize: 13 }} aria-hidden="true" />
            View Site
          </button>
        </div>
      </div>
    </div>
  );
}

function DashboardHomeSection({ tickets, jobs, events, conflicts, setSection }) {
  const openReceivables = tickets.filter(ticket => ["Needs Review", "Interested", "Site Visit Requested", "Follow Up Needed", "Estimate Accepted", "Ready to Schedule"].includes(ticket.status)).slice(0, 4);
  const upcoming = events.filter(event => event.date >= todayIso()).slice(0, 5);
  return (
    <>
      <SummaryCards tickets={tickets} jobs={jobs} events={events} conflicts={conflicts} />
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr .8fr", gap: 16 }}>
        <Card className="admin-section-card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ fontSize: "1.2rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>Operations Dashboard</h1>
              <p style={{ fontSize: ".8rem", color: B.gray }}>Quick access into scheduling, estimate follow-up, and active work.</p>
            </div>
            <button className="oak-button oak-button--primary" onClick={() => setSection("tickets")} style={{ minHeight: 42, padding: "10px 14px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700, fontFamily: "inherit" }}>
              Open Estimate Queue
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
            {[
              { label: "Estimate Tickets", icon: "ti-file-text", onClick: () => setSection("tickets") },
              { label: "Calendar Schedule", icon: "ti-calendar-event", onClick: () => setSection("calendar") },
              { label: "Jobs", icon: "ti-hammer", onClick: () => setSection("jobs") },
              { label: "Finance", icon: "ti-chart-pie-3", onClick: () => setSection("finance") },
            ].map(item => (
              <button key={item.label} className="oak-button oak-button--outline" onClick={item.onClick} style={{ minHeight: 74, padding: "14px 16px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <div style={{ fontSize: ".76rem", color: B.gray, marginBottom: 8 }}><i className={`ti ${item.icon}`} style={{ marginRight: 6 }} aria-hidden="true" />Workspace</div>
                <div style={{ fontSize: ".92rem", fontWeight: 700, color: B.dark }}>{item.label}</div>
              </button>
            ))}
          </div>
        </Card>
        <Card className="admin-section-card">
          <div style={{ fontSize: ".9rem", fontWeight: 700, color: B.dark, marginBottom: 12 }}>Needs Attention</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {openReceivables.map(ticket => (
              <div key={ticket.id} style={{ padding: "10px 12px", borderRadius: 10, background: B.sand, border: `1px solid ${B.border}` }}>
                <div style={{ fontSize: ".82rem", fontWeight: 700, color: B.dark }}>{ticket.name}</div>
                <div style={{ fontSize: ".74rem", color: B.gray }}>{ticket.ptype} · {ticket.status}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card className="admin-section-card" style={{ marginTop: 16 }}>
        <div style={{ fontSize: ".9rem", fontWeight: 700, color: B.dark, marginBottom: 12 }}>Upcoming Scheduled Work</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 }}>
          {upcoming.map(event => (
            <div key={event.id} style={{ padding: "12px 14px", borderRadius: 10, border: `1px solid ${B.border}`, background: B.white }}>
              <div style={{ fontSize: ".8rem", fontWeight: 700, color: B.dark }}>{event.customer_name || `${event.builder_name} Lot ${event.lot_number}`}</div>
              <div style={{ fontSize: ".74rem", color: B.gray, marginTop: 4 }}>{fmtDate(event.date)} · {event.time}</div>
              <div style={{ fontSize: ".72rem", color: B.gray, marginTop: 4 }}>{event.phase_label}</div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function SummaryCards({ tickets, jobs, events, conflicts }) {
  const readyTickets = tickets.filter(ticket => ["Estimate Accepted", "Ready to Schedule"].includes(ticket.status)).length;
  const warmLeads = tickets.filter(ticket => getDecisionCategory(ticket) === "yes").length;
  const followUpLeads = tickets.filter(ticket => getDecisionCategory(ticket) === "no").length;
  const today = todayIso();
  const todayEvents = events.filter(event => event.date === today).length;
  const delayed = jobs.filter(job => job.status === "Delayed").length;
  const cards = [
    { label: "New requests", value: tickets.filter(ticket => ticket.status === "New Request").length, icon: "ti-bell", color: "#1A5276" },
    { label: "Warm leads", value: warmLeads, icon: "ti-flame", color: "#1E8449" },
    { label: "Follow up needed", value: followUpLeads, icon: "ti-phone-call", color: "#9C640C" },
    { label: "Ready to schedule", value: readyTickets, icon: "ti-calendar-plus", color: "#7D6608" },
    { label: "Work on calendar today", value: todayEvents, icon: "ti-calendar-event", color: "#1A5632" },
    { label: "Crew conflicts", value: conflicts.length, icon: "ti-alert-triangle", color: "#922B21" },
    { label: "Delayed jobs", value: delayed, icon: "ti-clock-exclamation", color: "#6C3483" },
  ];
  return (
    <div className="admin-card-grid admin-summary-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 18 }}>
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

function EstimateTicketsSection({ tickets, ticketsLoading = false, ticketsError = "", onSelectTicket, onAcceptTicket, onScheduleTicket, jobs, scheduledEstimateDatabaseIds = new Set() }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [decisionFilter, setDecisionFilter] = useState("All");
  const [sortBy, setSortBy] = useState("date");
  const scheduledTicketIds = new Set(jobs.filter(job => job.sourceTicketId && job.scheduled_date).map(job => job.sourceTicketId));
  const filtered = useMemo(() => {
    let list = tickets;
    if (statusFilter !== "All") list = list.filter(item => item.status === statusFilter);
    if (decisionFilter !== "All") list = list.filter(item => getDecisionCategory(item) === decisionFilter);
    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter(item => item.name.toLowerCase().includes(term) || item.city.toLowerCase().includes(term) || item.ptype.toLowerCase().includes(term) || item.id.toLowerCase().includes(term));
    }
    if (sortBy === "date") list = [...list].sort((a, b) => new Date(b.at) - new Date(a.at));
    if (sortBy === "amount") list = [...list].sort((a, b) => (b.rHigh || 0) - (a.rHigh || 0));
    if (sortBy === "followup") list = [...list].sort((a, b) => (a.followUp || "").localeCompare(b.followUp || ""));
    return list;
  }, [tickets, statusFilter, decisionFilter, search, sortBy]);

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
            <select value={decisionFilter} onChange={e => setDecisionFilter(e.target.value)} style={{ ...INP, width: "auto", cursor: "pointer" }}>
              <option value="All">All decisions</option>
              <option value="yes">Yes / Interested</option>
              <option value="no">No / Follow Up Needed</option>
              <option value="pending">Awaiting decision</option>
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

      {ticketsLoading && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontSize: ".84rem", color: B.gray, fontWeight: 600 }}>Loading estimate tickets...</div>
        </Card>
      )}

      {ticketsError && (
        <Card style={{ marginBottom: 14, background: "#FFF8E1", borderColor: "#E5D7A7" }}>
          <div style={{ fontSize: ".84rem", color: "#8A6A12", fontWeight: 700 }}>Unable to load estimate tickets.</div>
          <div style={{ fontSize: ".78rem", color: B.gray, marginTop: 4 }}>{ticketsError}</div>
        </Card>
      )}

      {!ticketsLoading && !ticketsError && tickets.length === 0 && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontSize: ".84rem", color: B.gray, fontWeight: 600 }}>No estimate tickets found.</div>
        </Card>
      )}

      {!ticketsLoading && !ticketsError && tickets.length > 0 && filtered.length === 0 && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontSize: ".84rem", color: B.gray, fontWeight: 600 }}>No estimate tickets match the current filters.</div>
        </Card>
      )}

      <div className="estimate-ticket-list">
        {!ticketsLoading && !ticketsError && filtered.map(ticket => {
          const isScheduled = scheduledTicketIds.has(ticket.id) || (!!ticket.databaseId && scheduledEstimateDatabaseIds.has(ticket.databaseId));
          const decision = getDecisionCategory(ticket);
          const latestNotification = getLatestNotification(ticket);
          const canAcceptEstimate = decision === "pending" && !["Estimate Accepted", "Ready to Schedule", "Scheduled", "Won", "Lost", "Declined"].includes(ticket.status);
          return (
            <Card key={ticket.id} className="estimate-ticket-card">
              <div className="estimate-ticket-row">
                <div className="estimate-ticket-cell estimate-ticket-cell--customer">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 700, color: B.dark, fontSize: ".94rem" }}>{ticket.name}</div>
                    <span style={{ fontSize: ".72rem", color: B.gray }}>{ticket.id}</span>
                  </div>
                  <div style={{ fontSize: ".76rem", color: B.gray, marginTop: 3 }}>
                    <i className="ti ti-map-pin" style={{ marginRight: 4, fontSize: 12 }} aria-hidden="true" />{ticket.city}
                  </div>
                </div>
                <div className="estimate-ticket-cell">
                  <div className="estimate-ticket-label">Project / Area</div>
                  <div style={{ fontSize: ".78rem", color: B.mid, fontWeight: 700 }}>{ticket.ptype}</div>
                  <div style={{ fontSize: ".72rem", color: B.gray, marginTop: 3 }}>{ticket.sqft > 0 ? `${ticket.sqft.toLocaleString()} sqft` : "Field measure required"}</div>
                </div>
                <div className="estimate-ticket-cell">
                  <div className="estimate-ticket-label">Estimate</div>
                  <div style={{ fontSize: ".86rem", fontWeight: 700, color: B.dark }}>{fmtMoney(ticket.quote) !== "-" ? fmtMoney(ticket.quote) : `${fmtMoney(ticket.rLow)} - ${fmtMoney(ticket.rHigh)}`}</div>
                </div>
                <div className="estimate-ticket-cell">
                  <div className="estimate-ticket-label">Follow-up</div>
                  <div style={{ fontSize: ".8rem", color: ticket.followUp ? B.bronze : B.gray }}>{ticket.followUp ? fmtDate(ticket.followUp) : "Not set"}</div>
                </div>
                <div className="estimate-ticket-cell">
                  <div className="estimate-ticket-label">Decision</div>
                  <DecisionPill ticket={ticket} />
                </div>
                <div className="estimate-ticket-cell estimate-ticket-cell--actions">
                  <div className="estimate-ticket-label">Status / Actions</div>
                  <div className="estimate-ticket-actions">
                    <Pill status={ticket.status} />
                    {canAcceptEstimate && (
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
              </div>
              {ticket.notes && (
                <div className="estimate-ticket-detail-row">
                  <div className="estimate-ticket-detail-label">Customer notes</div>
                  <div className="estimate-ticket-detail-text">{ticket.notes}</div>
                </div>
              )}
              {latestNotification && (
                <div className="estimate-ticket-detail-row" style={{ color: decision === "yes" ? B.green : decision === "no" ? B.bronze : B.gray }}>
                  <div className="estimate-ticket-detail-label">Latest alert</div>
                  <div className="estimate-ticket-detail-text">
                  <i className={`ti ${decision === "yes" ? "ti-flame" : decision === "no" ? "ti-phone-call" : "ti-bell"}`} style={{ marginRight: 6 }} aria-hidden="true" />
                  {latestNotification.message}
                  </div>
                </div>
              )}
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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const decision = getDecisionCategory(t);
  const latestNotification = getLatestNotification(t);
  const showSiteVisitAction = decision === "yes" && !["Site Visit Needed", "Scheduled", "Estimate Accepted", "Ready to Schedule", "Won"].includes(t.status);
  const canScheduleJob = ["Estimate Accepted", "Ready to Schedule"].includes(t.status);
  const canAcceptEstimate = decision === "pending" && !["Estimate Accepted", "Ready to Schedule", "Scheduled", "Won", "Lost", "Declined"].includes(t.status);

  const save = async () => {
    setSaving(true);
    setSaveError("");
    try {
      await onUpdateTicket(t);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onBack();
      }, 350);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save estimate changes.";
      console.error("Unable to save ticket:", error);
      setSaveError(message);
    } finally {
      setSaving(false);
    }
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
    <div style={{ minHeight: "100vh", background: "#F4F6F3" }}>
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
            <Btn onClick={save} v="green" sm disabled={saving}><i className="ti ti-device-floppy" style={{ marginRight: 5, fontSize: 13, verticalAlign: -2 }} aria-hidden="true" />{saving ? "Saving..." : "Save Changes"}</Btn>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px 60px" }}>
        {saveError && (
          <Card style={{ marginBottom: 16, background: "#FFF8E1", borderColor: "#E5D7A7" }}>
            <div style={{ fontSize: ".82rem", color: "#8A6A12", fontWeight: 700 }}>Estimate changes were not saved.</div>
            <div style={{ fontSize: ".76rem", color: B.gray, marginTop: 4 }}>{saveError}</div>
          </Card>
        )}

        <Card style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <h1 style={{ fontSize: "1.2rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>{t.name}</h1>
              <div style={{ fontSize: ".82rem", color: B.gray }}>{t.ptype} - {t.city} - Submitted {fmtDateShort(t.at?.slice?.(0, 10) || todayIso())}</div>
            </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Pill status={t.status} />
            <DecisionPill ticket={t} />
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
              {t.notes && <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${B.border}` }}>
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
              <h3 style={{ fontSize: ".82rem", fontWeight: 700, color: B.dark, textTransform: "uppercase", letterSpacing: .5, marginBottom: 12 }}><i className="ti ti-route" style={{ marginRight: 6, color: B.bronze }} aria-hidden="true" />Estimate Decision</h3>
              <div style={{ display: "grid", gap: 10 }}>
                <div>
                  <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 4 }}>Customer decision</div>
                  <DecisionPill ticket={t} />
                </div>
                <div>
                  <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 2 }}>Question asked</div>
                  <div style={{ fontSize: ".8rem", color: B.dark }}>{t.decisionQuestion || "Does this estimate range work for your project?"}</div>
                </div>
                <div>
                  <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 2 }}>Decision recorded</div>
                  <div style={{ fontSize: ".8rem", color: B.dark }}>{t.decisionAt ? new Date(t.decisionAt).toLocaleString() : "Awaiting customer response"}</div>
                </div>
                {decision === "no" && (t.decisionFeedbackReason || t.decisionFeedbackComment) && (
                  <div style={{ padding: "10px 12px", borderRadius: 8, background: "#FFF8E1", border: `1px solid ${B.border}` }}>
                    <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 4 }}>Customer feedback</div>
                    {t.decisionFeedbackReason && <div style={{ fontSize: ".8rem", color: B.dark, fontWeight: 700, marginBottom: t.decisionFeedbackComment ? 6 : 0 }}>{t.decisionFeedbackReason}</div>}
                    {t.decisionFeedbackComment && <div style={{ fontSize: ".78rem", color: B.mid, lineHeight: 1.5 }}>{t.decisionFeedbackComment}</div>}
                  </div>
                )}
                {latestNotification && (
                  <div style={{ padding: "10px 12px", borderRadius: 8, background: decision === "yes" ? "#E6F3EA" : decision === "no" ? "#FCF3CF" : B.sand, color: decision === "yes" ? "#25603C" : decision === "no" ? "#9C640C" : B.gray, fontSize: ".78rem", lineHeight: 1.5 }}>
                    <strong style={{ display: "block", marginBottom: 4 }}>{latestNotification.title || "Lead notification"}</strong>
                    {latestNotification.message}
                  </div>
                )}
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
                {canAcceptEstimate && (
                  <Btn full sm v="green" onClick={() => { changeStatus("Estimate Accepted"); }}>
                    <i className="ti ti-check" style={{ marginRight: 5, fontSize: 13 }} aria-hidden="true" />Accept Estimate
                  </Btn>
                )}
                {showSiteVisitAction && (
                  <Btn full sm v="green" onClick={() => { changeStatus("Site Visit Needed"); }}>
                    <i className="ti ti-map-search" style={{ marginRight: 5, fontSize: 13 }} aria-hidden="true" />Move to Site Visit Needed
                  </Btn>
                )}
                {canScheduleJob && (
                  <Btn full sm v="dark" onClick={() => onOpenSchedule(t)}>
                    <i className="ti ti-calendar-event" style={{ marginRight: 5, fontSize: 13 }} aria-hidden="true" />Schedule Job
                  </Btn>
                )}
                {!canAcceptEstimate && !showSiteVisitAction && !canScheduleJob && (
                  <div style={{ fontSize: ".76rem", color: B.gray, lineHeight: 1.5 }}>This lead is best handled through follow-up and status updates before scheduling work.</div>
                )}
                <Btn full sm v="outline" onClick={save} disabled={saving}>
                  <i className="ti ti-device-floppy" style={{ marginRight: 5, fontSize: 13 }} aria-hidden="true" />{saving ? "Saving..." : "Save Lead Updates"}
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

function CalendarSection({ events, crews, onOpenJob, pendingResidentialDraft, onPendingResidentialDraftChange, onSavePendingResidentialSchedule, onCancelPendingResidentialSchedule, pendingBuilderSchedule, onPendingBuilderScheduleChange, onSavePendingBuilderSchedule, onCancelPendingBuilderSchedule, readOnly = false, loading = false, error = "" }) {
  const [view, setView] = useState("month");
  const [anchorDate, setAnchorDate] = useState(todayIso());
  const [filters, setFilters] = useState({ crewId: "All", builderId: "All", scheduleType: "All", jobType: "All", status: "All" });
  const schedulingLocked = !readOnly && (!!pendingResidentialDraft || !!pendingBuilderSchedule);
  const builderNames = useMemo(
    () => [...new Set(events.map((event) => event.builder_name).filter(Boolean))].sort((first, second) => first.localeCompare(second)),
    [events]
  );
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
    if (readOnly) return;
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
        <div className="calendar-controls" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>Calendar Schedule</h1>
            <p style={{ fontSize: ".8rem", color: B.gray }}>View residential jobs and builder slab phases by month, week, or day with crew and builder filters.</p>
          </div>
          <div className="calendar-view-toggle" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["month", "week", "day"].map(item => (
              <button className="oak-button" key={item} onClick={() => setView(item)} style={{ padding: "8px 12px", borderRadius: 6, border: `1.5px solid ${view === item ? B.green : B.border}`, background: view === item ? "#e9e0ca" : B.white, color: view === item ? B.green : B.mid, fontWeight: 700, fontSize: ".76rem", cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="calendar-filters" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginTop: 12 }}>
          <select value={filters.crewId} onChange={e => setFilters(prev => ({ ...prev, crewId: e.target.value }))} style={{ ...INP, cursor: "pointer" }}>
            <option value="All">All crews</option>
            {crews.map(crew => <option key={crew.id} value={crew.id}>{crew.name}</option>)}
          </select>
          <select value={filters.builderId} onChange={e => setFilters(prev => ({ ...prev, builderId: e.target.value }))} style={{ ...INP, cursor: "pointer" }}>
            <option value="All">All builders</option>
            {builderNames.map(builderName => <option key={builderName} value={builderName}>{builderName}</option>)}
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

      {readOnly && (
        <Card style={{ marginBottom: 14, background: "#F7F6F0" }}>
          <div style={{ fontSize: ".82rem", color: B.mid, fontWeight: 700 }}>Field view is read-only.</div>
          <div style={{ fontSize: ".76rem", color: B.gray, marginTop: 3 }}>Scheduled work details are available, but creating, editing, rescheduling, deleting, and crew assignment controls are disabled for this role.</div>
        </Card>
      )}

      <div className="calendar-layout" style={{ display: "grid", gridTemplateColumns: schedulingLocked ? "minmax(0,1fr) 320px" : "1fr", gap: 14 }}>
      <Card className="admin-section-card calendar-main-card">
        <div className="calendar-controls" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <div className="calendar-nav-controls" style={{ display: "flex", alignItems: "center", gap: 8 }}>
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

        {loading && (
          <div style={{ fontSize: ".84rem", color: B.gray, fontWeight: 600 }}>
            Loading calendar...
          </div>
        )}

        {!loading && error && (
          <div style={{ fontSize: ".84rem", color: "#8A6A12", fontWeight: 700 }}>
            Unable to load calendar.
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div style={{ fontSize: ".84rem", color: B.gray, fontWeight: 600 }}>
            No scheduled work found.
          </div>
        )}

        {!loading && !error && filtered.length > 0 && view === "month" && (
          <div className="calendar-scroll-wrapper">
          <div className="calendar-month-grid" style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 8 }}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <div key={day} style={{ fontSize: ".72rem", color: B.gray, fontWeight: 700, textTransform: "uppercase", padding: "0 4px 4px" }}>{day}</div>)}
            {monthDays.map(day => (
              <div className="calendar-day-card" key={day.iso} onClick={() => pickScheduleDate(day.iso)} style={{ minHeight: 124, border: `1px solid ${(pendingResidentialDraft?.scheduled_date === day.iso || pendingBuilderSchedule?.scheduled_date === day.iso) ? B.bronze : anchorDate === day.iso ? B.green : B.border}`, borderRadius: 8, padding: 8, background: day.inMonth ? B.white : B.sand, cursor: readOnly ? "default" : "pointer", boxShadow: (pendingResidentialDraft?.scheduled_date === day.iso || pendingBuilderSchedule?.scheduled_date === day.iso) ? `inset 0 0 0 1px ${B.bronze}` : "none" }}>
                <div style={{ fontSize: ".74rem", fontWeight: 700, color: isWeekend(day.iso) ? "#922B21" : B.dark, marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                  <span>{new Date(`${day.iso}T12:00:00`).getDate()}</span>
                  <span style={{ color: (pendingResidentialDraft?.scheduled_date === day.iso || pendingBuilderSchedule?.scheduled_date === day.iso) ? B.bronze : B.gray }}>{day.events.length > 0 ? day.events.length : (pendingResidentialDraft?.scheduled_date === day.iso || pendingBuilderSchedule?.scheduled_date === day.iso) ? "Pick" : ""}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {day.events.slice(0, 3).map(event => (
                    <button className="calendar-event" key={event.id} onClick={e => { e.stopPropagation(); if (!schedulingLocked) onOpenJob(event.jobId); }} style={{ background: eventColor(event), color: B.white, border: "none", borderRadius: 6, fontSize: ".66rem", padding: "4px 6px", textAlign: "left", cursor: schedulingLocked ? "default" : "pointer" }}>
                      <div style={{ fontWeight: 700 }}>{event.customer_name || event.builder_name || event.title}</div>
                      <div style={{ opacity: .85 }}>{event.time} - Crew {findCrewById(crews, event.crew_id)?.number || "-"}</div>
                    </button>
                  ))}
                  {day.events.length > 3 && <div style={{ fontSize: ".66rem", color: B.gray }}>+{day.events.length - 3} more</div>}
                </div>
              </div>
            ))}
          </div>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && view === "week" && (
          <div className="calendar-scroll-wrapper">
          <div className="calendar-week-grid" style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 10 }}>
            {weekDays.map(day => (
              <div className="calendar-day-card" key={day.iso} onClick={() => pickScheduleDate(day.iso)} style={{ border: `1px solid ${(pendingResidentialDraft?.scheduled_date === day.iso || pendingBuilderSchedule?.scheduled_date === day.iso) ? B.bronze : anchorDate === day.iso ? B.green : B.border}`, borderRadius: 8, padding: 10, minHeight: 260, cursor: readOnly ? "default" : "pointer" }}>
                <div style={{ fontSize: ".76rem", fontWeight: 700, color: isWeekend(day.iso) ? "#922B21" : B.dark, marginBottom: 8 }}>{fmtDateShort(day.iso)}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {day.events.length === 0 && <div style={{ fontSize: ".72rem", color: B.gray }}>No scheduled work.</div>}
                  {day.events.map(event => (
                    <button className="calendar-event" key={event.id} onClick={e => { e.stopPropagation(); if (!schedulingLocked) onOpenJob(event.jobId); }} style={{ background: `${eventColor(event)}14`, color: B.dark, border: `1px solid ${eventColor(event)}30`, borderRadius: 6, padding: "8px 9px", textAlign: "left", cursor: schedulingLocked ? "default" : "pointer" }}>
                      <div style={{ fontSize: ".72rem", fontWeight: 700 }}>{event.customer_name || event.builder_name || event.title}</div>
                      <div style={{ fontSize: ".7rem", color: B.gray }}>{event.phase_label}</div>
                      <div style={{ fontSize: ".68rem", color: B.gray }}>{event.time} · Crew {findCrewById(crews, event.crew_id)?.number || "-"}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && view === "day" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {schedulingLocked && <button onClick={() => pickScheduleDate(anchorDate)} style={{ alignSelf: "flex-start", background: `${B.bronze}12`, border: `1px solid ${B.bronze}40`, color: B.bronze, borderRadius: 6, padding: "8px 12px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: ".76rem" }}>Use {fmtDate(anchorDate)} for this job</button>}
            {dayEvents.length === 0 && <div style={{ fontSize: ".82rem", color: B.gray }}>No work scheduled for {fmtDate(anchorDate)}.</div>}
            {dayEvents.map(event => (
              <Card key={event.id} className="calendar-event" style={{ padding: 14, background: `${eventColor(event)}10`, borderColor: `${eventColor(event)}35` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: ".86rem", fontWeight: 700, color: B.dark }}>{event.customer_name || event.builder_name || event.title}</div>
                    <div style={{ fontSize: ".76rem", color: B.gray }}>{event.schedule_type === "builder_slab" ? (event.community ? `${event.phase_label} · ${event.community}` : event.phase_label) : `${event.job_type} · ${event.address}`}</div>
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
      {!readOnly && pendingResidentialDraft && (
        <Card className="calendar-side-panel admin-section-card" style={{ alignSelf: "start", position: "sticky", top: 18 }}>
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
      {!readOnly && pendingBuilderSchedule && (
        <Card className="calendar-side-panel admin-section-card" style={{ alignSelf: "start", position: "sticky", top: 18 }}>
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

function JobsSection({ jobs, loading = false, error = "", onSelectJob, onCreateBuilderJob, canCreateBuilderJob = true }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [isDesktopLayout, setIsDesktopLayout] = useState(() => typeof window === "undefined" ? true : window.innerWidth >= 1180);
  const filtered = jobs.filter(job => {
    if (typeFilter !== "All" && job.schedule_type !== typeFilter) return false;
    if (statusFilter !== "All" && job.status !== statusFilter) return false;
    if (search.trim()) {
      const term = search.toLowerCase();
      return [job.customer_name, job.builder_name, job.community, job.lot_number, job.job_address, job.work_order_number].join(" ").toLowerCase().includes(term);
    }
    return true;
  });
  const desktopColumns = "minmax(0,2.1fr) minmax(130px,1fr) minmax(110px,.95fr) minmax(150px,1.1fr) minmax(110px,.8fr) minmax(150px,.95fr) 120px";

  useEffect(() => {
    const handleResize = () => {
      setIsDesktopLayout(window.innerWidth >= 1180);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const getNextScheduledPhase = job => sortBuilderPhases(job.phases || []).find(phase => phase.scheduled_date && !["Completed", "Cancelled"].includes(phase.status)) || null;
  const getTaskLabel = job => {
    if (job.schedule_type === "residential") {
      return job.scheduled_date ? "Scheduled Work" : "-";
    }

    return getNextScheduledPhase(job)?.phase_label || "-";
  };
  const getScheduledLabel = job => {
    if (job.schedule_type === "residential") {
      return job.scheduled_date ? `${fmtDate(job.scheduled_date)} · ${job.scheduled_time || "-"}` : "-";
    }

    const nextPhase = getNextScheduledPhase(job);
    return nextPhase?.scheduled_date ? `${fmtDate(nextPhase.scheduled_date)} · ${nextPhase.scheduled_time || "-"}` : "-";
  };

  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>Jobs</h1>
            <p style={{ fontSize: ".8rem", color: B.gray }}>Track accepted residential work and builder slab production jobs from scheduling through completion.</p>
          </div>
          {canCreateBuilderJob && <Btn v="green" onClick={onCreateBuilderJob}><i className="ti ti-plus" style={{ marginRight: 6 }} aria-hidden="true" />New Builder Job</Btn>}
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

      {loading && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontSize: ".84rem", color: B.gray, fontWeight: 600 }}>Loading jobs...</div>
        </Card>
      )}

      {!loading && error && (
        <Card style={{ marginBottom: 14, background: "#FFF8E1", borderColor: "#E5D7A7" }}>
          <div style={{ fontSize: ".84rem", color: "#8A6A12", fontWeight: 700 }}>Unable to load jobs.</div>
          <div style={{ fontSize: ".78rem", color: B.gray, marginTop: 4 }}>{error}</div>
        </Card>
      )}

      {!loading && !error && jobs.length === 0 && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontSize: ".84rem", color: B.gray, fontWeight: 600 }}>No jobs found.</div>
        </Card>
      )}

      {!loading && !error && jobs.length > 0 && filtered.length === 0 && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontSize: ".84rem", color: B.gray, fontWeight: 600 }}>No jobs match the current filters.</div>
        </Card>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {!loading && !error && filtered.length > 0 && isDesktopLayout && (
          <Card style={{ padding: "12px 16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: desktopColumns, gap: 12, alignItems: "center", paddingRight: 8 }}>
              {["Job", "Job Type", "Task", "Date Scheduled", "Work Order", "Status", "Action"].map(label => (
                <div key={label} style={{ fontSize: ".72rem", color: B.gray, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, textAlign: label === "Action" ? "right" : "left" }}>
                  {label}
                </div>
              ))}
            </div>
          </Card>
        )}
        {!loading && !error && filtered.map(job => (
          <Card key={job.id} style={{ padding: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: isDesktopLayout ? desktopColumns : "repeat(auto-fit,minmax(140px,1fr))", gap: 12, alignItems: "center", paddingRight: isDesktopLayout ? 8 : 0 }}>
                <div style={{ minWidth: 0, gridColumn: isDesktopLayout ? "auto" : "span 2" }}>
                  {!isDesktopLayout && <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 2 }}>Job</div>}
                  <div style={{ fontWeight: 700, fontSize: ".92rem", color: B.dark }}>
                    {job.schedule_type === "residential"
                      ? job.customer_name
                      : (job.lot_number ? `${job.builder_name} - Lot ${job.lot_number}` : (job.name || job.builder_name || "Builder Job"))}
                  </div>
                  <div style={{ fontSize: ".74rem", color: B.gray, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {job.schedule_type === "residential"
                      ? job.job_address
                      : [job.community, job.job_address].filter(Boolean).join(" - ") || job.job_address || job.community || "-"}
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  {!isDesktopLayout && <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 2 }}>Job Type</div>}
                  <div style={{ fontSize: ".82rem", fontWeight: 700, color: B.mid, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{job.schedule_type === "residential" ? job.job_type : "Builder Slab Workflow"}</div>
                </div>
                <div style={{ minWidth: 0 }}>
                  {!isDesktopLayout && <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 2 }}>Task</div>}
                  <div style={{ fontSize: ".82rem", color: B.dark, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{getTaskLabel(job)}</div>
                </div>
                <div style={{ minWidth: 0 }}>
                  {!isDesktopLayout && <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 2 }}>Date Scheduled</div>}
                  <div style={{ fontSize: ".82rem", color: B.dark, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{getScheduledLabel(job)}</div>
                </div>
                <div style={{ minWidth: 0 }}>
                  {!isDesktopLayout && <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 2 }}>Work Order</div>}
                  <div style={{ fontSize: ".82rem", color: B.dark, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{job.work_order_number || "-"}</div>
                </div>
                <div style={{ minWidth: 0 }}>
                  {!isDesktopLayout && <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 2 }}>Status</div>}
                  <div style={{ minHeight: 28, display: "flex", alignItems: "center" }}>
                    <Pill status={job.status} />
                  </div>
                </div>
                <div style={{ minWidth: 0, justifySelf: "end", textAlign: "right" }}>
                  {!isDesktopLayout && <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 2, textAlign: "right" }}>Action</div>}
                  <Btn sm v="outline" onClick={() => onSelectJob(job.id)}>Open job</Btn>
                </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function CustomersSection({
  customers,
  loading = false,
  error = "",
  tickets,
  jobs,
  onSelectCustomer,
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  statusFilter,
  onStatusFilterChange,
}) {
  const [isDesktopLayout, setIsDesktopLayout] = useState(() => typeof window === "undefined" ? true : window.innerWidth >= 1180);
  const customerCounts = useMemo(() => {
    const estimateCounts = new Map();
    const jobCounts = new Map();

    tickets.forEach(ticket => {
      if (!ticket.customerDatabaseId) return;
      estimateCounts.set(ticket.customerDatabaseId, (estimateCounts.get(ticket.customerDatabaseId) || 0) + 1);
    });

    jobs.forEach(job => {
      if (!job.customerDatabaseId) return;
      jobCounts.set(job.customerDatabaseId, (jobCounts.get(job.customerDatabaseId) || 0) + 1);
    });

    return { estimateCounts, jobCounts };
  }, [tickets, jobs]);
  const filtered = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();

    return customers.filter(customer => {
      const normalizedType = normalizeCustomerText(customer.customer_type).toLowerCase() || "residential";
      if (typeFilter !== "All" && normalizedType !== typeFilter) {
        return false;
      }

      const normalizedStatus = customer.is_active === false ? "inactive" : "active";
      if (statusFilter !== "All" && normalizedStatus !== statusFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return buildCustomerSearchText(customer).includes(normalizedQuery);
    });
  }, [customers, search, statusFilter, typeFilter]);
  const desktopColumns = "minmax(0,2fr) minmax(120px,.8fr) minmax(130px,1fr) minmax(180px,1.2fr) minmax(120px,.8fr) minmax(90px,.65fr) minmax(80px,.55fr) minmax(110px,.75fr) 120px";

  useEffect(() => {
    const handleResize = () => {
      setIsDesktopLayout(window.innerWidth >= 1180);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>Customers</h1>
            <p style={{ fontSize: ".8rem", color: B.gray }}>Browse customer records, filter by type, and review related estimates and jobs without leaving the admin workspace.</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <select value={typeFilter} onChange={e => onTypeFilterChange(e.target.value)} style={{ ...INP, width: "auto", cursor: "pointer" }}>
              <option value="All">All customer types</option>
              <option value="residential">Residential</option>
              <option value="builder">Builder</option>
              <option value="commercial">Commercial</option>
            </select>
            <select value={statusFilter} onChange={e => onStatusFilterChange(e.target.value)} style={{ ...INP, width: "auto", cursor: "pointer" }}>
              <option value="All">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: 12, position: "relative" }}>
          <i className="ti ti-search" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 15, color: B.lgray }} aria-hidden="true" />
          <input style={{ ...INP, paddingLeft: 32 }} value={search} onChange={e => onSearchChange(e.target.value)} placeholder="Search name, company, phone, email, or address..." />
        </div>
      </Card>

      {loading && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontSize: ".84rem", color: B.gray, fontWeight: 600 }}>Loading customers...</div>
        </Card>
      )}

      {!loading && error && (
        <Card style={{ marginBottom: 14, background: "#FFF8E1", borderColor: "#E5D7A7" }}>
          <div style={{ fontSize: ".84rem", color: "#8A6A12", fontWeight: 700 }}>Unable to load customers.</div>
          <div style={{ fontSize: ".78rem", color: B.gray, marginTop: 4 }}>{error}</div>
        </Card>
      )}

      {!loading && !error && customers.length === 0 && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontSize: ".84rem", color: B.gray, fontWeight: 600 }}>No customers found.</div>
        </Card>
      )}

      {!loading && !error && customers.length > 0 && filtered.length === 0 && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontSize: ".84rem", color: B.gray, fontWeight: 600 }}>No customers match the current search or filter.</div>
        </Card>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {!loading && !error && filtered.length > 0 && isDesktopLayout && (
          <Card style={{ padding: "12px 16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: desktopColumns, gap: 12, alignItems: "center", paddingRight: 8 }}>
              {["Customer", "Type", "Phone", "Email", "City", "Estimates", "Jobs", "Status", "Action"].map(label => (
                <div key={label} style={{ fontSize: ".72rem", color: B.gray, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, textAlign: label === "Action" ? "right" : "left" }}>
                  {label}
                </div>
              ))}
            </div>
          </Card>
        )}

        {!loading && !error && filtered.map(customer => {
          const displayName = formatCustomerDisplayName(customer);
          const estimateCount = customerCounts.estimateCounts.get(customer.id) || 0;
          const jobCount = customerCounts.jobCounts.get(customer.id) || 0;
          const phoneLink = formatCustomerPhoneLink(customer.phone);
          const emailLink = formatCustomerEmailLink(customer.email);

          return (
            <Card key={customer.id} style={{ padding: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: isDesktopLayout ? desktopColumns : "repeat(auto-fit,minmax(140px,1fr))", gap: 12, alignItems: "center", paddingRight: isDesktopLayout ? 8 : 0 }}>
                <div style={{ minWidth: 0, gridColumn: isDesktopLayout ? "auto" : "span 2" }}>
                  {!isDesktopLayout && <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 2 }}>Customer</div>}
                  <div style={{ fontWeight: 700, fontSize: ".92rem", color: B.dark, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName}</div>
                  <div style={{ fontSize: ".74rem", color: B.gray, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {formatDisplayField(customer.street_address)}
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  {!isDesktopLayout && <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 2 }}>Type</div>}
                  <div style={{ fontSize: ".82rem", fontWeight: 700, color: B.mid }}>{formatCustomerTypeLabel(customer.customer_type)}</div>
                </div>
                <div style={{ minWidth: 0 }}>
                  {!isDesktopLayout && <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 2 }}>Phone</div>}
                  <div style={{ fontSize: ".82rem", color: B.dark, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {phoneLink.href ? (
                      <a href={phoneLink.href} style={customerContactLinkStyle}>{phoneLink.display}</a>
                    ) : phoneLink.display}
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  {!isDesktopLayout && <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 2 }}>Email</div>}
                  <div style={{ fontSize: ".82rem", color: B.dark, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {emailLink.href ? (
                      <a href={emailLink.href} style={customerContactLinkStyle}>{emailLink.display}</a>
                    ) : emailLink.display}
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  {!isDesktopLayout && <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 2 }}>City</div>}
                  <div style={{ fontSize: ".82rem", color: B.dark, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{formatCustomerLocation(customer)}</div>
                </div>
                <div style={{ minWidth: 0 }}>
                  {!isDesktopLayout && <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 2 }}>Estimates</div>}
                  <div style={{ fontSize: ".82rem", color: B.dark }}>{estimateCount}</div>
                </div>
                <div style={{ minWidth: 0 }}>
                  {!isDesktopLayout && <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 2 }}>Jobs</div>}
                  <div style={{ fontSize: ".82rem", color: B.dark }}>{jobCount}</div>
                </div>
                <div style={{ minWidth: 0 }}>
                  {!isDesktopLayout && <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 2 }}>Status</div>}
                  <Pill status={getCustomerStatusLabel(customer)} />
                </div>
                <div style={{ minWidth: 0, justifySelf: "end", textAlign: "right" }}>
                  {!isDesktopLayout && <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 2, textAlign: "right" }}>Action</div>}
                  <Btn sm v="outline" onClick={() => onSelectCustomer(customer.id)}>View Details</Btn>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

function CustomerDetailView({
  customer,
  tickets,
  jobs,
  onBack,
  onOpenEstimate,
  onOpenJob,
  onEditCustomer,
  onDeactivateCustomer,
  onReactivateCustomer,
  canManageCustomer = false,
  customerActionBusy = false,
  customerActionError = "",
}) {
  const phoneLink = formatCustomerPhoneLink(customer.phone);
  const emailLink = formatCustomerEmailLink(customer.email);
  const relatedTickets = useMemo(
    () => tickets
      .filter(ticket => ticket.customerDatabaseId === customer.id)
      .sort((first, second) => new Date(second.at).getTime() - new Date(first.at).getTime()),
    [customer.id, tickets]
  );
  const relatedJobs = useMemo(
    () => jobs
      .filter(job => job.customerDatabaseId === customer.id)
      .sort((first, second) => `${second.scheduled_date || ""}|${second.name}`.localeCompare(`${first.scheduled_date || ""}|${first.name}`)),
    [customer.id, jobs]
  );
  const displayName = formatCustomerDisplayName(customer);

  return (
    <div style={{ minHeight: "100vh", background: "#F4F6F3" }}>
      <div style={{ background: B.dark, padding: "0 16px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,.7)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", fontSize: ".82rem" }}>
            <i className="ti ti-arrow-left" style={{ fontSize: 16 }} aria-hidden="true" />Back to customers
          </button>
          <span style={{ fontSize: ".78rem", color: "rgba(255,255,255,.72)", fontWeight: 700 }}>{formatCustomerTypeLabel(customer.customer_type)}</span>
        </div>
      </div>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px 60px" }}>
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <h1 style={{ fontSize: "1.2rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>{displayName}</h1>
              <div style={{ fontSize: ".82rem", color: B.gray }}>{formatCustomerLocation(customer)}</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Pill status={getCustomerStatusLabel(customer)} />
              <span style={{ fontSize: ".78rem", color: B.gray }}>{relatedTickets.length} estimate{relatedTickets.length === 1 ? "" : "s"}</span>
              <span style={{ fontSize: ".78rem", color: B.gray }}>{relatedJobs.length} job{relatedJobs.length === 1 ? "" : "s"}</span>
              {canManageCustomer && (
                <>
                  <Btn sm v="outline" onClick={onEditCustomer} disabled={customerActionBusy}>Edit Customer</Btn>
                  {customer.is_active !== false ? (
                    <Btn sm v="danger" onClick={onDeactivateCustomer} disabled={customerActionBusy}>Deactivate Customer</Btn>
                  ) : (
                    <Btn sm v="green" onClick={onReactivateCustomer} disabled={customerActionBusy}>Reactivate Customer</Btn>
                  )}
                </>
              )}
            </div>
          </div>
          {!!customerActionError && (
            <div style={{ marginTop: 12, fontSize: ".78rem", color: "#8A6A12", fontWeight: 700 }}>
              {customerActionError}
            </div>
          )}
        </Card>

        <div style={{ display: "grid", gridTemplateColumns: "1.05fr .95fr", gap: 16, alignItems: "start" }}>
          <Card>
            <div style={{ fontSize: ".82rem", fontWeight: 700, color: B.dark, textTransform: "uppercase", letterSpacing: .5, marginBottom: 12 }}>Customer Information</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
              {[
                ["Display name", displayName],
                ["Status", <Pill status={getCustomerStatusLabel(customer)} />],
                ["Customer type", formatCustomerTypeLabel(customer.customer_type)],
                ["First name", formatDisplayField(customer.first_name)],
                ["Last name", formatDisplayField(customer.last_name)],
                ["Company name", formatDisplayField(customer.company_name)],
                ["Phone", phoneLink.href ? <a href={phoneLink.href} style={customerContactLinkStyle}>{phoneLink.display}</a> : phoneLink.display],
                ["Email", emailLink.href ? <a href={emailLink.href} style={customerContactLinkStyle}>{emailLink.display}</a> : emailLink.display],
                ["Street address", formatDisplayField(customer.street_address)],
                ["City", formatDisplayField(customer.city)],
                ["State", formatDisplayField(customer.state)],
                ["Zip code", formatDisplayField(customer.zip_code)],
                ["Created", customer.created_at ? formatDateTime(customer.created_at) : EMPTY_FIELD],
                ["Last updated", customer.updated_at ? formatDateTime(customer.updated_at) : EMPTY_FIELD],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: ".7rem", color: B.gray, marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: ".84rem", color: B.dark, fontWeight: 700, lineHeight: 1.5 }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: ".7rem", color: B.gray, marginBottom: 4 }}>Notes</div>
              <div style={{ fontSize: ".84rem", color: B.mid, lineHeight: 1.6 }}>{formatDisplayField(customer.notes)}</div>
            </div>
          </Card>

          <Card>
            <div style={{ fontSize: ".82rem", fontWeight: 700, color: B.dark, textTransform: "uppercase", letterSpacing: .5, marginBottom: 12 }}>Related Estimates</div>
            {relatedTickets.length === 0 ? (
              <div style={{ fontSize: ".84rem", color: B.gray, fontWeight: 600 }}>No estimates are linked to this customer yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {relatedTickets.map(ticket => (
                  <div key={ticket.id} style={{ padding: "12px 14px", borderRadius: 10, border: `1px solid ${B.border}`, background: B.white }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: ".86rem", fontWeight: 700, color: B.dark }}>{ticket.ptype || "Estimate"}</div>
                        <div style={{ fontSize: ".74rem", color: B.gray, marginTop: 2 }}>{ticket.at ? fmtDateShort(ticket.at.slice(0, 10)) : EMPTY_FIELD} · {ticket.addr || EMPTY_FIELD}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <Pill status={ticket.status} />
                        <Btn sm v="outline" onClick={() => onOpenEstimate(ticket)}>View Estimate</Btn>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginTop: 10 }}>
                      <div>
                        <div style={{ fontSize: ".7rem", color: B.gray, marginBottom: 2 }}>Estimate date</div>
                        <div style={{ fontSize: ".8rem", color: B.dark }}>{ticket.at ? fmtDate(ticket.at.slice(0, 10)) : EMPTY_FIELD}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: ".7rem", color: B.gray, marginBottom: 2 }}>Job type</div>
                        <div style={{ fontSize: ".8rem", color: B.dark }}>{ticket.ptype || EMPTY_FIELD}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: ".7rem", color: B.gray, marginBottom: 2 }}>Estimated amount</div>
                        <div style={{ fontSize: ".8rem", color: B.dark }}>{formatEstimateAmountLabel(ticket)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card style={{ marginTop: 16 }}>
          <div style={{ fontSize: ".82rem", fontWeight: 700, color: B.dark, textTransform: "uppercase", letterSpacing: .5, marginBottom: 12 }}>Related Jobs</div>
          {relatedJobs.length === 0 ? (
            <div style={{ fontSize: ".84rem", color: B.gray, fontWeight: 600 }}>No jobs are linked to this customer yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {relatedJobs.map(job => (
                <div key={job.id} style={{ padding: "12px 14px", borderRadius: 10, border: `1px solid ${B.border}`, background: B.white }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: ".86rem", fontWeight: 700, color: B.dark }}>{getCustomerJobDisplayName(job)}</div>
                      <div style={{ fontSize: ".74rem", color: B.gray, marginTop: 2 }}>{job.job_address || EMPTY_FIELD}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <Pill status={job.status} />
                      <Btn sm v="outline" onClick={() => onOpenJob(job.id)}>View Job</Btn>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginTop: 10 }}>
                    <div>
                      <div style={{ fontSize: ".7rem", color: B.gray, marginBottom: 2 }}>Job type</div>
                      <div style={{ fontSize: ".8rem", color: B.dark }}>{job.job_type || EMPTY_FIELD}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: ".7rem", color: B.gray, marginBottom: 2 }}>Date scheduled</div>
                      <div style={{ fontSize: ".8rem", color: B.dark }}>{getCustomerJobScheduledLabel(job)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: ".7rem", color: B.gray, marginBottom: 2 }}>PO number</div>
                      <div style={{ fontSize: ".8rem", color: B.dark }}>{getCustomerJobReference(job)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function CustomerEditModal({ customer, saving = false, error = "", onClose, onSave }) {
  const [local, setLocal] = useState(() => buildCustomerEditDraft(customer));
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    setLocal(buildCustomerEditDraft(customer));
    setValidationError("");
  }, [customer]);

  const submit = () => {
    const nextValidationError = validateCustomerEditDraft(local);
    if (nextValidationError) {
      setValidationError(nextValidationError);
      return;
    }

    setValidationError("");
    onSave(local);
  };

  return (
    <Modal title="Edit Customer" onClose={onClose} width={760}>
      {(validationError || error) && (
        <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 10, background: "#FFF8E1", border: "1px solid #E5D7A7", fontSize: ".8rem", color: "#8A6A12", fontWeight: 700 }}>
          {validationError || error}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
        <div>
          <label style={labelStyle}>First Name</label>
          <input style={INP} value={local.first_name} onChange={e => setLocal(prev => ({ ...prev, first_name: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>Last Name</label>
          <input style={INP} value={local.last_name} onChange={e => setLocal(prev => ({ ...prev, last_name: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>Company Name</label>
          <input style={INP} value={local.company_name} onChange={e => setLocal(prev => ({ ...prev, company_name: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>Customer Type</label>
          <select style={{ ...INP, cursor: "pointer" }} value={local.customer_type} onChange={e => setLocal(prev => ({ ...prev, customer_type: e.target.value }))}>
            <option value="residential">Residential</option>
            <option value="builder">Builder</option>
            <option value="commercial">Commercial</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Phone</label>
          <input style={INP} value={local.phone} onChange={e => setLocal(prev => ({ ...prev, phone: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>Email</label>
          <input style={INP} value={local.email} onChange={e => setLocal(prev => ({ ...prev, email: e.target.value }))} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Street Address</label>
          <input style={INP} value={local.street_address} onChange={e => setLocal(prev => ({ ...prev, street_address: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>City</label>
          <input style={INP} value={local.city} onChange={e => setLocal(prev => ({ ...prev, city: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>State</label>
          <input style={INP} value={local.state} onChange={e => setLocal(prev => ({ ...prev, state: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>Zip Code</label>
          <input style={INP} value={local.zip_code} onChange={e => setLocal(prev => ({ ...prev, zip_code: e.target.value }))} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Notes</label>
          <textarea style={{ ...INP, minHeight: 96 }} value={local.notes} onChange={e => setLocal(prev => ({ ...prev, notes: e.target.value }))} />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
        <Btn v="outline" onClick={onClose} disabled={saving}>Cancel</Btn>
        <Btn v="green" onClick={submit} disabled={saving}>{saving ? "Saving..." : "Save Customer"}</Btn>
      </div>
    </Modal>
  );
}

function CustomerDeactivateModal({ customer, saving = false, error = "", onClose, onConfirm }) {
  return (
    <Modal title="Deactivate Customer" onClose={onClose} width={560}>
      <div style={{ fontSize: ".84rem", color: B.mid, lineHeight: 1.6 }}>
        This customer will remain linked to all estimates and jobs. They can be reactivated later.
      </div>
      <div style={{ marginTop: 8, fontSize: ".78rem", color: B.gray }}>
        {formatCustomerDisplayName(customer)}
      </div>
      {!!error && (
        <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "#FFF8E1", border: "1px solid #E5D7A7", fontSize: ".8rem", color: "#8A6A12", fontWeight: 700 }}>
          {error}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
        <Btn v="outline" onClick={onClose} disabled={saving}>Cancel</Btn>
        <Btn v="danger" onClick={onConfirm} disabled={saving}>{saving ? "Deactivating..." : "Deactivate Customer"}</Btn>
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

function JobDetailView({ job, crews, onBack, onSaveJob, onOpenPhaseEdit, onOpenPhaseDetails, readOnly = false, latestRescheduleReasons = {}, profileDisplayNames = {} }) {
  const crew = findCrewById(crews, job.crew_id);
  const builderHeading = [job.builder_name, job.community, job.lot_number ? `Lot ${job.lot_number}` : ""].filter(Boolean).join(" - ") || job.name || "Builder Job";
  const residentialLastRescheduleReason = job.scheduleEventDatabaseId
    ? (job.last_reschedule_reason || latestRescheduleReasons[job.scheduleEventDatabaseId] || "")
    : "";
  const residentialLastRescheduledBy = job.last_rescheduled_by
    ? (String(profileDisplayNames[job.last_rescheduled_by] || "").trim() || "Unknown user")
    : "";
  return (
    <div style={{ minHeight: "100vh", background: "#F4F6F3" }}>
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
              <h1 style={{ fontSize: "1.2rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>{job.schedule_type === "residential" ? job.customer_name : builderHeading}</h1>
              <div style={{ fontSize: ".82rem", color: B.gray }}>{job.job_address}</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {job.schedule_type === "residential" && <span style={{ fontSize: ".78rem", color: B.gray }}>Work order {job.work_order_number || "-"}</span>}
              {crew && <span style={{ fontSize: ".78rem", color: B.gray }}>Crew {getCrewNumber(crew)}</span>}
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
              {residentialLastRescheduleReason && <div style={{ marginTop: 12, fontSize: ".74rem", color: B.gray }}>Last reschedule reason: {residentialLastRescheduleReason}</div>}
              {residentialLastRescheduledBy && <div style={{ marginTop: 6, fontSize: ".74rem", color: B.gray }}>Last rescheduled by: {residentialLastRescheduledBy}</div>}
              {job.last_rescheduled_at && <div style={{ marginTop: 6, fontSize: ".74rem", color: B.gray }}>Last rescheduled at: {formatDateTime(job.last_rescheduled_at)}</div>}
              {job.notes && <div style={{ marginTop: 14, fontSize: ".8rem", color: B.mid, lineHeight: 1.6 }}>{job.notes}</div>}
            </Card>
            {!readOnly && (
              <Card>
                <div style={{ fontSize: ".82rem", fontWeight: 700, color: B.dark, textTransform: "uppercase", letterSpacing: .5, marginBottom: 12 }}>Actions</div>
                <Btn full v="outline" onClick={() => onOpenPhaseEdit(job.id, null)}><i className="ti ti-calendar-time" style={{ marginRight: 6 }} aria-hidden="true" />{job.scheduleEventDatabaseId ? "Reschedule Job" : "Schedule Job"}</Btn>
                <div style={{ height: 10 }} />
                <Btn full v="green" onClick={() => onSaveJob({ ...job, status: "Completed" })}><i className="ti ti-check" style={{ marginRight: 6 }} aria-hidden="true" />Mark Completed</Btn>
                <div style={{ height: 10 }} />
                <Btn full v="outline" onClick={() => onSaveJob({ ...job, status: "Delayed" })}><i className="ti ti-clock-exclamation" style={{ marginRight: 6 }} aria-hidden="true" />Mark Delayed</Btn>
              </Card>
            )}
          </div>
        ) : (
          <Card>
            <div style={{ fontSize: ".82rem", fontWeight: 700, color: B.dark, textTransform: "uppercase", letterSpacing: .5, marginBottom: 12 }}>Builder Slab Workflow</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sortBuilderPhases(job.phases || []).map((phase, idx) => (
                <div key={phase.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, alignItems: "center", padding: "12px 10px", border: `1px solid ${B.border}`, borderRadius: 8, background: phase.counts_toward_crew ? B.white : B.sand }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: ".84rem", fontWeight: 700, color: B.dark }}>{idx + 1}. {phase.phase_label}</div>
                      <div style={{ fontSize: ".72rem", color: B.gray }}>{phase.responsible_party}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: ".7rem", color: B.gray, marginBottom: 2 }}>Scheduled</div>
                      <div style={{ fontSize: ".8rem", color: B.dark }}>{phase.scheduled_date ? `${fmtDate(phase.scheduled_date)} - ${phase.scheduled_time || "-"}` : "Not scheduled"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: ".7rem", color: B.gray, marginBottom: 2 }}>Crew / capacity</div>
                      <div style={{ fontSize: ".8rem", color: B.dark }}>
                        {phase.crew_id ? `Crew ${findCrewById(crews, phase.crew_id)?.number || "-"}` : "Dependency task"}
                        {phase.crew_id && ` - ${fmtCap(phase.day_capacity_used)}`}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: ".7rem", color: B.gray, marginBottom: 2 }}>Work order</div>
                      <div style={{ fontSize: ".8rem", color: B.dark }}>{phase.work_order_number || "-"}</div>
                    </div>
                    {(phase.last_reschedule_reason || latestRescheduleReasons[phase.scheduleEventDatabaseId]) && (
                      <div>
                        <div style={{ fontSize: ".7rem", color: B.gray, marginBottom: 2 }}>Last reschedule reason</div>
                        <div style={{ fontSize: ".8rem", color: B.dark }}>{phase.last_reschedule_reason || latestRescheduleReasons[phase.scheduleEventDatabaseId]}</div>
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <Pill status={phase.status} />
                    <Btn sm v="outline" onClick={() => onOpenPhaseDetails(job.id, phase.id)}>View Details</Btn>
                    {!readOnly && <Btn sm v="outline" onClick={() => onOpenPhaseEdit(job.id, phase.id)}>{phase.scheduleEventDatabaseId ? "Edit Phase" : "Schedule Phase"}</Btn>}
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
  const existingReason = String(local.last_reschedule_reason || "").trim();
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
        {!!local.scheduleEventDatabaseId && (
          <RescheduleReasonInput
            value={local.reschedule_reason || ""}
            onChange={nextReason => setLocal(prev => ({ ...prev, reschedule_reason: nextReason }))}
            helperText={existingReason ? `Required only when changing the scheduled date or time. Last saved reschedule reason: ${existingReason}` : "Required only when changing the scheduled date or time."}
          />
        )}
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

function RescheduleReasonInput({ value, onChange, helperText = "", required = false }) {
  const initialState = parseRescheduleReasonDraft(value);
  const [preset, setPreset] = useState(initialState.preset);
  const [customReason, setCustomReason] = useState(initialState.custom);

  useEffect(() => {
    const nextState = parseRescheduleReasonDraft(value);
    setPreset(nextState.preset);
    setCustomReason(nextState.custom);
  }, [value]);

  return (
    <div style={{ gridColumn: "1 / -1" }}>
      <label style={labelStyle}>Reason for rescheduling</label>
      <select
        style={{ ...INP, cursor: "pointer" }}
        value={preset}
        onChange={e => {
          const nextPreset = e.target.value;
          setPreset(nextPreset);
          onChange(buildRescheduleReasonValue(nextPreset, customReason));
        }}
      >
        <option value="">{required ? "Select a required reason" : "No reason selected"}</option>
        {STANDARD_RESCHEDULE_REASONS.map(reason => <option key={reason} value={reason}>{reason}</option>)}
      </select>
      {preset === "Other" && (
        <textarea
          style={{ ...INP, minHeight: 90, marginTop: 10 }}
          maxLength={500}
          value={customReason}
          onChange={e => {
            const nextCustomReason = e.target.value;
            setCustomReason(nextCustomReason);
            onChange(buildRescheduleReasonValue("Other", nextCustomReason));
          }}
          placeholder="Enter the reschedule reason."
        />
      )}
      {helperText && <div style={{ fontSize: ".72rem", color: B.gray, marginTop: 4 }}>{helperText}</div>}
    </div>
  );
}

function PhaseEditModal({ draft, crews, onClose, onSave, isResidential }) {
  const [local, setLocal] = useState(draft);
  const existingReason = String(local.last_reschedule_reason || "").trim();
  return (
    <Modal title={isResidential ? "Reschedule Residential Job" : `Edit ${draft.phase_label}`} onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label style={labelStyle}>Scheduled date</label><input style={INP} type="date" value={local.scheduled_date} onChange={e => setLocal(prev => ({ ...prev, scheduled_date: e.target.value }))} /></div>
        <div><label style={labelStyle}>Scheduled time</label><input style={INP} type="time" value={local.scheduled_time} onChange={e => setLocal(prev => ({ ...prev, scheduled_time: e.target.value }))} /></div>
        <div><label style={labelStyle}>Crew</label><select style={{ ...INP, cursor: "pointer" }} value={local.crew_id} onChange={e => setLocal(prev => ({ ...prev, crew_id: e.target.value }))}>{crews.map(crew => <option key={crew.id} value={crew.id}>{crew.name}</option>)}</select></div>
        <div><label style={labelStyle}>Status</label><select style={{ ...INP, cursor: "pointer" }} value={local.status} onChange={e => setLocal(prev => ({ ...prev, status: e.target.value }))}>{JOB_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}</select></div>
        <div><label style={labelStyle}>Day capacity used</label><input style={INP} type="number" step="0.25" value={local.day_capacity_used} onChange={e => setLocal(prev => ({ ...prev, day_capacity_used: Number(e.target.value || 0) }))} /></div>
        <div><label style={labelStyle}>Responsible party</label><input disabled style={{ ...INP, background: "#F5F5F3" }} value={local.responsible_party || "Southern Oak Concrete"} /></div>
        {!!local.scheduleEventDatabaseId && (
          <RescheduleReasonInput
            value={local.reschedule_reason || ""}
            onChange={nextReason => setLocal(prev => ({ ...prev, reschedule_reason: nextReason }))}
            helperText="A fresh reason is required only when this update changes the scheduled date or time."
          />
        )}
        <div style={{ gridColumn: "1 / -1" }}><label style={labelStyle}>Notes</label><textarea style={{ ...INP, minHeight: 90 }} value={local.notes || ""} onChange={e => setLocal(prev => ({ ...prev, notes: e.target.value }))} /></div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ fontSize: ".76rem", color: B.gray }}>
          {!isResidential ? "If this phase is pushed later, following phases will move forward automatically and skip weekends." : ""}
          {existingReason ? `${!isResidential ? " " : ""}Last saved reschedule reason: ${existingReason}` : ""}
        </div>
        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          <Btn v="outline" onClick={onClose}>Cancel</Btn>
          <Btn v="green" onClick={() => onSave(local)}>Save Schedule</Btn>
        </div>
      </div>
    </Modal>
  );
}

function BuilderWorkflowScheduleModal({ draft, crews, onClose, onSave }) {
  const [local, setLocal] = useState(draft);

  useEffect(() => {
    setLocal(draft);
  }, [draft]);

  const updatePhase = (index, patch, options = {}) => {
    setLocal(prev => {
      const nextPhases = (prev.phases || []).map((phase, phaseIndex) =>
        phaseIndex === index
          ? { ...phase, ...patch }
          : phase
      );

      const recalculatedPhases = options.recalculate
        ? recalculateWorkflowPhaseDates(nextPhases, index)
        : nextPhases;

      return {
        ...prev,
        phases: recalculatedPhases,
      };
    });
  };

  return (
    <Modal title="Confirm Builder Workflow Schedule" onClose={onClose} width={920}>
      <div style={{ fontSize: ".82rem", color: B.gray, marginBottom: 14 }}>
        Form Slab uses the selected date. Prep Slab defaults one working day later, and Pour Slab defaults one working day after Prep Slab.
      </div>
      <div style={{ fontSize: ".92rem", fontWeight: 700, color: B.dark }}>{local.builder_name || "Builder Job"}</div>
      <div style={{ fontSize: ".78rem", color: B.gray, marginBottom: 16 }}>
        {[local.community, local.lot_number ? `Lot ${local.lot_number}` : "", local.job_address].filter(Boolean).join(" · ") || "Builder slab workflow"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {(local.phases || []).map((phase, index) => (
          <div key={phase.id} style={{ border: `1px solid ${B.border}`, borderRadius: 10, padding: 14, background: B.white }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: ".92rem", fontWeight: 700, color: B.dark }}>{index + 1}. {phase.phase_label}</div>
                <div style={{ fontSize: ".74rem", color: B.gray }}>{phase.responsible_party}</div>
              </div>
              <div style={{ fontSize: ".74rem", color: B.gray }}>
                {phase.scheduleEventDatabaseId ? `Saved ${phase.work_order_number || ""}` : "Not yet saved"}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
              <div>
                <label style={labelStyle}>Scheduled date</label>
                <input
                  style={INP}
                  type="date"
                  value={phase.scheduled_date || ""}
                  onChange={e => updatePhase(index, { scheduled_date: e.target.value, manual_date_override: index > 0 }, { recalculate: true })}
                />
              </div>
              <div>
                <label style={labelStyle}>Start time</label>
                <input
                  style={INP}
                  type="time"
                  value={phase.scheduled_time || ""}
                  onChange={e => updatePhase(index, { scheduled_time: e.target.value })}
                />
              </div>
              <div>
                <label style={labelStyle}>Crew</label>
                <select
                  style={{ ...INP, cursor: "pointer" }}
                  value={phase.crew_id || ""}
                  onChange={e => updatePhase(index, { crew_id: e.target.value })}
                >
                  {crews.map(crew => <option key={crew.id} value={crew.id}>{crew.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select
                  style={{ ...INP, cursor: "pointer" }}
                  value={phase.status || "Scheduled"}
                  onChange={e => updatePhase(index, { status: e.target.value })}
                >
                  {JOB_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Notes</label>
              <textarea
                style={{ ...INP, minHeight: 84 }}
                value={phase.notes || ""}
                onChange={e => updatePhase(index, { notes: e.target.value })}
              />
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: ".76rem", color: B.gray }}>Dates recalculate only for later phases that you have not manually overridden.</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn v="outline" onClick={onClose}>Cancel</Btn>
          <Btn v="green" onClick={() => onSave(local)}>Save All Phases</Btn>
        </div>
      </div>
    </Modal>
  );
}

function BuilderPhaseDetailsModal({ detail, crews, profileDisplayNames = {}, onClose, onSchedule, onEdit, onReschedule }) {
  const crew = findCrewById(crews, detail.phase.crew_id);
  const lastRescheduledBy = detail.phase.last_rescheduled_by
    ? (String(profileDisplayNames[detail.phase.last_rescheduled_by] || "").trim() || "Unknown user")
    : "-";
  const values = [
    ["Phase", detail.phase.phase_label],
    ["Work order", detail.phase.work_order_number || "-"],
    ["Builder", detail.builder_name || "-"],
    ["Community", detail.community || "-"],
    ["Lot number", detail.lot_number || "-"],
    ["Scheduled date", detail.phase.scheduled_date ? fmtDate(detail.phase.scheduled_date) : "-"],
    ["Start time", detail.phase.scheduled_time || "-"],
    ["End time", detail.phase.end_time || "-"],
    ["Crew", crew ? crew.name : "-"],
    ["Status", detail.phase.status || "-"],
    ["Latest reschedule reason", detail.phase.last_reschedule_reason || "-"],
    ["Last rescheduled at", formatDateTime(detail.phase.last_rescheduled_at)],
    ["Last rescheduled by", lastRescheduledBy],
  ];

  return (
    <Modal title={detail.phase.phase_label} onClose={onClose} width={720}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
        {values.map(([label, value]) => (
          <div key={label}>
            <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: ".85rem", color: B.dark, fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 4 }}>Notes</div>
        <div style={{ fontSize: ".84rem", color: B.mid, lineHeight: 1.6 }}>{detail.phase.notes || "-"}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
        {!detail.phase.scheduleEventDatabaseId && <Btn v="green" onClick={onSchedule}>Schedule Phase</Btn>}
        {!!detail.phase.scheduleEventDatabaseId && <Btn v="outline" onClick={onEdit}>Edit Phase</Btn>}
        {!!detail.phase.scheduleEventDatabaseId && <Btn v="green" onClick={onReschedule}>Reschedule Phase</Btn>}
      </div>
    </Modal>
  );
}

function PushSummaryModal({ preview, onClose, onConfirm }) {
  const [rescheduleReason, setRescheduleReason] = useState(preview.reschedule_reason || "");
  const requiresRescheduleReason = !!preview.requiresRescheduleReason;
  const conflictCount = preview.summary.filter(item => item.conflict).length;
  return (
    <Modal title="Confirm Builder Schedule Push" onClose={onClose} width={860}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginBottom: 16 }}>
        <Card style={{ padding: 14, background: B.white }}>
          <div style={{ fontSize: ".72rem", color: B.gray, textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>Phases affected</div>
          <div style={{ fontSize: "1.2rem", fontWeight: 700, color: B.dark }}>{preview.summary.length}</div>
        </Card>
        <Card style={{ padding: 14, background: conflictCount ? "#FFF6F4" : "#F5FBF6", borderColor: conflictCount ? "#F0C1B8" : "#CFE5D2" }}>
          <div style={{ fontSize: ".72rem", color: B.gray, textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>Conflicts</div>
          <div style={{ fontSize: "1.2rem", fontWeight: 700, color: conflictCount ? "#922B21" : B.green }}>{conflictCount}</div>
        </Card>
        <Card style={{ padding: 14, background: B.white }}>
          <div style={{ fontSize: ".72rem", color: B.gray, textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>Weekend rule</div>
          <div style={{ fontSize: ".88rem", fontWeight: 700, color: B.dark }}>Saturdays and Sundays are skipped</div>
        </Card>
      </div>
      <div style={{ fontSize: ".8rem", color: B.gray, marginBottom: 12 }}>Review the proposed date changes below before saving the push-forward update.</div>
      <div style={{ overflowX: "auto", border: `1px solid ${B.border}`, borderRadius: 10, background: B.white, padding: 6 }}>
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
      {requiresRescheduleReason && (
        <Card style={{ marginTop: 16, padding: 16, background: "#FFF8F2", borderColor: "#E7C89A" }}>
          <div style={{ fontSize: ".8rem", fontWeight: 700, color: B.dark, marginBottom: 8 }}>Reschedule Reason Required</div>
          <div style={{ fontSize: ".76rem", color: B.gray, marginBottom: 10 }}>One or more existing scheduled phases are moving, so this push-forward update needs a standardized reason.</div>
          <RescheduleReasonInput
            value={rescheduleReason}
            onChange={setRescheduleReason}
            required
          />
        </Card>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <Btn v="outline" onClick={onClose}>Cancel</Btn>
        <Btn v="green" onClick={() => onConfirm(rescheduleReason)}>Apply Schedule Push</Btn>
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
              <div style={{ fontWeight: 700, color: "#922B21" }}>Crew {getCrewNumber(conflict.crew) || "-"} capacity would hit {conflict.capacityTotal.toFixed(2)} / {conflict.capacityLimit.toFixed(2)} day</div>
              <div style={{ fontSize: ".76rem", color: B.gray }}>{fmtDate(conflict.candidate.date)} - {conflict.candidate.time}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 8 }}>
              {conflict.conflictingEvents.map(event => (
                <div key={event.id} style={{ padding: "8px 10px", borderRadius: 6, background: B.white, border: "1px solid #F2D7D5" }}>
                  <div style={{ fontSize: ".78rem", fontWeight: 700, color: B.dark }}>{event.phase_label}</div>
                  <div style={{ fontSize: ".72rem", color: B.gray }}>{event.schedule_type === "builder_slab" ? `${event.builder_name} - ${event.community || ""} Lot ${event.lot_number || ""}` : `${event.customer_name}`}</div>
                  <div style={{ fontSize: ".72rem", color: B.gray }}>{event.address || "-"} {event.work_order_number ? ` - ${event.work_order_number}` : ""}</div>
                  <div style={{ fontSize: ".72rem", color: B.gray }}>{event.time} - {fmtCap(event.capacity_used)} - {event.status}</div>
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

const thStyle = { padding: "8px 10px", borderBottom: "1px solid var(--color-border-tertiary)" };
const tdStyle = { padding: "10px", borderBottom: "1px solid #F1EEE7", fontSize: ".78rem", color: B.mid };

export default function AdminWorkspace({
  appRole,
  profileFullName = "",
  userEmail = "",
  tickets,
  ticketsLoading = false,
  ticketsError = "",
  onUpdateTicket,
  onLogout,
  setPage,
}) {
  const allowedSections = useMemo(() => getAllowedAdminSections(appRole), [appRole]);
  const defaultSection = getDefaultAdminSection(appRole);
  const [section, setSection] = useState(() => {
    const savedSection = typeof window !== "undefined"
      ? window.sessionStorage.getItem(ADMIN_SECTION_STORAGE_KEY)
      : "";
    return savedSection || defaultSection;
  });
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedCalendarJobId, setSelectedCalendarJobId] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [crews, setCrews] = useState([]);
  const jobsAccessEnabled = appRole !== "field";
  const customersAccessEnabled = canAccessEstimates(appRole);
  const builderAccessEnabled = hasFullAccess(appRole) || appRole === "office";
  const { builders, buildersLoading, buildersError, createBuilder, getBuilderCreateError } = useBuilders(builderAccessEnabled);
  const {
    customers,
    loading: customersLoading,
    error: customersError,
    updateCustomer: updateStoredCustomer,
    setCustomerActive: setStoredCustomerActive,
  } = useCustomers(customersAccessEnabled);
  const {
    jobs,
    loading: jobsLoading,
    error: jobsError,
    refreshJobs,
    updateJob: updateStoredJob,
    createBuilderJob: createStoredBuilderJob,
  } = useJobs(jobsAccessEnabled, builders);
  const {
    rows: scheduleRows,
    events: scheduleEvents,
    calendarJobs,
    loading: scheduleLoading,
    error: scheduleError,
    refreshScheduleEvents,
    createEvent: createScheduleEvent,
    updateEvent: updateScheduleEvent,
    findJobIdByEstimateId,
  } = useScheduleEvents(canViewCalendar(appRole));
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [scheduleHistory, setScheduleHistory] = useState([]);
  const [overrideHistory, setOverrideHistory] = useState([]);
  const [latestRescheduleReasons, setLatestRescheduleReasons] = useState({});
  const [profileDisplayNames, setProfileDisplayNames] = useState({});
  const [residentialDraft, setResidentialDraft] = useState(null);
  const [builderScheduleDraft, setBuilderScheduleDraft] = useState(null);
  const [builderWorkflowDraft, setBuilderWorkflowDraft] = useState(null);
  const [builderDraft, setBuilderDraft] = useState(null);
  const [builderRecordDraft, setBuilderRecordDraft] = useState(null);
  const [customerEditOpen, setCustomerEditOpen] = useState(false);
  const [customerEditSaving, setCustomerEditSaving] = useState(false);
  const [customerEditError, setCustomerEditError] = useState("");
  const [customerDeactivateOpen, setCustomerDeactivateOpen] = useState(false);
  const [customerLifecycleSaving, setCustomerLifecycleSaving] = useState(false);
  const [customerLifecycleError, setCustomerLifecycleError] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerTypeFilter, setCustomerTypeFilter] = useState("All");
  const [customerStatusFilter, setCustomerStatusFilter] = useState("All");
  const [phaseDraft, setPhaseDraft] = useState(null);
  const [phaseDetailState, setPhaseDetailState] = useState(null);
  const [pushPreview, setPushPreview] = useState(null);
  const [conflictState, setConflictState] = useState(null);
  const [weekendOverrideState, setWeekendOverrideState] = useState(null);
  const [warningState, setWarningState] = useState(null);
  const [financeView, setFinanceView] = useState("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const selectedTicket = tickets.find(ticket => ticket.id === selectedTicketId) || null;
  const selectedCustomer = customers.find(customer => customer.id === selectedCustomerId) || null;
  const canManageCustomers = customersAccessEnabled;
  const findLoadedResidentialScheduleRow = jobDatabaseId => {
    if (!jobDatabaseId) return null;
    return scheduleRows.find(row => row.job_id === jobDatabaseId && row.builder_step === "residential_job") || null;
  };
  const resolveResidentialScheduleRow = (jobDatabaseId, scheduleEventDatabaseId = "") => {
    if (!jobDatabaseId) return null;
    if (scheduleEventDatabaseId) {
      const matchedById = scheduleRows.find(row => row.id === scheduleEventDatabaseId && row.job_id === jobDatabaseId && row.builder_step === "residential_job");
      if (matchedById) {
        return matchedById;
      }
    }
    return findLoadedResidentialScheduleRow(jobDatabaseId);
  };
  useEffect(() => {
    if (!selectedCustomer) {
      setCustomerEditOpen(false);
      setCustomerDeactivateOpen(false);
      setCustomerEditSaving(false);
      setCustomerLifecycleSaving(false);
      setCustomerEditError("");
      setCustomerLifecycleError("");
    }
  }, [selectedCustomer]);
  const hydrateResidentialJob = job => {
    if (!job || job.schedule_type !== "residential") {
      return job;
    }

    const resolvedScheduleRow = resolveResidentialScheduleRow(job.databaseId || "", job.scheduleEventDatabaseId || "");
    if (!resolvedScheduleRow) {
      return job;
    }

    return {
      ...job,
      scheduleEventDatabaseId: job.scheduleEventDatabaseId || resolvedScheduleRow.id,
      scheduled_date: resolvedScheduleRow.scheduled_date || job.scheduled_date,
      scheduled_time: resolvedScheduleRow.start_time ? resolvedScheduleRow.start_time.slice(0, 5) : (job.scheduled_time || ""),
      crew_id: resolvedScheduleRow.crew_id || job.crew_id,
      status: databaseStatusToCalendarStatus(resolvedScheduleRow.status),
      notes: resolvedScheduleRow.notes || job.notes,
      last_reschedule_reason: resolvedScheduleRow.last_reschedule_reason || job.last_reschedule_reason || "",
    };
  };
  const getResidentialScheduleEventId = (jobDatabaseId, scheduleEventDatabaseId = "") =>
    scheduleEventDatabaseId || resolveResidentialScheduleRow(jobDatabaseId, scheduleEventDatabaseId)?.id || "";
  const isResidentialScheduleUniqueViolation = error => {
    const summary = error?.supabaseError;
    const text = `${summary?.message || ""} ${summary?.details || ""} ${summary?.hint || ""}`.toLowerCase();
    return summary?.code === "23505" && text.includes("schedule_events_residential_job_unique_idx");
  };
  const selectedJob = hydrateResidentialJob(jobs.find(job => job.id === selectedJobId) || null);
  const selectedCalendarJob = calendarJobs.find(job => job.id === selectedCalendarJobId) || null;
  const allEvents = useMemo(() => buildCalendarEvents(jobs), [jobs]);
  const activeConflicts = useMemo(() => detectCrewConflicts({ candidateEvents: [], jobs, crews }), [jobs, crews]);
  const calendarReadOnly = !canManageCalendar(appRole);
  const canManageSchedule = canManageCalendar(appRole);
  const canResolveProfileDisplayNames = hasFullAccess(appRole) || appRole === "office";
  const scheduledEstimateDatabaseIds = useMemo(
    () => new Set(calendarJobs.map(job => job.estimate_database_id).filter(Boolean)),
    [calendarJobs]
  );
  const rescheduledByUserIds = useMemo(
    () => Array.from(new Set(
      scheduleRows
        .map(row => row.last_rescheduled_by)
        .filter(value => typeof value === "string" && value.trim())
    )),
    [scheduleRows]
  );

  useEffect(() => {
    if (!allowedSections.some(item => item.id === section)) {
      setSection(defaultSection);
      setSelectedTicketId(null);
      setSelectedJobId(null);
      setSelectedCalendarJobId(null);
      setSelectedCustomerId(null);

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(ADMIN_SECTION_STORAGE_KEY, defaultSection);
      }
    }
  }, [allowedSections, defaultSection, section]);

  useEffect(() => {
    if (!allowedSections.some(item => item.id === section)) return;

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(ADMIN_SECTION_STORAGE_KEY, section);
    }
  }, [allowedSections, section]);

  useEffect(() => {
    if (!jobsAccessEnabled) return;
    void refreshJobs();
  }, [
    jobsAccessEnabled,
    refreshJobs,
    scheduleRows.map(row => `${row.id}:${row.updated_at || row.created_at}`).join("|"),
  ]);

  useEffect(() => {
    if (!canResolveProfileDisplayNames || rescheduledByUserIds.length === 0) {
      setProfileDisplayNames({});
      return;
    }

    let cancelled = false;

    const loadProfileDisplayNames = async () => {
      try {
        const rows = await fetchProfileDisplayNames(rescheduledByUserIds);
        if (cancelled) return;

        const nextMap = rows.reduce((accumulator, row) => ({
          ...accumulator,
          [row.id]: row.full_name,
        }), {});

        setProfileDisplayNames(nextMap);
      } catch (error) {
        console.error("Unable to load profile display names:", error);
        if (!cancelled) {
          setProfileDisplayNames({});
        }
      }
    };

    void loadProfileDisplayNames();

    return () => {
      cancelled = true;
    };
  }, [canResolveProfileDisplayNames, rescheduledByUserIds]);

  useEffect(() => {
    let cancelled = false;

    const loadCrews = async () => {
      const { data, error } = await supabase
        .from("crews")
        .select("*");

      if (cancelled) return;

      if (error) {
        console.error("Unable to load crews:", error);
        setCrews([]);
        return;
      }

      const databaseCrews = (data || [])
        .map(databaseCrewToAppCrew)
        .sort((firstCrew, secondCrew) => firstCrew.crewNumber - secondCrew.crewNumber);

      setCrews(databaseCrews);
    };

    void loadCrews();

    return () => {
      cancelled = true;
    };
  }, []);

  const createCrew = async crew => {
    const { data, error } = await supabase
      .from("crews")
      .insert(appCrewToDatabaseCrew(crew))
      .select("*")
      .single();

    if (error) {
      console.error("Unable to create crew:", error);
      window.alert(`Crew could not be created: ${error.message}`);
      return false;
    }

    const savedCrew = databaseCrewToAppCrew(data, crews.length);
    setCrews(prev => [...prev, savedCrew].sort((a, b) => a.crewNumber - b.crewNumber));
    return true;
  };

  const updateCrew = async (crewId, patch) => {
    const currentCrew = crews.find(crew => crew.id === crewId);

    if (!currentCrew) {
      console.error("Unable to update crew: crew not found", crewId);
      return false;
    }

    const mergedCrew = normalizeCrew({ ...currentCrew, ...patch });

    const { data, error } = await supabase
      .from("crews")
      .update(appCrewToDatabaseCrew(mergedCrew))
      .eq("id", crewId)
      .select("*")
      .single();

    if (error) {
      console.error("Unable to update crew:", error);
      window.alert(`Crew could not be updated: ${error.message}`);
      return false;
    }

    const savedCrew = databaseCrewToAppCrew(data);
    setCrews(prev => prev
      .map(crew => crew.id === crewId ? savedCrew : crew)
      .sort((a, b) => a.crewNumber - b.crewNumber));
    return true;
  };

  const openBuilderJobModal = () => {
    if (!canManageSchedule) return;
    if (!builders.length) {
      window.alert("Add a builder first before creating a builder job.");
      return;
    }
    setBuilderDraft({ builder_id: builders[0]?.id || "", community: "", lot_number: "", job_address: "", work_order_number: "", crew_id: crews[0]?.id || "", notes: "" });
  };

  const createBuilderRecord = async draft => {
    const name = draft.name.trim();
    if (!name) return;
    const communities = draft.communities.split(",").map(item => item.trim()).filter(Boolean);
    const color = BUILDER_COLOR_PALETTE[builders.length % BUILDER_COLOR_PALETTE.length];
    const savedBuilder = await createBuilder({ name, contact: draft.contact.trim(), phone: draft.phone.trim(), communities, color, active: true });
    if (savedBuilder) {
      setBuilderRecordDraft(null);
      return;
    }
    window.alert(`Builder could not be created: ${getBuilderCreateError() || buildersError || "Unable to create builder."}`);
  };
  const jobsNeedingAttention = jobs.filter(job => job.status === "Delayed" || job.status === "Ready to Schedule").length;

  const updateTicket = async updated => {
    await onUpdateTicket(updated);
    setSelectedTicketId(updated.id);
  };

  const applyTicketStatus = async (ticket, status, note) => {
    const updated = {
      ...ticket,
      status,
      history: [...(ticket.history || []), { s: status, d: new Date().toISOString(), n: note }],
    };
    try {
      await onUpdateTicket(updated);
      if (status === "Estimate Accepted" || status === "Scheduled") {
        void refreshJobs();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update estimate status.";
      console.error("Unable to update estimate status:", error);
      window.alert(message);
    }
  };

  const showScheduleWriteError = (actionLabel, error) => {
    const message = error instanceof Error ? error.message : `Unable to ${actionLabel}.`;
    console.error(`Unable to ${actionLabel}:`, error);
    window.alert(message);
  };

  const findCalendarJob = jobId => calendarJobs.find(job => job.id === jobId) || null;
  const getScheduleEventDatabaseId = phase => phase?.scheduleEventDatabaseId || phase?.databaseId || "";
  const getBuilderJobSource = (jobId, jobDatabaseId = "") =>
    findCalendarJob(jobId)
    || jobs.find(item => item.id === jobId || item.databaseId === jobId || (jobDatabaseId && item.databaseId === jobDatabaseId))
    || null;
  const resolveLoadedBuilderPhaseScheduleEventId = (jobId, jobDatabaseId, phaseKey) => {
    const normalizedPhaseKey = toUiBuilderPhaseKey(phaseKey);
    if (!normalizedPhaseKey) {
      return "";
    }

    const source = getBuilderJobSource(jobId, jobDatabaseId);
    if (!source) {
      return "";
    }

    const matchingPhase = (source.phases || []).find(phase => toUiBuilderPhaseKey(phase.phase_key) === normalizedPhaseKey);
    return getScheduleEventDatabaseId(matchingPhase);
  };
  const createInitialBuilderWorkflowDraft = (sourceJob, draft, jobDatabaseId) => {
    const sourcePhases = sortBuilderPhases((sourceJob.phases || []).map(phase => ({
      ...phase,
      phase_key: toUiBuilderPhaseKey(phase.phase_key) || phase.phase_key,
      scheduleEventDatabaseId: getScheduleEventDatabaseId(phase),
    })));
    let cursor = draft.scheduled_date || "";

    return {
      job_id: sourceJob.id,
      job_database_id: jobDatabaseId,
      builder_name: sourceJob.builder_name || "",
      community: sourceJob.community || "",
      lot_number: sourceJob.lot_number || "",
      job_address: sourceJob.job_address || "",
      phases: BUILDER_SLAB_WORKFLOW.map((workflowPhase, index) => {
        const existingPhase = sourcePhases.find(phase => phase.phase_key === workflowPhase.uiKey) || null;
        const scheduled_date = index === 0
          ? (draft.scheduled_date || existingPhase?.scheduled_date || "")
          : (cursor ? nextWorkingDate(cursor, workflowPhase.workingDaysAfterPrevious) : "");
        cursor = scheduled_date || cursor;

        return {
          id: existingPhase?.id || `${sourceJob.id}:${workflowPhase.uiKey}:workflow`,
          databaseId: existingPhase?.databaseId || "",
          scheduleEventDatabaseId: existingPhase?.scheduleEventDatabaseId || resolveLoadedBuilderPhaseScheduleEventId(sourceJob.id, jobDatabaseId, workflowPhase.uiKey),
          phase_key: workflowPhase.uiKey,
          phase_label: workflowPhase.label,
          responsible_party: workflowPhase.responsible_party,
          counts_toward_crew: workflowPhase.counts_toward_crew,
          scheduled_date,
          scheduled_time: existingPhase?.scheduled_time || draft.scheduled_time || (workflowPhase.uiKey === "pour_slab" ? "06:30" : "07:00"),
          end_time: existingPhase?.end_time || "",
          crew_id: existingPhase?.crew_id || draft.crew_id || crews[0]?.id || "",
          work_order_number: existingPhase?.work_order_number || "",
          day_capacity_used: existingPhase?.day_capacity_used || (workflowPhase.counts_toward_crew ? 1 : 0),
          estimated_duration: existingPhase?.estimated_duration || 1,
          status: existingPhase?.status || draft.status || "Scheduled",
          notes: existingPhase?.notes || (index === 0 ? draft.notes || "" : ""),
          last_reschedule_reason: existingPhase?.last_reschedule_reason || "",
          last_rescheduled_at: existingPhase?.last_rescheduled_at || "",
          last_rescheduled_by: existingPhase?.last_rescheduled_by || "",
          manual_date_override: false,
        };
      }),
      weekend_override: !!draft.weekend_override,
      charge_weekend_fee: !!draft.charge_weekend_fee,
    };
  };

  const openResidentialSchedule = ticket => {
    if (!canManageSchedule) return;
    setBuilderScheduleDraft(null);
    setResidentialDraft({
      return_section: "tickets",
      customer_name: ticket.name,
      estimateTicketId: ticket.id,
      estimateDatabaseId: ticket.databaseId || "",
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
    setSelectedCalendarJobId(null);
    setSection("calendar");
  };

  const openResidentialRescheduleFromCalendarJob = job => {
    if (!canManageSchedule) return;
    setBuilderScheduleDraft(null);
    setResidentialDraft({
      job_id: job.id,
      job_database_id: job.job_database_id || job.databaseId || "",
      scheduleEventDatabaseId: job.databaseId || "",
      return_section: "calendar",
      customer_name: job.customer_name,
      estimateTicketId: job.sourceTicketId || "",
      estimateDatabaseId: job.estimate_database_id || "",
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
      last_reschedule_reason: job.last_reschedule_reason || "",
      charge_weekend_fee: !!job.charge_weekend_fee,
    });
    setSelectedJobId(null);
    setSelectedCalendarJobId(null);
    setSection("calendar");
  };

  const openResidentialRescheduleFromJob = job => {
    if (!canManageSchedule) return;
    setBuilderScheduleDraft(null);
    const jobDatabaseId = job.databaseId || "";
    const resolvedScheduleRow = resolveResidentialScheduleRow(jobDatabaseId, job.scheduleEventDatabaseId || "");
    const resolvedScheduleEventId = getResidentialScheduleEventId(jobDatabaseId, job.scheduleEventDatabaseId || "");
    setResidentialDraft({
      job_id: job.id,
      job_database_id: jobDatabaseId,
      scheduleEventDatabaseId: resolvedScheduleEventId,
      return_section: resolvedScheduleEventId ? "calendar" : "jobs",
      customer_name: job.customer_name,
      estimateTicketId: job.sourceTicketId || "",
      estimateDatabaseId: job.estimate_database_id || "",
      job_type: job.job_type,
      job_address: job.job_address,
      scheduled_date: resolvedScheduleRow?.scheduled_date || job.scheduled_date || firstWorkingDate(plusDays(todayIso(), 1)),
      scheduled_time: resolvedScheduleRow?.start_time?.slice(0, 5) || job.scheduled_time || "07:00",
      estimated_duration: job.estimated_duration || 1,
      day_capacity_used: job.day_capacity_used || 1,
      crew_id: resolvedScheduleRow?.crew_id || job.crew_id || crews[0]?.id || "",
      work_order_number: job.work_order_number || "",
      status: resolvedScheduleRow ? databaseStatusToCalendarStatus(resolvedScheduleRow.status) : (job.status || "Ready to Schedule"),
      notes: resolvedScheduleRow?.notes || job.notes || "",
      last_reschedule_reason: resolvedScheduleRow?.last_reschedule_reason || job.last_reschedule_reason || "",
      charge_weekend_fee: !!job.charge_weekend_fee,
    });
    setSelectedJobId(null);
    setSelectedCalendarJobId(null);
    setSection("calendar");
  };

  const blockSundaySchedule = label => {
    setWarningState({
      title: "Sunday Scheduling Not Allowed",
      message: `${label} cannot be scheduled on Sunday. Please choose another date on the calendar.`,
    });
  };

  const normalizeScheduleTimeValue = value => String(value || "").slice(0, 5);
  const scheduleTimingChanged = (originalDate, originalStartTime, originalEndTime, nextDate, nextStartTime, nextEndTime) =>
    (originalDate || "") !== (nextDate || "")
    || normalizeScheduleTimeValue(originalStartTime) !== normalizeScheduleTimeValue(nextStartTime)
    || normalizeScheduleTimeValue(originalEndTime) !== normalizeScheduleTimeValue(nextEndTime);
  const rememberLatestRescheduleReason = (scheduleEventDatabaseId, reason) => {
    const normalizedReason = String(reason || "").trim();
    if (!scheduleEventDatabaseId || !normalizedReason) {
      return;
    }

    setLatestRescheduleReasons(prev => ({
      ...prev,
      [scheduleEventDatabaseId]: normalizedReason,
    }));
  };
  const validateRescheduleReasonLength = reason => {
    if (String(reason || "").trim().length > 500) {
      window.alert("Reschedule reasons must be 500 characters or fewer.");
      return false;
    }

    return true;
  };

  const saveResidentialSchedule = async (draft, conflictOverrideReason = "") => {
    if (!canManageSchedule) return;
    if (!draft.scheduled_date) return;
    if (!validateRescheduleReasonLength(draft.reschedule_reason)) return;
    let resolvedJobId = draft.job_database_id || "";
    let resolvedScheduleEventDatabaseId = getResidentialScheduleEventId(resolvedJobId, draft.scheduleEventDatabaseId || "");
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
          void saveResidentialSchedule({ ...draft, crew_id: override.crew_id, charge_weekend_fee: override.charge_weekend_fee, weekend_override: true }, conflictOverrideReason);
        },
        onCancel: () => setWeekendOverrideState(null),
      });
      return;
    }
    const calendarUpdated = {
      ...draft,
      job_type: draft.job_type,
      customer_name: draft.customer_name,
      job_address: draft.job_address,
      scheduled_date: draft.scheduled_date,
      scheduled_time: draft.scheduled_time,
      estimated_duration: Number(draft.estimated_duration || 1),
      day_capacity_used: Number(draft.day_capacity_used || 1),
      crew_id: draft.crew_id,
      work_order_number: draft.work_order_number,
      status: draft.status,
      notes: draft.notes,
    };
    const candidateEvents = buildResidentialEvents(calendarUpdated);
    const existingCalendarEvents = resolvedScheduleEventDatabaseId
      ? scheduleEvents.filter(event => event.databaseId !== resolvedScheduleEventDatabaseId)
      : scheduleEvents;
    const conflicts = detectCrewConflicts({
      candidateEvents,
      existingEvents: existingCalendarEvents,
      crews,
    });
    if (conflicts.length && !conflictOverrideReason) {
      setConflictState({
        conflicts,
        defaultCrewId: draft.crew_id,
        reopen: () => setResidentialDraft(draft),
        onReassign: newCrewId => void saveResidentialSchedule({ ...draft, crew_id: newCrewId }, ""),
        onOverride: note => void saveResidentialSchedule({ ...draft }, note),
        onCancel: () => setResidentialDraft(null),
      });
      setResidentialDraft(null);
      return;
    }

    if (resolvedScheduleEventDatabaseId) {
      const existingScheduleRow = resolveResidentialScheduleRow(resolvedJobId, resolvedScheduleEventDatabaseId);
      const requiresRescheduleReason = existingScheduleRow && scheduleTimingChanged(
        existingScheduleRow.scheduled_date,
        existingScheduleRow.start_time,
        existingScheduleRow.end_time,
        draft.scheduled_date,
        draft.scheduled_time,
        existingScheduleRow.end_time
      );
      const rescheduleReason = String(draft.reschedule_reason || "").trim();
      if (requiresRescheduleReason && !rescheduleReason) {
        window.alert("A reschedule reason is required when changing the scheduled date or time.");
        return;
      }

      try {
        const updatedScheduleRow = await updateScheduleEvent(resolvedScheduleEventDatabaseId, {
          crew_id: draft.crew_id || null,
          scheduled_date: draft.scheduled_date,
          start_time: draft.scheduled_time || null,
          status: calendarStatusToDatabaseStatus(draft.status),
          notes: draft.notes || null,
          reschedule_reason: requiresRescheduleReason ? rescheduleReason || null : null,
        });
        rememberLatestRescheduleReason(updatedScheduleRow.id, updatedScheduleRow.last_reschedule_reason || rescheduleReason);
        setScheduleHistory(prev => [{ id: `sch-${Date.now()}`, type: "residential-reschedule", jobId: draft.job_database_id || draft.job_id, note: `Rescheduled ${draft.customer_name} for ${draft.scheduled_date}` }, ...prev]);
        if (conflictOverrideReason) {
          setOverrideHistory(prev => [{ id: `ovr-${Date.now()}`, jobId: draft.job_database_id || draft.job_id, note: conflictOverrideReason, createdAt: new Date().toISOString() }, ...prev]);
        }
        void refreshJobs();
        setResidentialDraft(null);
        if (draft.from_phase_edit) {
          setPhaseDraft(null);
        }
        setSelectedCalendarJobId(null);
        setSection(draft.return_section || "calendar");
        return;
      } catch (error) {
        showScheduleWriteError("update the calendar event", error);
        return;
      }
    }

    if (!draft.estimateDatabaseId) {
      window.alert("This estimate is not linked to a database job yet, so the calendar event cannot be saved.");
      return;
    }

    let jobId = resolvedJobId || null;

    if (!jobId) {
      try {
        jobId = await findJobIdByEstimateId(draft.estimateDatabaseId);
      } catch (error) {
        showScheduleWriteError("locate the accepted job", error);
        return;
      }
    }

    if (!jobId) {
      window.alert("No database job was found for this accepted estimate. Confirm the accepted-estimate job trigger has run before scheduling.");
      return;
    }

    resolvedScheduleEventDatabaseId = getResidentialScheduleEventId(jobId, resolvedScheduleEventDatabaseId);
    if (resolvedScheduleEventDatabaseId) {
      const existingScheduleRow = resolveResidentialScheduleRow(jobId, resolvedScheduleEventDatabaseId);
      const requiresRescheduleReason = existingScheduleRow && scheduleTimingChanged(
        existingScheduleRow.scheduled_date,
        existingScheduleRow.start_time,
        existingScheduleRow.end_time,
        draft.scheduled_date,
        draft.scheduled_time,
        existingScheduleRow.end_time
      );
      const rescheduleReason = String(draft.reschedule_reason || "").trim();
      if (requiresRescheduleReason && !rescheduleReason) {
        window.alert("A reschedule reason is required when changing the scheduled date or time.");
        return;
      }

      try {
        const updatedScheduleRow = await updateScheduleEvent(resolvedScheduleEventDatabaseId, {
          crew_id: draft.crew_id || null,
          scheduled_date: draft.scheduled_date,
          start_time: draft.scheduled_time || null,
          status: calendarStatusToDatabaseStatus(draft.status),
          notes: draft.notes || null,
          reschedule_reason: requiresRescheduleReason ? rescheduleReason || null : null,
        });
        rememberLatestRescheduleReason(updatedScheduleRow.id, updatedScheduleRow.last_reschedule_reason || rescheduleReason);
        setScheduleHistory(prev => [{ id: `sch-${Date.now()}`, type: "residential-reschedule", jobId, note: `Rescheduled ${draft.customer_name} for ${draft.scheduled_date}` }, ...prev]);
        if (conflictOverrideReason) {
          setOverrideHistory(prev => [{ id: `ovr-${Date.now()}`, jobId, note: conflictOverrideReason, createdAt: new Date().toISOString() }, ...prev]);
        }
        void refreshJobs();
        setResidentialDraft(null);
        if (draft.from_phase_edit) {
          setPhaseDraft(null);
        }
        setSelectedCalendarJobId(null);
        setSection(draft.return_section || "calendar");
        return;
      } catch (error) {
        showScheduleWriteError("update the calendar event", error);
        return;
      }
    }

    try {
      await createScheduleEvent({
        job_id: jobId,
        crew_id: draft.crew_id || null,
        scheduled_date: draft.scheduled_date,
        start_time: draft.scheduled_time || null,
        builder_step: "residential_job",
        status: calendarStatusToDatabaseStatus(draft.status),
        notes: draft.notes || null,
      });
      const source = tickets.find(ticket => ticket.id === draft.estimateTicketId);
      if (source) {
        void applyTicketStatus({ ...source }, "Scheduled", `Converted to scheduled residential job${draft.work_order_number ? ` (${draft.work_order_number})` : ""}.`);
      }
      setScheduleHistory(prev => [{ id: `sch-${Date.now()}`, type: "residential", jobId, note: `Scheduled ${draft.customer_name} for ${draft.scheduled_date}` }, ...prev]);
      if (conflictOverrideReason) {
        setOverrideHistory(prev => [{ id: `ovr-${Date.now()}`, jobId, note: conflictOverrideReason, createdAt: new Date().toISOString() }, ...prev]);
      }
      void refreshJobs();
      setResidentialDraft(null);
      if (draft.from_phase_edit) {
        setPhaseDraft(null);
      }
      setSelectedJobId(null);
      setSection(draft.return_section || "tickets");
    } catch (error) {
      if (isResidentialScheduleUniqueViolation(error)) {
        window.alert("This residential job already has a scheduled event. Reopen it and use Reschedule instead.");
        void refreshScheduleEvents();
        void refreshJobs();
        return;
      }
      showScheduleWriteError("create the calendar event", error);
    }
  };

  const createBuilderJob = async draft => {
    const builder = builders.find(item => item.id === draft.builder_id);

    if (!builder?.databaseId) {
      window.alert("The selected builder is missing its database ID, so this builder job cannot be created.");
      return;
    }

    try {
      const savedJob = await createStoredBuilderJob({
        builder: {
          id: builder.id,
          databaseId: builder.databaseId,
          name: builder.name,
          phone: builder.phone,
          color: builder.color,
        },
        community: draft.community,
        lotNumber: draft.lot_number,
        jobAddress: draft.job_address,
        notes: draft.notes,
      });
      setBuilderDraft(null);
      setSelectedCalendarJobId(null);
      setSelectedTicketId(null);
      setSelectedJobId(savedJob.id);
      setSection("jobs");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create builder job.";
      window.alert(message);
    }
  };

  const saveBuilderSchedule = draft => {
    if (!canManageSchedule) return;
    if (!draft.scheduled_date) return;
    const databaseBackedBuilderJob = findCalendarJob(draft.job_id);
    if (!databaseBackedBuilderJob) {
      window.alert("This builder workflow does not have a matching database job record yet, so it cannot be written to Supabase schedule_events in this phase.");
      return;
    }
    window.alert("Builder scheduling from the Jobs flow is not enabled in this phase unless the workflow is already backed by schedule_events.");
    setBuilderScheduleDraft(null);
  };

  const openPhaseEdit = (jobId, phaseId) => {
    if (!canManageSchedule) return;
    const calendarJob = findCalendarJob(jobId);
    if (calendarJob) {
      if (calendarJob.schedule_type === "residential") {
        openResidentialRescheduleFromCalendarJob(calendarJob);
        return;
      }

      const phase = sortBuilderPhases(calendarJob.phases || []).find(item => item.id === phaseId);
      if (!phase) return;
      setPhaseDraft({
        ...phase,
        scheduleEventDatabaseId: getScheduleEventDatabaseId(phase),
        job_id: calendarJob.id,
        job_database_id: calendarJob.job_database_id,
        phase_id: phase.id,
        isResidential: false,
      });
      return;
    }

    const job = jobs.find(item => item.id === jobId);
    if (!job) return;
    if (job.schedule_type === "residential") {
      openResidentialRescheduleFromJob(job);
      return;
    }
    const phase = sortBuilderPhases(job.phases || []).find(item => item.id === phaseId);
    if (!phase) return;
    setPhaseDraft({
      ...phase,
      scheduleEventDatabaseId: getScheduleEventDatabaseId(phase),
      job_id: job.id,
      job_database_id: job.databaseId || job.id,
      phase_id: phase.id,
      isResidential: false,
    });
  };

  const openPhaseDetails = (jobId, phaseId) => {
    const sourceJob = getBuilderJobSource(jobId);
    if (!sourceJob || sourceJob.schedule_type !== "builder_slab") {
      return;
    }

    const phase = sortBuilderPhases(sourceJob.phases || []).find(item => item.id === phaseId);
    if (!phase) {
      return;
    }

    setPhaseDetailState({
      job_id: sourceJob.id,
      phase_id: phase.id,
      builder_name: sourceJob.builder_name || "",
      community: sourceJob.community || "",
      lot_number: sourceJob.lot_number || "",
      phase: {
        ...phase,
        phase_key: toUiBuilderPhaseKey(phase.phase_key) || phase.phase_key,
        scheduleEventDatabaseId: getScheduleEventDatabaseId(phase),
        last_reschedule_reason: phase.last_reschedule_reason || latestRescheduleReasons[getScheduleEventDatabaseId(phase)] || "",
      },
    });
  };

  const saveResidentialReschedule = (draft, overrideReason = "") => {
    if (!canManageSchedule) return;
    void saveResidentialSchedule({ ...draft, return_section: draft.return_section || "jobs", from_phase_edit: true }, overrideReason);
  };

  const saveInitialBuilderWorkflow = async (draft, overrideReason = "") => {
    if (!canManageSchedule) return;

    for (let idx = 0; idx < (draft.phases || []).length; idx += 1) {
      const phase = draft.phases[idx];
      const previousPhase = idx > 0 ? draft.phases[idx - 1] : null;

      if (!phase.scheduled_date) {
        window.alert(`${phase.phase_label} requires a scheduled date before saving.`);
        return;
      }

      if (previousPhase?.scheduled_date && phase.scheduled_date < previousPhase.scheduled_date) {
        window.alert(`${phase.phase_label} cannot be scheduled before ${previousPhase.phase_label}.`);
        return;
      }

      if (isSunday(phase.scheduled_date)) {
        blockSundaySchedule(phase.phase_label);
        return;
      }
    }

    const saturdayPhase = (draft.phases || []).find(phase => phase.scheduled_date && isSaturday(phase.scheduled_date));
    if (saturdayPhase && settings.skipWeekendsByDefault && !draft.weekend_override) {
      if (!settings.allowWeekendOverride) {
        window.alert("Saturday scheduling requires an override, and weekend overrides are currently disabled.");
        return;
      }

      setWeekendOverrideState({
        defaultCrewId: saturdayPhase.crew_id || crews[0]?.id || "",
        message: `${saturdayPhase.phase_label} is being scheduled on Saturday, ${fmtDate(saturdayPhase.scheduled_date)}.`,
        onConfirm: override => {
          setWeekendOverrideState(null);
          void saveInitialBuilderWorkflow({
            ...draft,
            weekend_override: true,
            charge_weekend_fee: override.charge_weekend_fee,
          }, overrideReason);
        },
        onCancel: () => setWeekendOverrideState(null),
      });
      return;
    }

    const sourceJob = getBuilderJobSource(draft.job_id, draft.job_database_id);
    if (!sourceJob || sourceJob.schedule_type !== "builder_slab") {
      window.alert("This builder workflow does not have a matching database job record, so phase scheduling cannot be written to Supabase.");
      return;
    }

    const jobDatabaseId = draft.job_database_id || sourceJob.job_database_id || sourceJob.databaseId || sourceJob.id;
    const updatedJob = {
      ...sourceJob,
      job_database_id: jobDatabaseId,
      phases: (draft.phases || []).map(phase => ({
        ...phase,
        phase_key: toUiBuilderPhaseKey(phase.phase_key) || phase.phase_key,
      })),
    };
    const candidateEvents = buildBuilderEvents(updatedJob);
    const ignoreEventIds = (draft.phases || []).map(phase => phase.scheduleEventDatabaseId).filter(Boolean);
    const conflicts = detectCrewConflicts({
      candidateEvents,
      existingEvents: scheduleEvents.filter(event => !ignoreEventIds.includes(event.databaseId)),
      crews,
    });
    if (conflicts.length && !overrideReason) {
      setConflictState({
        conflicts,
        defaultCrewId: draft.phases.find(phase => phase.crew_id)?.crew_id || crews[0]?.id || "",
        reopen: () => setBuilderWorkflowDraft(draft),
        onReassign: newCrewId => void saveInitialBuilderWorkflow({
          ...draft,
          phases: draft.phases.map(phase => phase.counts_toward_crew ? { ...phase, crew_id: newCrewId } : phase),
        }, ""),
        onOverride: note => void saveInitialBuilderWorkflow(draft, note),
        onCancel: () => setBuilderWorkflowDraft(null),
      });
      setBuilderWorkflowDraft(null);
      return;
    }

    const workingDraft = {
      ...draft,
      phases: draft.phases.map(phase => ({ ...phase })),
    };
    let savedCount = 0;

    try {
      for (const phase of workingDraft.phases) {
        const scheduleEventDatabaseId = phase.scheduleEventDatabaseId || resolveLoadedBuilderPhaseScheduleEventId(workingDraft.job_id, jobDatabaseId, phase.phase_key);
        const scheduleWritePayload = {
          job_id: jobDatabaseId,
          crew_id: phase.crew_id || null,
          scheduled_date: phase.scheduled_date,
          start_time: phase.scheduled_time || null,
          builder_step: toDatabaseBuilderStep(phase.phase_key),
          status: calendarStatusToDatabaseStatus(phase.status),
          notes: phase.notes || null,
        };

        const savedScheduleRow = scheduleEventDatabaseId
          ? await updateScheduleEvent(scheduleEventDatabaseId, scheduleWritePayload)
          : await createScheduleEvent(scheduleWritePayload);

        savedCount += 1;
        phase.scheduleEventDatabaseId = savedScheduleRow.id;
        phase.databaseId = savedScheduleRow.id;
        phase.work_order_number = savedScheduleRow.work_order_number || phase.work_order_number || "";
        phase.last_reschedule_reason = savedScheduleRow.last_reschedule_reason || phase.last_reschedule_reason || "";
        phase.last_rescheduled_at = savedScheduleRow.last_rescheduled_at || phase.last_rescheduled_at || "";
        phase.last_rescheduled_by = savedScheduleRow.last_rescheduled_by || phase.last_rescheduled_by || "";
        setBuilderWorkflowDraft({
          ...workingDraft,
          phases: workingDraft.phases.map(item => ({ ...item })),
        });
      }

      setScheduleHistory(prev => [{ id: `sch-${Date.now()}`, type: "builder-workflow", jobId: jobDatabaseId, note: `Scheduled builder slab workflow starting ${workingDraft.phases[0]?.scheduled_date || ""}` }, ...prev]);
      if (overrideReason) {
        setOverrideHistory(prev => [{ id: `ovr-${Date.now()}`, jobId: jobDatabaseId, note: overrideReason, createdAt: new Date().toISOString() }, ...prev]);
      }
      setBuilderWorkflowDraft(null);
      void refreshScheduleEvents();
      void refreshJobs();
    } catch (error) {
      if (savedCount > 0) {
        setBuilderWorkflowDraft({
          ...workingDraft,
          phases: workingDraft.phases.map(item => ({ ...item })),
        });
        void refreshScheduleEvents();
        void refreshJobs();
      }
      showScheduleWriteError(savedCount > 0 ? "finish saving the builder workflow" : "save the builder workflow", error);
    }
  };

  const saveBuilderPhase = async (draft, overrideReason = "") => {
    if (!canManageSchedule) return;
    if (!validateRescheduleReasonLength(draft.reschedule_reason)) return;
    const sourceJob = getBuilderJobSource(draft.job_id, draft.job_database_id);
    if (!sourceJob || sourceJob.schedule_type !== "builder_slab") {
      setPhaseDraft(null);
      window.alert("This builder workflow does not have a matching database job record, so phase scheduling cannot be written to Supabase.");
      return;
    }

    const jobDatabaseId = sourceJob.job_database_id || sourceJob.databaseId || draft.job_database_id || draft.job_id;
    const normalizedDraft = {
      ...draft,
      phase_key: toUiBuilderPhaseKey(draft.phase_key) || draft.phase_key,
      scheduleEventDatabaseId: draft.scheduleEventDatabaseId || resolveLoadedBuilderPhaseScheduleEventId(draft.job_id, jobDatabaseId, draft.phase_key),
    };
    const sortedPhases = sortBuilderPhases((sourceJob.phases || []).map(phase => ({
      ...phase,
      phase_key: toUiBuilderPhaseKey(phase.phase_key) || phase.phase_key,
      scheduleEventDatabaseId: getScheduleEventDatabaseId(phase),
    })));
    const phaseIndex = sortedPhases.findIndex(phase => phase.id === normalizedDraft.phase_id);
    if (phaseIndex < 0) return;
    const persistedStandardPhaseCount = sortedPhases.filter(phase =>
      BUILDER_SLAB_WORKFLOW.some(workflowPhase => workflowPhase.uiKey === phase.phase_key)
      && !!(phase.scheduleEventDatabaseId || resolveLoadedBuilderPhaseScheduleEventId(draft.job_id, jobDatabaseId, phase.phase_key))
    ).length;

    if (!normalizedDraft.scheduleEventDatabaseId && persistedStandardPhaseCount === 0) {
      if (normalizedDraft.phase_key !== "form_slab") {
        window.alert("Schedule Form Slab first so the initial builder workflow can create all three standard phases together.");
        return;
      }

      setPhaseDraft(null);
      setBuilderWorkflowDraft(createInitialBuilderWorkflowDraft(sourceJob, normalizedDraft, jobDatabaseId));
      return;
    }

    const previousPhase = sortedPhases[phaseIndex - 1];
    if (previousPhase?.scheduled_date && normalizedDraft.scheduled_date && normalizedDraft.scheduled_date < previousPhase.scheduled_date) {
      window.alert(`${normalizedDraft.phase_label} cannot be scheduled before ${previousPhase.phase_label}.`);
      return;
    }
    if (normalizedDraft.scheduled_date && isSunday(normalizedDraft.scheduled_date)) {
      blockSundaySchedule(normalizedDraft.phase_label);
      return;
    }
    if (normalizedDraft.scheduled_date && isSaturday(normalizedDraft.scheduled_date) && settings.skipWeekendsByDefault && !normalizedDraft.weekend_override) {
      if (!settings.allowWeekendOverride) {
        window.alert("Saturday scheduling requires an override, and weekend overrides are currently disabled.");
        return;
      }
      setWeekendOverrideState({
        defaultCrewId: normalizedDraft.crew_id,
        message: `${normalizedDraft.phase_label} is being scheduled on Saturday, ${fmtDate(normalizedDraft.scheduled_date)}.`,
        onConfirm: override => {
          setWeekendOverrideState(null);
          void saveBuilderPhase({ ...normalizedDraft, crew_id: override.crew_id, charge_weekend_fee: override.charge_weekend_fee, weekend_override: true }, overrideReason);
        },
        onCancel: () => setWeekendOverrideState(null),
      });
      return;
    }

    const existingPhase = sortedPhases[phaseIndex];
    const hasLaterPhases = sortedPhases.slice(phaseIndex + 1).length > 0;
    const willPushForward = existingPhase.scheduled_date && normalizedDraft.scheduled_date && normalizedDraft.scheduled_date > existingPhase.scheduled_date && hasLaterPhases;
    if (willPushForward) {
      const updatedPhases = sortedPhases.map((phase, idx) => idx === phaseIndex ? { ...phase, ...normalizedDraft, conflict_override_reason: overrideReason } : { ...phase });
      let cursor = normalizedDraft.scheduled_date;
      for (let idx = phaseIndex + 1; idx < updatedPhases.length; idx += 1) {
        cursor = nextWorkingDate(cursor, 1);
        updatedPhases[idx] = { ...updatedPhases[idx], scheduled_date: cursor };
      }
      const updatedJob = { ...sourceJob, job_database_id: jobDatabaseId, phases: updatedPhases, databaseBacked: true };
      const candidateEvents = buildBuilderEvents(updatedJob);
      const ignoreEventIds = sortedPhases.map(phase => phase.scheduleEventDatabaseId).filter(Boolean);
      const conflicts = detectCrewConflicts({
        candidateEvents,
        existingEvents: scheduleEvents.filter(event => !ignoreEventIds.includes(event.databaseId)),
        crews,
      });
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
        jobId: sourceJob.id,
        updatedJob,
        originalPhases: sortedPhases,
        startPhaseIndex: phaseIndex,
        conflicts,
        summary,
        overrideReason,
        requiresRescheduleReason: updatedPhases.slice(phaseIndex).some(phase => {
          const originalPhase = sortedPhases.find(item => item.id === phase.id);
          const phaseScheduleEventDatabaseId = phase.scheduleEventDatabaseId || resolveLoadedBuilderPhaseScheduleEventId(sourceJob.id, jobDatabaseId, phase.phase_key);
          return !!phaseScheduleEventDatabaseId && !!originalPhase && scheduleTimingChanged(
            originalPhase.scheduled_date,
            originalPhase.scheduled_time,
            originalPhase.end_time,
            phase.scheduled_date,
            phase.scheduled_time,
            originalPhase.end_time
          );
        }),
        reschedule_reason: normalizedDraft.reschedule_reason || "",
        databaseBacked: true,
      });
      setPhaseDraft(null);
      return;
    }

    const updatedJob = {
      ...sourceJob,
      job_database_id: jobDatabaseId,
      phases: sortedPhases.map((phase, idx) => idx === phaseIndex ? { ...phase, ...normalizedDraft, conflict_override_reason: overrideReason } : { ...phase }),
    };
    const candidateEvents = buildBuilderEvents(updatedJob);
    const ignoreEventIds = sortedPhases.map(phase => phase.scheduleEventDatabaseId).filter(Boolean);
    const conflicts = detectCrewConflicts({
      candidateEvents,
      existingEvents: scheduleEvents.filter(event => !ignoreEventIds.includes(event.databaseId)),
      crews,
    });
    if (conflicts.length && !overrideReason) {
      setConflictState({
        conflicts,
        defaultCrewId: normalizedDraft.crew_id,
        reopen: () => setPhaseDraft(normalizedDraft),
        onReassign: newCrewId => void saveBuilderPhase({ ...normalizedDraft, crew_id: newCrewId }, ""),
        onOverride: note => void saveBuilderPhase({ ...normalizedDraft }, note),
        onCancel: () => setPhaseDraft(null),
      });
      setPhaseDraft(null);
      return;
    }

    const requiresRescheduleReason = !!normalizedDraft.scheduleEventDatabaseId && scheduleTimingChanged(
      existingPhase.scheduled_date,
      existingPhase.scheduled_time,
      existingPhase.end_time,
      normalizedDraft.scheduled_date,
      normalizedDraft.scheduled_time,
      existingPhase.end_time
    );
    const rescheduleReason = String(normalizedDraft.reschedule_reason || "").trim();
    if (requiresRescheduleReason && !rescheduleReason) {
      window.alert("A reschedule reason is required when changing the scheduled date or time.");
      return;
    }

    const scheduleWritePayload = {
      job_id: jobDatabaseId,
      crew_id: normalizedDraft.crew_id || null,
      scheduled_date: normalizedDraft.scheduled_date,
      start_time: normalizedDraft.scheduled_time || null,
      builder_step: toDatabaseBuilderStep(normalizedDraft.phase_key),
      status: calendarStatusToDatabaseStatus(normalizedDraft.status),
      notes: normalizedDraft.notes || null,
      reschedule_reason: requiresRescheduleReason ? rescheduleReason || null : null,
    };

    try {
      if (normalizedDraft.scheduleEventDatabaseId) {
        const updatedScheduleRow = await updateScheduleEvent(normalizedDraft.scheduleEventDatabaseId, scheduleWritePayload);
        rememberLatestRescheduleReason(updatedScheduleRow.id, updatedScheduleRow.last_reschedule_reason || rescheduleReason);
      } else {
        await createScheduleEvent(scheduleWritePayload);
      }
      setScheduleHistory(prev => [{ id: `sch-${Date.now()}`, type: "builder-phase", jobId: jobDatabaseId, note: `${existingPhase.scheduled_date ? "Updated" : "Scheduled"} ${normalizedDraft.phase_label} for ${normalizedDraft.scheduled_date}` }, ...prev]);
      if (overrideReason) {
        setOverrideHistory(prev => [{ id: `ovr-${Date.now()}`, jobId: jobDatabaseId, note: overrideReason, createdAt: new Date().toISOString() }, ...prev]);
      }
      void refreshJobs();
      setPhaseDraft(null);
    } catch (error) {
      showScheduleWriteError(normalizedDraft.scheduleEventDatabaseId ? "update the builder schedule" : "create the builder schedule", error);
    }
  };

  const applyPushPreview = async (overrideReason = "", rescheduleReason = "") => {
    if (!canManageSchedule) return;
    if (!pushPreview) return;
    if (!validateRescheduleReasonLength(rescheduleReason)) return;
    if (pushPreview.databaseBacked) {
      if (pushPreview.conflicts.length && !overrideReason) {
        setConflictState({
          conflicts: pushPreview.conflicts,
          defaultCrewId: pushPreview.updatedJob.crew_id,
          reopen: () => {},
          onReassign: newCrewId => {
            const revised = JSON.parse(JSON.stringify(pushPreview.updatedJob));
            revised.phases = revised.phases.map(phase => phase.counts_toward_crew ? { ...phase, crew_id: newCrewId } : phase);
            setPushPreview({ ...pushPreview, updatedJob: revised, conflicts: [], reschedule_reason: rescheduleReason });
            setConflictState(null);
          },
          onOverride: note => applyPushPreview(note, rescheduleReason),
          onCancel: () => { setPushPreview(null); },
        });
        setPushPreview(null);
        return;
      }

      const jobDatabaseId = pushPreview.updatedJob.job_database_id || pushPreview.updatedJob.databaseId || pushPreview.updatedJob.id;
      const originalPhases = pushPreview.originalPhases || [];
      const affectedPhases = (pushPreview.updatedJob.phases || []).slice(pushPreview.startPhaseIndex || 0);
      const changedPersistedPhases = affectedPhases.filter(phase => {
        const phaseScheduleEventDatabaseId = phase.scheduleEventDatabaseId || resolveLoadedBuilderPhaseScheduleEventId(pushPreview.jobId, jobDatabaseId, phase.phase_key);
        if (!phaseScheduleEventDatabaseId) {
          return false;
        }

        const originalPhase = originalPhases.find(item => item.id === phase.id);
        if (!originalPhase) {
          return false;
        }

        return scheduleTimingChanged(
          originalPhase.scheduled_date,
          originalPhase.scheduled_time,
          originalPhase.end_time,
          phase.scheduled_date,
          phase.scheduled_time,
          originalPhase.end_time
        );
      });

      if (changedPersistedPhases.length > 0 && !String(rescheduleReason || "").trim()) {
        window.alert("A push-forward reason is required because one or more existing scheduled phases are being rescheduled.");
        return;
      }

      try {
        for (const phase of affectedPhases) {
          const scheduleEventDatabaseId = phase.scheduleEventDatabaseId || resolveLoadedBuilderPhaseScheduleEventId(pushPreview.jobId, jobDatabaseId, phase.phase_key);
          const originalPhase = originalPhases.find(item => item.id === phase.id);
          const phaseRescheduleReason = originalPhase && scheduleTimingChanged(
            originalPhase.scheduled_date,
            originalPhase.scheduled_time,
            originalPhase.end_time,
            phase.scheduled_date,
            phase.scheduled_time,
            originalPhase.end_time
          )
            ? String(rescheduleReason || "").trim() || null
            : null;
          const scheduleWritePayload = {
            job_id: jobDatabaseId,
            crew_id: phase.crew_id || null,
            scheduled_date: phase.scheduled_date,
            start_time: phase.scheduled_time || null,
            builder_step: toDatabaseBuilderStep(phase.phase_key),
            status: calendarStatusToDatabaseStatus(phase.status),
            notes: phase.notes || null,
            reschedule_reason: phaseRescheduleReason,
          };

          if (scheduleEventDatabaseId) {
            const updatedScheduleRow = await updateScheduleEvent(scheduleEventDatabaseId, scheduleWritePayload);
            rememberLatestRescheduleReason(updatedScheduleRow.id, updatedScheduleRow.last_reschedule_reason || phaseRescheduleReason);
            phase.scheduleEventDatabaseId = updatedScheduleRow.id;
            phase.work_order_number = updatedScheduleRow.work_order_number || phase.work_order_number || "";
            phase.last_reschedule_reason = updatedScheduleRow.last_reschedule_reason || phaseRescheduleReason || phase.last_reschedule_reason || "";
            continue;
          }

          const createdScheduleRow = await createScheduleEvent(scheduleWritePayload);
          phase.scheduleEventDatabaseId = createdScheduleRow.id;
          phase.work_order_number = createdScheduleRow.work_order_number || phase.work_order_number || "";
          phase.last_reschedule_reason = createdScheduleRow.last_reschedule_reason || phase.last_reschedule_reason || "";
        }

        setScheduleHistory(prev => [{ id: `sch-${Date.now()}`, type: "builder-push", jobId: jobDatabaseId, note: "Builder phases shifted forward in order." }, ...prev]);
        if (overrideReason) {
          setOverrideHistory(prev => [{ id: `ovr-${Date.now()}`, jobId: jobDatabaseId, note: overrideReason, createdAt: new Date().toISOString() }, ...prev]);
        }
        void refreshJobs();
        setPushPreview(null);
      } catch (error) {
        showScheduleWriteError("apply the builder schedule push", error);
      }
      return;
    }
    window.alert("This builder schedule push cannot be persisted until the workflow is backed by schedule_events.");
    setPushPreview(null);
  };

  const openCustomerEdit = () => {
    setCustomerEditError("");
    setCustomerEditOpen(true);
  };

  const saveCustomerEdit = async draft => {
    if (!selectedCustomer) return;

    setCustomerEditSaving(true);
    setCustomerEditError("");

    try {
      await updateStoredCustomer(selectedCustomer.id, {
        first_name: draft.first_name,
        last_name: draft.last_name,
        company_name: draft.company_name,
        phone: draft.phone,
        email: draft.email,
        street_address: draft.street_address,
        city: draft.city,
        state: draft.state,
        zip_code: draft.zip_code,
        customer_type: draft.customer_type,
        notes: draft.notes,
      });
      setCustomerEditOpen(false);
    } catch (error) {
      setCustomerEditError(error instanceof Error ? error.message : "Unable to update customer.");
    } finally {
      setCustomerEditSaving(false);
    }
  };

  const openDeactivateCustomer = () => {
    setCustomerLifecycleError("");
    setCustomerDeactivateOpen(true);
  };

  const confirmDeactivateCustomer = async () => {
    if (!selectedCustomer) return;

    setCustomerLifecycleSaving(true);
    setCustomerLifecycleError("");

    try {
      await setStoredCustomerActive(selectedCustomer.id, false);
      setCustomerDeactivateOpen(false);
    } catch (error) {
      setCustomerLifecycleError(error instanceof Error ? error.message : "Unable to deactivate customer.");
    } finally {
      setCustomerLifecycleSaving(false);
    }
  };

  const reactivateCustomer = async () => {
    if (!selectedCustomer) return;

    setCustomerLifecycleSaving(true);
    setCustomerLifecycleError("");

    try {
      await setStoredCustomerActive(selectedCustomer.id, true);
    } catch (error) {
      setCustomerLifecycleError(error instanceof Error ? error.message : "Unable to reactivate customer.");
    } finally {
      setCustomerLifecycleSaving(false);
    }
  };

  const content = (() => {
    if (selectedTicket) {
      const sourceJob = jobs.find(job => job.sourceTicketId === selectedTicket.id && job.scheduled_date) || null;
      return <TicketDetailView ticket={selectedTicket} onBack={() => setSelectedTicketId(null)} onUpdateTicket={updateTicket} onOpenSchedule={openResidentialSchedule} sourceJob={sourceJob} />;
    }
    if (selectedCalendarJob) {
      return (
        <JobDetailView
          job={selectedCalendarJob}
          crews={crews}
          latestRescheduleReasons={latestRescheduleReasons}
          profileDisplayNames={profileDisplayNames}
          onBack={() => setSelectedCalendarJobId(null)}
          onSaveJob={job => {
            if (!canManageSchedule || !job.databaseId) return;
            void updateScheduleEvent(job.databaseId, {
              status: calendarStatusToDatabaseStatus(job.status),
            }).then(() => {
              setScheduleHistory(prev => [{ id: `sch-${Date.now()}`, type: "residential-status", jobId: job.job_database_id || job.id, note: `Updated job status to ${job.status}` }, ...prev]);
              void refreshJobs();
            }).catch(error => {
              showScheduleWriteError("update the calendar status", error);
            });
          }}
          onOpenPhaseEdit={openPhaseEdit}
          onOpenPhaseDetails={openPhaseDetails}
          readOnly={calendarReadOnly}
        />
      );
    }
    if (selectedJob) {
      return <JobDetailView job={selectedJob} crews={crews} latestRescheduleReasons={latestRescheduleReasons} profileDisplayNames={profileDisplayNames} onBack={() => setSelectedJobId(null)} onSaveJob={job => {
        if (!canManageSchedule) return;
        if (job.schedule_type === "residential" && job.scheduleEventDatabaseId) {
          void updateScheduleEvent(job.scheduleEventDatabaseId, {
            status: calendarStatusToDatabaseStatus(job.status),
          }).then(() => {
            setScheduleHistory(prev => [{ id: `sch-${Date.now()}`, type: "residential-status", jobId: job.databaseId || job.id, note: `Updated job status to ${job.status}` }, ...prev]);
            void refreshJobs();
          }).catch(error => {
            showScheduleWriteError("update the calendar status", error);
          });
          return;
        }

        void updateStoredJob(job.databaseId || job.id, {
          status: job.status === "Completed"
            ? "completed"
            : job.status === "Delayed"
              ? "delayed"
              : job.status === "In Progress"
                ? "in_progress"
                : job.status === "Cancelled"
                  ? "cancelled"
                  : job.status === "Scheduled"
                    ? "scheduled"
                    : "unscheduled",
          notes: job.notes || null,
        }).then(() => {
          void refreshJobs();
        }).catch(error => {
          showScheduleWriteError("update the job", error);
        });
      }} onOpenPhaseEdit={openPhaseEdit} onOpenPhaseDetails={openPhaseDetails} readOnly={calendarReadOnly} />;
    }
    if (selectedCustomer) {
      return (
        <CustomerDetailView
          customer={selectedCustomer}
          tickets={tickets}
          jobs={jobs}
          onBack={() => setSelectedCustomerId(null)}
          onEditCustomer={openCustomerEdit}
          onDeactivateCustomer={openDeactivateCustomer}
          onReactivateCustomer={reactivateCustomer}
          canManageCustomer={canManageCustomers}
          customerActionBusy={customerEditSaving || customerLifecycleSaving}
          customerActionError={!customerDeactivateOpen ? customerLifecycleError : ""}
          onOpenEstimate={ticket => {
            setSelectedCustomerId(null);
            setSelectedTicketId(ticket.id);
          }}
          onOpenJob={jobId => {
            setSelectedCustomerId(null);
            setSelectedJobId(jobId);
          }}
        />
      );
    }
    if (section === "dashboard") return <DashboardHomeSection tickets={tickets} jobs={jobs} events={allEvents} conflicts={activeConflicts} setSection={setSection} />;
    if (section === "tickets") return <EstimateTicketsSection tickets={tickets} ticketsLoading={ticketsLoading} ticketsError={ticketsError} onSelectTicket={ticket => setSelectedTicketId(ticket.id)} onAcceptTicket={ticket => applyTicketStatus(ticket, "Estimate Accepted", "Estimate accepted and ready for office scheduling.")} onScheduleTicket={openResidentialSchedule} jobs={jobs} scheduledEstimateDatabaseIds={scheduledEstimateDatabaseIds} />;
    if (section === "calendar") return <CalendarSection events={scheduleEvents} crews={crews} onOpenJob={jobId => setSelectedCalendarJobId(jobId)} pendingResidentialDraft={canManageSchedule ? residentialDraft : null} onPendingResidentialDraftChange={setResidentialDraft} onSavePendingResidentialSchedule={saveResidentialSchedule} onCancelPendingResidentialSchedule={() => setResidentialDraft(null)} pendingBuilderSchedule={canManageSchedule ? builderScheduleDraft : null} onPendingBuilderScheduleChange={setBuilderScheduleDraft} onSavePendingBuilderSchedule={saveBuilderSchedule} onCancelPendingBuilderSchedule={() => setBuilderScheduleDraft(null)} readOnly={calendarReadOnly} loading={scheduleLoading} error={scheduleError} />;
    if (section === "jobs") return <JobsSection jobs={jobs} loading={jobsLoading} error={jobsError} onSelectJob={jobId => setSelectedJobId(jobId)} onCreateBuilderJob={openBuilderJobModal} canCreateBuilderJob={canManageSchedule} />;
    if (section === "customers") return <CustomersSection customers={customers} loading={customersLoading} error={customersError} tickets={tickets} jobs={jobs} onSelectCustomer={customerId => setSelectedCustomerId(customerId)} search={customerSearch} onSearchChange={setCustomerSearch} typeFilter={customerTypeFilter} onTypeFilterChange={setCustomerTypeFilter} statusFilter={customerStatusFilter} onStatusFilterChange={setCustomerStatusFilter} />;
    if (section === "crews") return <CrewsSection crews={crews} jobs={jobs} onCreateCrew={createCrew} onUpdateCrew={updateCrew} />;
    if (section === "builders") return <BuildersSection builders={builders} buildersLoading={buildersLoading} buildersError={buildersError} jobs={jobs} onCreateBuilderJob={openBuilderJobModal} onCreateBuilder={() => setBuilderRecordDraft({ name: "", contact: "", phone: "", communities: "" })} onOpenJob={jobId => setSelectedJobId(jobId)} />;
    if (section === "finance") return <FinanceDashboard financeView={financeView} onFinanceViewChange={setFinanceView} />;
    return <SettingsSection settings={settings} onUpdateSettings={patch => setSettings(prev => ({ ...prev, ...patch }))} historyCounts={{ scheduleChanges: scheduleHistory.length, overrides: overrideHistory.length }} />;
  })();

  return (
    <div className="admin-page-shell" style={{ minHeight: "100vh", background: "#F4F6F3" }}>
      {!selectedTicket && !selectedJob && !selectedCalendarJob && !selectedCustomer && (
        <div className="admin-shell">
          <AdminSidebar
            section={section}
            setSection={next => {
              setSection(next);
              if (next !== "finance") setFinanceView("overview");
            }}
            financeView={financeView}
            setFinanceView={setFinanceView}
            alerts={jobsNeedingAttention}
            mobileOpen={mobileNavOpen}
            onClose={() => setMobileNavOpen(false)}
            appRole={appRole}
            profileFullName={profileFullName}
            userEmail={userEmail}
            onLogout={onLogout}
            sections={allowedSections}
          />
          <div className="admin-main-shell">
            <AdminTopBar
              section={section}
              financeView={financeView}
              onOpenMenu={() => setMobileNavOpen(true)}
              setPage={setPage}
              sections={allowedSections}
            />
            <div className="admin-content-shell" style={{ padding: "22px 16px 60px" }}>
              {content}
            </div>
          </div>
        </div>
      )}
      {(selectedTicket || selectedJob || selectedCalendarJob || selectedCustomer) && content}

      {canManageSchedule && builderDraft && <BuilderJobModal draft={builderDraft} crews={crews} builders={builders} onClose={() => setBuilderDraft(null)} onSave={createBuilderJob} />}
      {hasFullAccess(appRole) && builderRecordDraft && <BuilderRecordModal draft={builderRecordDraft} onClose={() => setBuilderRecordDraft(null)} onSave={createBuilderRecord} />}
      {selectedCustomer && customerEditOpen && (
        <CustomerEditModal
          customer={selectedCustomer}
          saving={customerEditSaving}
          error={customerEditError}
          onClose={() => {
            if (customerEditSaving) return;
            setCustomerEditOpen(false);
            setCustomerEditError("");
          }}
          onSave={saveCustomerEdit}
        />
      )}
      {selectedCustomer && customerDeactivateOpen && (
        <CustomerDeactivateModal
          customer={selectedCustomer}
          saving={customerLifecycleSaving}
          error={customerLifecycleError}
          onClose={() => {
            if (customerLifecycleSaving) return;
            setCustomerDeactivateOpen(false);
            setCustomerLifecycleError("");
          }}
          onConfirm={confirmDeactivateCustomer}
        />
      )}
      {canManageSchedule && builderWorkflowDraft && <BuilderWorkflowScheduleModal draft={builderWorkflowDraft} crews={crews} onClose={() => setBuilderWorkflowDraft(null)} onSave={saveInitialBuilderWorkflow} />}
      {canManageSchedule && phaseDraft && <PhaseEditModal draft={phaseDraft} crews={crews} onClose={() => setPhaseDraft(null)} onSave={phaseDraft.isResidential ? saveResidentialReschedule : saveBuilderPhase} isResidential={phaseDraft.isResidential} />}
      {phaseDetailState && (
        <BuilderPhaseDetailsModal
          detail={phaseDetailState}
          crews={crews}
          profileDisplayNames={profileDisplayNames}
          onClose={() => setPhaseDetailState(null)}
          onSchedule={() => {
            const { job_id, phase_id } = phaseDetailState;
            setPhaseDetailState(null);
            openPhaseEdit(job_id, phase_id);
          }}
          onEdit={() => {
            const { job_id, phase_id } = phaseDetailState;
            setPhaseDetailState(null);
            openPhaseEdit(job_id, phase_id);
          }}
          onReschedule={() => {
            const { job_id, phase_id } = phaseDetailState;
            setPhaseDetailState(null);
            openPhaseEdit(job_id, phase_id);
          }}
        />
      )}
      {canManageSchedule && pushPreview && <PushSummaryModal preview={pushPreview} onClose={() => setPushPreview(null)} onConfirm={reason => applyPushPreview("", reason)} />}
      {canManageSchedule && weekendOverrideState && (
        <WeekendOverrideModal
          state={weekendOverrideState}
          crews={crews}
          onClose={() => setWeekendOverrideState(null)}
          onConfirm={override => weekendOverrideState.onConfirm?.(override)}
          onCancel={() => weekendOverrideState.onCancel?.()}
        />
      )}
      {warningState && <WarningModal state={warningState} onClose={() => setWarningState(null)} />}
      {canManageSchedule && conflictState && (
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
