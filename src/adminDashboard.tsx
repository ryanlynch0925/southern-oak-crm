import { useEffect, useMemo, useState } from "react";
import { useRef } from "react";

import FinanceDashboard from "./adminFinanceDashboard";
import { supabase } from "./lib/supabase";
import BuildersSection from "./features/admin/builders/BuildersSection";
import BuilderRecordModal from "./features/admin/builders/BuilderRecordModal";
import { BUILDER_COLOR_PALETTE, BUILDER_PHASES, BUILDER_SLAB_WORKFLOW, sortBuilderPhases } from "./features/admin/builders/builderUtils";
import { canAccessFinance, canAccessEstimates, canManageCalendar, canViewCalendar, hasFullAccess } from "./features/admin/auth/roles";
import { fetchProfileDisplayNames } from "./features/admin/calendar/calendarService";
import { ACTIVE_SITE_VISIT_DATABASE_STATUSES } from "./features/admin/calendar/calendarTypes";
import { calendarStatusToDatabaseStatus, databaseStatusToCalendarStatus, toDatabaseBuilderStep, toUiBuilderPhaseKey } from "./features/admin/calendar/calendarUtils";
import CrewsSection from "./features/admin/crews/CrewsSection";
import FinalEstimatePanel from "./features/admin/estimates/FinalEstimatePanel";
import {
  getEstimateStatusDisplayLabel,
  getEstimateWorkflowQuickAction,
  getEstimateWorkflowStageDefinition,
  getEstimateWorkflowStageDefinitions,
  getEstimateWorkflowStatusFilterOptions,
  resolveEffectiveEstimateWorkflowStage,
} from "./features/admin/estimates/estimateWorkflow";
import { databaseEstimateToTicket, mapTicketStatusToWorkflowStatus } from "./features/admin/estimates/estimateUtils";
import { appCrewToDatabaseCrew, databaseCrewToAppCrew, normalizeCrew } from "./features/admin/crews/crewMappers";
import { buildBuilderEvents, buildCalendarEvents, buildResidentialEvents, findCrewById, getCrewNumber } from "./features/admin/crews/crewUtils";
import { buildCustomerSearchText, formatCustomerDisplayName, formatCustomerEmailLink, formatCustomerPhoneLink, formatCustomerTypeLabel, normalizeCustomerText } from "./features/admin/customers/customerService";
import { useBuilders } from "./features/admin/hooks/useBuilders";
import { useCustomers } from "./features/admin/hooks/useCustomers";
import { useJobs } from "./features/admin/hooks/useJobs";
import { useScheduleEvents } from "./features/admin/hooks/useScheduleEvents";
import { fetchEstimateById } from "./features/admin/services/estimateService";
import { Btn, Card, Modal } from "./features/admin/shared/AdminPrimitives";
import { fmtDate, fmtMetricNumber, todayIso } from "./features/admin/shared/adminFormatters";
import { B, INP, labelStyle } from "./features/admin/shared/adminStyles";

const BRAND_LOGO_SRC = `${import.meta.env.BASE_URL}branding/main_logo.png`;
const RESIDENTIAL_EVENT_COLOR = "#6C3483";
const ADMIN_SECTION_STORAGE_KEY = "southern-oak-admin-section";
const SITE_VISIT_CALENDAR_PREFIX = "site_visit:";
const SITE_VISIT_DURATION_OPTIONS = [0.5, 0.75, 1, 1.5, 2, 3, 4];
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

const VALIDATION_COLOR = "#922B21";
const VALIDATION_BORDER = "#E5C3BD";
const VALIDATION_BG = "#FFF7F5";
const VALIDATION_RING = "0 0 0 3px rgba(192,57,43,0.12)";

function getErrorInputStyle(hasError, overrides = {}) {
  return {
    ...INP,
    ...(hasError ? { borderColor: VALIDATION_COLOR, boxShadow: VALIDATION_RING } : null),
    ...overrides,
  };
}

function FormValidationMessage({ message, id, style = {} }) {
  if (!message) {
    return null;
  }

  return (
    <div
      id={id}
      className="admin-form-validation"
      style={{
        border: `1px solid ${VALIDATION_BORDER}`,
        background: VALIDATION_BG,
        borderRadius: 8,
        padding: "10px 12px",
        fontSize: ".74rem",
        lineHeight: 1.5,
        color: VALIDATION_COLOR,
        fontWeight: 700,
        ...style,
      }}
    >
      {message}
    </div>
  );
}

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
  "Site Visit Scheduled": { c: "#25603C", bg: "#E6F3EA" },
  "Site Visit Completed": { c: "#275A85", bg: "#E8F1FA" },
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
const CUSTOMER_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DECISION_STYLES = {
  yes: { label: "Yes / Interested", short: "Yes", c: "#25603C", bg: "#E6F3EA" },
  no: { label: "No / Follow Up Needed", short: "No", c: "#9C640C", bg: "#FCF3CF" },
  pending: { label: "Awaiting decision", short: "Pending", c: "#5F645D", bg: "#F3F4F2" },
};

const ESTIMATE_WORKFLOW_FILTER_OPTIONS = getEstimateWorkflowStatusFilterOptions();
const PRIMARY_ESTIMATE_WORKFLOW_STAGES = getEstimateWorkflowStageDefinitions("primary");
const OUTCOME_ESTIMATE_WORKFLOW_STAGES = getEstimateWorkflowStageDefinitions("outcome");

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
const normalizeTimeInputValue = value => String(value || "").slice(0, 5);
const formatDurationLabel = hours => {
  const numericHours = Number(hours || 0);
  if (!numericHours) {
    return "0 hours";
  }

  return `${numericHours} hour${numericHours === 1 ? "" : "s"}`;
};
const addHoursToTime = (timeValue, durationHours) => {
  const normalizedTime = normalizeTimeInputValue(timeValue);
  if (!normalizedTime) {
    return "";
  }

  const [rawHours, rawMinutes] = normalizedTime.split(":");
  const startMinutes = (Number(rawHours || 0) * 60) + Number(rawMinutes || 0);
  const totalMinutes = startMinutes + Math.round(Number(durationHours || 0) * 60);
  const normalizedMinutes = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = String(Math.floor(normalizedMinutes / 60)).padStart(2, "0");
  const minutes = String(normalizedMinutes % 60).padStart(2, "0");

  return `${hours}:${minutes}`;
};
const buildTicketProjectAddress = ticket => (
  String(ticket.jobAddress || "").trim()
  || [ticket.addr, ticket.city].filter(Boolean).join(", ")
);
const formatSiteVisitScheduleSummary = (scheduledDate, startTime, endTime = "") => {
  if (!scheduledDate) {
    return "Not scheduled";
  }

  const timeRange = [normalizeTimeInputValue(startTime), normalizeTimeInputValue(endTime)]
    .filter(Boolean)
    .join(" - ");

  return timeRange ? `${fmtDate(scheduledDate)} at ${timeRange}` : fmtDate(scheduledDate);
};
const buildSiteVisitDraftFromTicket = (ticket, crews) => ({
  estimateDatabaseId: ticket.databaseId || "",
  estimateTicketId: ticket.id,
  customer_name: ticket.name || "",
  project_address: buildTicketProjectAddress(ticket),
  project_type: ticket.ptype || "Site Visit",
  scheduled_date: firstWorkingDate(plusDays(todayIso(), 1)),
  scheduled_time: "09:00",
  duration_hours: 1,
  crew_id: crews[0]?.id || "",
  notes: "",
  weekend_override: false,
});
const buildSiteVisitConflictCandidate = draft => ({
  id: `${SITE_VISIT_CALENDAR_PREFIX}${draft.estimateDatabaseId || draft.estimateTicketId || "draft"}`,
  jobId: `${SITE_VISIT_CALENDAR_PREFIX}${draft.estimateDatabaseId || draft.estimateTicketId || "draft"}`,
  phaseId: "",
  schedule_type: "site_visit",
  type_label: "Site Visit",
  title: `Site Visit - ${draft.customer_name || "Estimate"}`,
  customer_name: draft.customer_name || "",
  builder_name: "",
  job_type: draft.project_type || "Site Visit",
  address: draft.project_address || "",
  community: "",
  lot_number: "",
  work_order_number: draft.estimateTicketId || "",
  date: draft.scheduled_date,
  time: normalizeTimeInputValue(draft.scheduled_time),
  end_time: addHoursToTime(draft.scheduled_time, draft.duration_hours),
  crew_id: draft.crew_id || "",
  crew_number: "",
  capacity_used: Math.max(0.25, Math.min(1, Number(draft.duration_hours || 1) / 8)),
  counts_toward_crew: !!draft.crew_id,
  status: "Scheduled",
  phase_label: "Site Visit",
  color: RESIDENTIAL_EVENT_COLOR,
  notes: draft.notes || "",
});
const normalizeCustomerDecisionStatus = status => String(status || "").trim().toLowerCase();
const getDecisionCategory = ticket => {
  const customerStatus = normalizeCustomerDecisionStatus(ticket.customerStatus);
  if (customerStatus === "accepted") return "yes";
  if (customerStatus === "declined" || customerStatus === "not_sure") return "no";
  if (ticket.estimateDecision === "yes") return "yes";
  if (ticket.estimateDecision === "no") return "no";
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
  return <span className="status-pill" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "5px 10px", borderRadius: 999, background: cfg.bg, color: cfg.c, fontWeight: 700, fontSize: ".68rem", lineHeight: 1, whiteSpace: "nowrap", width: "fit-content", height: "auto" }}>{label || getEstimateStatusDisplayLabel(status) || status}</span>;
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
  const canViewFinanceExpenses = appRole === "owner" || appRole === "admin";
  const financeSubsections = [
    { id: "overview", label: "Overview" },
    { id: "revenue", label: "Revenue" },
    { id: "payments", label: "Payments" },
    ...(canViewFinanceExpenses ? [{ id: "expenses", label: "Expenses" }] : []),
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
  const shortcuts = [
    { label: "Estimate Tickets", icon: "ti-file-text", onClick: () => setSection("tickets") },
    { label: "Calendar Schedule", icon: "ti-calendar-event", onClick: () => setSection("calendar") },
    { label: "Jobs", icon: "ti-hammer", onClick: () => setSection("jobs") },
    { label: "Finance", icon: "ti-chart-pie-3", onClick: () => setSection("finance") },
  ];
  return (
    <div className="dashboard-home-shell">
      <SummaryCards tickets={tickets} jobs={jobs} events={events} conflicts={conflicts} />
      <div className="dashboard-main-grid">
        <Card className="admin-section-card dashboard-panel dashboard-operations-panel">
          <div className="dashboard-panel-head">
            <div>
              <h1 className="dashboard-panel-title">Operations Dashboard</h1>
              <p className="dashboard-panel-subtitle">Quick access into scheduling, estimate follow-up, and active work.</p>
            </div>
            <button className="oak-button oak-button--primary dashboard-primary-action" onClick={() => setSection("tickets")} style={{ minHeight: 42, padding: "10px 14px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700, fontFamily: "inherit" }}>
              Open Estimate Queue
            </button>
          </div>
          <div className="dashboard-shortcuts-grid">
            {shortcuts.map(item => (
              <button key={item.label} className="oak-button oak-button--outline dashboard-shortcut-button" onClick={item.onClick} style={{ borderRadius: 10, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <div className="dashboard-shortcut-meta">
                  <i className={`ti ${item.icon}`} style={{ fontSize: 14 }} aria-hidden="true" />
                  <span>Workspace</span>
                </div>
                <div className="dashboard-shortcut-title">{item.label}</div>
                <div className="dashboard-shortcut-helper">Open {item.label.toLowerCase()}.</div>
              </button>
            ))}
          </div>
        </Card>
        <Card className="admin-section-card dashboard-panel dashboard-attention-panel">
          <div className="dashboard-side-panel-head">
            <div className="dashboard-side-panel-title">Needs Attention</div>
            <div className="dashboard-side-panel-subtitle">Existing live follow-up items that need action soon.</div>
          </div>
          <div className="dashboard-needs-list">
            {openReceivables.map(ticket => (
              <div key={ticket.id} className="dashboard-needs-item">
                <div className="dashboard-needs-copy">
                  <div className="dashboard-needs-name">{ticket.name}</div>
                  <div className="dashboard-needs-meta">{ticket.ptype}</div>
                </div>
                <div className="dashboard-needs-status">{getEstimateStatusDisplayLabel(ticket.status)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card className="admin-section-card dashboard-panel dashboard-upcoming-panel">
        <div className="dashboard-side-panel-head">
          <div className="dashboard-side-panel-title">Upcoming Scheduled Work</div>
          <div className="dashboard-side-panel-subtitle">Existing live scheduled work cards, cleaned up for readability and wrapping.</div>
        </div>
        <div className="dashboard-upcoming-grid">
          {upcoming.map(event => (
            <div key={event.id} className="dashboard-upcoming-card">
              <div className="dashboard-upcoming-accent" aria-hidden="true" />
              <div className="dashboard-upcoming-body">
                <div className="dashboard-upcoming-name">{event.customer_name || `${event.builder_name} Lot ${event.lot_number}`}</div>
                <div className="dashboard-upcoming-datetime">{fmtDate(event.date)} · {event.time}</div>
                <div className="dashboard-upcoming-type">{event.phase_label}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
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
    <div className="admin-card-grid admin-summary-grid">
      {cards.map(card => (
        <Card key={card.label} className="dashboard-summary-card">
          <div className="dashboard-summary-head">
            <div className="dashboard-summary-icon" style={{ color: card.color }}>
              <i className={`ti ${card.icon}`} style={{ fontSize: 15 }} aria-hidden="true" />
            </div>
            <span className="dashboard-summary-label">{card.label}</span>
          </div>
          <div className="dashboard-summary-value" style={{ color: card.color }}>{card.value}</div>
        </Card>
      ))}
    </div>
  );
}

function EstimateTicketsSection({ tickets, ticketsLoading = false, ticketsError = "", onSelectTicket, onScheduleTicket, jobs, scheduledEstimateDatabaseIds = new Set() }) {
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
            <p style={{ fontSize: ".8rem", color: B.gray }}>Keep the current estimate queue moving, monitor customer decisions, and convert approved work into scheduled jobs.</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...INP, width: "auto", cursor: "pointer" }}>
              <option value="All">All statuses</option>
              {ESTIMATE_WORKFLOW_FILTER_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
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

function TicketDetailView({
  ticket,
  appRole,
  crews,
  onBack,
  onRefreshJobs,
  onUpdateTicket,
  onOpenSchedule,
  onScheduleSiteVisit,
  onViewSiteVisitCalendar,
  sourceJob,
}) {
  const [t, setT] = useState({ ...ticket });
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [quickActionSuccess, setQuickActionSuccess] = useState("");
  const [quickActionPending, setQuickActionPending] = useState("");
  const [siteVisitDraft, setSiteVisitDraft] = useState(null);
  const [siteVisitSaving, setSiteVisitSaving] = useState(false);
  const [siteVisitError, setSiteVisitError] = useState("");
  const finalEstimateSectionRef = useRef<HTMLDivElement | null>(null);
  const persistedTicketRef = useRef(ticket);
  const mutationRequestIdRef = useRef(0);
  const mutationLockRef = useRef(false);
  const isMountedRef = useRef(false);
  const decision = getDecisionCategory(t);
  const latestNotification = getLatestNotification(t);
  const persistedWorkflowStatus = String(ticket.workflowStatus || "").trim().toLowerCase();
  const persistedSiteVisitAppointment = ticket.siteVisitAppointment || null;
  const siteVisitAppointment = t.siteVisitAppointment || persistedSiteVisitAppointment;
  const canManageSiteVisits = canManageCalendar(appRole);
  const effectiveWorkflowStageId = resolveEffectiveEstimateWorkflowStage({
    status: t.status,
    workflowStatus: t.workflowStatus || persistedWorkflowStatus,
    customerStatus: t.customerStatus,
    finalEstimatePublications: t.finalEstimatePublications,
    siteVisitAppointment,
  });
  const effectiveWorkflowStage = getEstimateWorkflowStageDefinition(effectiveWorkflowStageId);
  const primaryQuickAction = getEstimateWorkflowQuickAction(effectiveWorkflowStageId, {
    canManageSiteVisits,
  });
  const showViewSiteVisitAction = !!siteVisitAppointment;
  const isSystemAcceptedStatus = effectiveWorkflowStageId === "estimate_accepted";
  const isQuickActionRunning = quickActionPending !== "" || siteVisitSaving;
  const isMutationRunning = saving || isQuickActionRunning;

  const invalidateMutationRequests = () => {
    mutationRequestIdRef.current += 1;
    mutationLockRef.current = false;
  };

  const beginMutationRequest = () => {
    if (mutationLockRef.current) {
      return null;
    }

    const requestId = mutationRequestIdRef.current + 1;
    mutationRequestIdRef.current = requestId;
    mutationLockRef.current = true;
    return requestId;
  };

  const isCurrentMutationRequest = requestId => (
    isMountedRef.current
    && mutationRequestIdRef.current === requestId
  );

  const finishMutationRequest = requestId => {
    if (mutationRequestIdRef.current === requestId) {
      mutationLockRef.current = false;
    }
  };

  const samePersistedTicket = (currentTicket, persistedTicket) => {
    if (!currentTicket || !persistedTicket) {
      return false;
    }

    if (currentTicket.databaseId && persistedTicket.databaseId) {
      return currentTicket.databaseId === persistedTicket.databaseId;
    }

    return currentTicket.id === persistedTicket.id;
  };

  const restorePersistedDecisionFields = () => {
    const persistedTicket = persistedTicketRef.current;

    setT((current) => {
      if (!samePersistedTicket(current, persistedTicket)) {
        return current;
      }

      return {
        ...current,
        status: persistedTicket.status,
        customerStatus: persistedTicket.customerStatus ?? null,
        workflowStatus: persistedTicket.workflowStatus ?? null,
        followUpNeeded: persistedTicket.followUpNeeded,
        history: Array.isArray(persistedTicket.history) ? [...persistedTicket.history] : [],
      };
    });
  };

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      invalidateMutationRequests();
    };
  }, []);

  useEffect(() => {
    persistedTicketRef.current = ticket;
    invalidateMutationRequests();
    setT({ ...ticket });
    setSaving(false);
    setSaved(false);
    setQuickActionPending("");
    setSiteVisitSaving(false);
  }, [ticket]);

  useEffect(() => {
    setSiteVisitDraft(null);
    setSiteVisitError("");
    setSiteVisitSaving(false);
  }, [ticket.databaseId, ticket.id]);

  const buildStatusHistoryEntry = (status, message) => ({
    s: status,
    d: new Date().toISOString(),
    n: message,
  });

  const appendStatusHistoryEntry = (history, entry) => {
    const existingHistory = Array.isArray(history) ? history : [];
    const lastEntry = existingHistory[existingHistory.length - 1];

    if (lastEntry?.s === entry.s && lastEntry?.n === entry.n) {
      return existingHistory;
    }

    return [...existingHistory, entry];
  };

  const buildTicketWithStatus = (currentTicket, status, entry) => ({
    ...currentTicket,
    status,
    workflowStatus: mapTicketStatusToWorkflowStatus(
      status,
      currentTicket.workflowStatus || "new_request"
    ),
    followUpNeeded: status === "Follow Up Needed" || status === "Site Visit Needed",
    history: appendStatusHistoryEntry(currentTicket.history, entry),
  });

  const mergeSavedTicketHistory = (savedTicket, entry) => {
    const existingHistory = Array.isArray(savedTicket.history) ? [...savedTicket.history] : [];
    const lastEntry = existingHistory[existingHistory.length - 1];

    if (lastEntry?.s === entry.s && lastEntry?.n === "Current estimate status from Supabase") {
      existingHistory[existingHistory.length - 1] = entry;
      return {
        ...savedTicket,
        history: existingHistory,
      };
    }

    return {
      ...savedTicket,
      history: appendStatusHistoryEntry(existingHistory, entry),
    };
  };

  const refreshTicketFromDatabase = async () => {
    if (!ticket.databaseId) {
      return null;
    }

    const refreshedEstimate = await fetchEstimateById(ticket.databaseId);
    const refreshedTicket = databaseEstimateToTicket(refreshedEstimate);
    const syncedTicket = await onUpdateTicket(refreshedTicket);
    const nextTicket = syncedTicket || refreshedTicket;
    setT(nextTicket);
    return nextTicket;
  };

  const save = async () => {
    const requestId = beginMutationRequest();
    if (requestId == null) {
      return;
    }

    const persistedBaseline = persistedTicketRef.current;

    setSaving(true);
    setSaveError("");
    setQuickActionSuccess("");
    setSiteVisitError("");
    try {
      const savedTicket = await onUpdateTicket(t);

      if (!isCurrentMutationRequest(requestId)) {
        return;
      }

      const previousCustomerStatus = normalizeCustomerDecisionStatus(persistedBaseline.customerStatus);
      const savedCustomerStatus = normalizeCustomerDecisionStatus(savedTicket?.customerStatus ?? t.customerStatus);
      if (savedTicket) {
        setT(savedTicket);
      }
      if (previousCustomerStatus !== "accepted" && savedCustomerStatus === "accepted") {
        void onRefreshJobs();
      }
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onBack();
      }, 350);
    } catch (error) {
      if (!isCurrentMutationRequest(requestId)) {
        return;
      }

      const message = error instanceof Error ? error.message : "Unable to save estimate changes.";
      console.error("Unable to save ticket:", error);
      setSaveError(message);
      restorePersistedDecisionFields();
    } finally {
      finishMutationRequest(requestId);

      if (isCurrentMutationRequest(requestId)) {
        setSaving(false);
      }
    }
  };

  const changeStatus = status => {
    if (isMutationRunning) {
      return;
    }

    const stage = getEstimateWorkflowStageDefinition(
      resolveEffectiveEstimateWorkflowStage({
        status,
        workflowStatus: mapTicketStatusToWorkflowStatus(status, t.workflowStatus || "new_request"),
        customerStatus: t.customerStatus,
        finalEstimatePublications: t.finalEstimatePublications,
        siteVisitAppointment,
      })
    );

    if (!stage?.manualSelectable || isSystemAcceptedStatus) {
      return;
    }

    const entry = buildStatusHistoryEntry(status, "Status updated in admin dashboard");
    setQuickActionSuccess("");
    setT((prev) => {
      const nextTicket = buildTicketWithStatus(prev, status, entry);
      return {
        ...nextTicket,
        workflowStatus: nextTicket.workflowStatus,
        customerStatus: prev.customerStatus ?? null,
      };
    });
  };

  const runQuickAction = async ({
    status,
    note: historyNote,
    successMessage,
    workflowStatus,
    customerStatus,
  }: {
    status: string;
    note: string;
    successMessage: string;
    workflowStatus?: string;
    customerStatus?: string | null;
  }) => {
    if (status === "Estimate Accepted") {
      return;
    }

    const requestId = beginMutationRequest();
    if (requestId == null) {
      return;
    }

    const entry = buildStatusHistoryEntry(status, historyNote);
    const resolvedCustomerStatus = customerStatus ?? t.customerStatus ?? null;
    const updatedTicket = {
      ...buildTicketWithStatus(t, status, entry),
      workflowStatus: workflowStatus || mapTicketStatusToWorkflowStatus(status, t.workflowStatus || "new_request"),
      customerStatus: resolvedCustomerStatus,
    };

    setQuickActionPending(status);
    setQuickActionSuccess("");
    setSaveError("");
    setSiteVisitError("");

    try {
      const savedTicket = await onUpdateTicket(updatedTicket);

      if (!isCurrentMutationRequest(requestId)) {
        return;
      }

      const nextTicket = savedTicket
        ? mergeSavedTicketHistory(savedTicket, entry)
        : updatedTicket;

      setT(nextTicket);
      setQuickActionSuccess(successMessage);
    } catch (error) {
      if (!isCurrentMutationRequest(requestId)) {
        return;
      }

      const message = error instanceof Error ? error.message : "Unable to run the quick action.";
      console.error("Unable to run estimate quick action:", error);
      setSaveError(message);
    } finally {
      finishMutationRequest(requestId);

      if (isCurrentMutationRequest(requestId)) {
        setQuickActionPending("");
      }
    }
  };

  const openSiteVisitSchedule = () => {
    if (isMutationRunning) {
      return;
    }

    setQuickActionSuccess("");
    setSaveError("");
    setSiteVisitError("");
    setSiteVisitDraft(buildSiteVisitDraftFromTicket(t, crews));
  };

  const focusFinalEstimateSection = () => {
    finalEstimateSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setQuickActionSuccess("Final Estimate section is ready below.");
    setSaveError("");
  };

  const saveSiteVisitSchedule = async draft => {
    const requestId = beginMutationRequest();
    if (requestId == null) {
      return;
    }

    setSiteVisitSaving(true);
    setQuickActionSuccess("");
    setSaveError("");
    setSiteVisitError("");

    try {
      const savedTicket = await onScheduleSiteVisit(t, draft);

      if (!isMountedRef.current) {
        return;
      }

      setSiteVisitDraft(null);
      setSiteVisitError("");

      if (!isCurrentMutationRequest(requestId)) {
        return;
      }

      if (savedTicket) {
        setT(savedTicket);
      }
      setQuickActionSuccess("Site visit scheduled and workflow moved to Site Visit Scheduled.");
    } catch (error) {
      if (!isCurrentMutationRequest(requestId)) {
        return;
      }

      const message = error instanceof Error ? error.message : "Unable to schedule the site visit.";
      console.error("Unable to schedule site visit:", error);
      setSiteVisitError(message);
    } finally {
      finishMutationRequest(requestId);

      if (isCurrentMutationRequest(requestId)) {
        setSiteVisitSaving(false);
      }
    }
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
            <Btn onClick={save} v="green" sm disabled={isMutationRunning}><i className="ti ti-device-floppy" style={{ marginRight: 5, fontSize: 13, verticalAlign: -2 }} aria-hidden="true" />{saving ? "Saving..." : "Save Changes"}</Btn>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px 60px" }}>
        {(saveError || quickActionSuccess) && (
          <Card style={{ marginBottom: 16, background: "#FFF8E1", borderColor: "#E5D7A7" }}>
            <div style={{ fontSize: ".82rem", color: quickActionSuccess ? "#25603C" : "#8A6A12", fontWeight: 700 }}>
              {quickActionSuccess ? "Quick action completed." : "Estimate changes were not saved."}
            </div>
            <div style={{ fontSize: ".76rem", color: B.gray, marginTop: 4 }}>{quickActionSuccess || saveError}</div>
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

            <div ref={finalEstimateSectionRef}>
              <FinalEstimatePanel
                ticket={t}
                appRole={appRole}
                setTicket={setT}
                onRefreshTicket={refreshTicketFromDatabase}
              />
            </div>

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
                        <span style={{ fontSize: ".78rem", fontWeight: 700, color: B.dark }}>{getEstimateStatusDisplayLabel(h.s)}</span>
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
              <h3 style={{ fontSize: ".82rem", fontWeight: 700, color: B.dark, textTransform: "uppercase", letterSpacing: .5, marginBottom: 12 }}><i className="ti ti-bolt" style={{ marginRight: 6, color: B.bronze }} aria-hidden="true" />Quick Actions</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {primaryQuickAction.kind === "status" && (
                  <Btn
                    full
                    sm
                    v="green"
                    onClick={() => {
                      void runQuickAction({
                        status: primaryQuickAction.targetStatus,
                        note: primaryQuickAction.historyNote,
                        successMessage: primaryQuickAction.successMessage,
                      });
                    }}
                    disabled={isMutationRunning}
                  >
                    <i className={primaryQuickAction.icon} style={{ marginRight: 5, fontSize: 13 }} aria-hidden="true" />
                    {quickActionPending === primaryQuickAction.targetStatus ? "Updating..." : primaryQuickAction.label}
                  </Btn>
                )}
                {primaryQuickAction.kind === "schedule_site_visit" && (
                  <Btn full sm v="green" onClick={openSiteVisitSchedule} disabled={isMutationRunning}>
                    <i className={primaryQuickAction.icon} style={{ marginRight: 5, fontSize: 13 }} aria-hidden="true" />
                    {primaryQuickAction.label}
                  </Btn>
                )}
                {primaryQuickAction.kind === "focus_final_estimate" && (
                  <>
                    <Btn full sm v="green" onClick={focusFinalEstimateSection}>
                      <i className={primaryQuickAction.icon} style={{ marginRight: 5, fontSize: 13 }} aria-hidden="true" />
                      {primaryQuickAction.label}
                    </Btn>
                    <div style={{ fontSize: ".76rem", color: B.gray, lineHeight: 1.5 }}>{primaryQuickAction.helperText}</div>
                  </>
                )}
                {primaryQuickAction.kind === "schedule_job" && (
                  <Btn full sm v="dark" onClick={() => onOpenSchedule(t)} disabled={isMutationRunning}>
                    <i className={primaryQuickAction.icon} style={{ marginRight: 5, fontSize: 13 }} aria-hidden="true" />
                    {primaryQuickAction.label}
                  </Btn>
                )}
                {primaryQuickAction.kind === "info" && (
                  <div style={{ borderRadius: 8, padding: "10px 12px", background: B.sandD, color: B.mid, fontSize: ".76rem", lineHeight: 1.5 }}>
                    <strong style={{ display: "block", color: B.dark, marginBottom: 4 }}>{primaryQuickAction.label}</strong>
                    {primaryQuickAction.helperText}
                  </div>
                )}
                {showViewSiteVisitAction && (
                  <Btn full sm v="dark" onClick={() => onViewSiteVisitCalendar(siteVisitAppointment)}>
                    <i className="ti ti-calendar-event" style={{ marginRight: 5, fontSize: 13 }} aria-hidden="true" />
                    View on Calendar
                  </Btn>
                )}
                {primaryQuickAction.kind === "none" && (
                  <div style={{ fontSize: ".76rem", color: B.gray, lineHeight: 1.5 }}>{primaryQuickAction.helperText}</div>
                )}
                <Btn full sm v="outline" onClick={save} disabled={isMutationRunning}>
                  <i className="ti ti-device-floppy" style={{ marginRight: 5, fontSize: 13 }} aria-hidden="true" />{saving ? "Saving..." : "Save Lead Updates"}
                </Btn>
                {sourceJob && <div style={{ fontSize: ".75rem", color: B.green, fontWeight: 700 }}>This estimate already has a scheduled job.</div>}
              </div>
            </Card>

            {siteVisitAppointment && (
              <Card>
                <h3 style={{ fontSize: ".82rem", fontWeight: 700, color: B.dark, textTransform: "uppercase", letterSpacing: .5, marginBottom: 12 }}><i className="ti ti-map-pin" style={{ marginRight: 6, color: B.bronze }} aria-hidden="true" />Site Visit Appointment</h3>
                <div style={{ display: "grid", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 2 }}>Scheduled</div>
                    <div style={{ fontSize: ".82rem", color: B.dark, fontWeight: 600 }}>{formatSiteVisitScheduleSummary(siteVisitAppointment.scheduledDate, siteVisitAppointment.startTime, siteVisitAppointment.endTime)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 2 }}>Assigned crew</div>
                    <div style={{ fontSize: ".82rem", color: B.dark }}>{siteVisitAppointment.crewLabel || "Unassigned"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 2 }}>Address</div>
                    <div style={{ fontSize: ".82rem", color: B.dark }}>{siteVisitAppointment.projectAddress || "-"}</div>
                  </div>
                  {siteVisitAppointment.notes && (
                    <div>
                      <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 2 }}>Notes</div>
                      <div style={{ fontSize: ".8rem", color: B.mid, lineHeight: 1.5 }}>{siteVisitAppointment.notes}</div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Btn sm v="outline" onClick={() => onViewSiteVisitCalendar(siteVisitAppointment)}>
                      <i className="ti ti-calendar-event" style={{ marginRight: 5, fontSize: 13 }} aria-hidden="true" />
                      View on Calendar
                    </Btn>
                  </div>
                </div>
              </Card>
            )}

            <Card>
              <h3 style={{ fontSize: ".82rem", fontWeight: 700, color: B.dark, textTransform: "uppercase", letterSpacing: .5, marginBottom: 12 }}><i className="ti ti-tag" style={{ marginRight: 6, color: B.bronze }} aria-hidden="true" />Status</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {PRIMARY_ESTIMATE_WORKFLOW_STAGES.map((stage) => {
                  const isCurrentStage = effectiveWorkflowStageId === stage.id;
                  const isDisabled = isMutationRunning || !stage.manualSelectable || isSystemAcceptedStatus;

                  return (
                    <button key={stage.id} onClick={() => changeStatus(stage.ticketStatus)} disabled={isDisabled} style={{ padding: "8px 12px", borderRadius: 6, border: `1.5px solid ${isCurrentStage ? B.green : B.border}`, background: isCurrentStage ? "#deeade" : stage.manualSelectable ? B.white : "#F7F6F0", color: isCurrentStage ? B.green : stage.manualSelectable ? B.mid : B.gray, fontWeight: isCurrentStage ? 700 : 500, fontSize: ".76rem", cursor: isDisabled ? "not-allowed" : "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", opacity: isDisabled ? 0.85 : 1 }}>
                      <span>{stage.displayLabel}</span>
                      {isCurrentStage && <i className="ti ti-check" style={{ fontSize: 13, color: B.green }} aria-hidden="true" />}
                    </button>
                  );
                })}
                {effectiveWorkflowStage?.helperText && (
                  <div style={{ fontSize: ".72rem", color: B.gray, lineHeight: 1.5 }}>
                    {effectiveWorkflowStage.helperText}
                  </div>
                )}
                <div style={{ marginTop: 8, fontSize: ".72rem", fontWeight: 700, color: B.gray, textTransform: "uppercase", letterSpacing: .5 }}>
                  Other Outcomes
                </div>
                {OUTCOME_ESTIMATE_WORKFLOW_STAGES.map((stage) => {
                  const isCurrentStage = effectiveWorkflowStageId === stage.id;
                  const isDisabled = isMutationRunning;

                  return (
                    <button key={stage.id} onClick={() => changeStatus(stage.ticketStatus)} disabled={isDisabled} style={{ padding: "8px 12px", borderRadius: 6, border: `1.5px solid ${isCurrentStage ? B.green : B.border}`, background: isCurrentStage ? "#deeade" : B.white, color: isCurrentStage ? B.green : B.mid, fontWeight: isCurrentStage ? 700 : 500, fontSize: ".76rem", cursor: isDisabled ? "not-allowed" : "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", opacity: isDisabled ? 0.85 : 1 }}>
                      <span>{stage.displayLabel}</span>
                      {isCurrentStage && <i className="ti ti-check" style={{ fontSize: 13, color: B.green }} aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card>
              <h3 style={{ fontSize: ".82rem", fontWeight: 700, color: B.dark, textTransform: "uppercase", letterSpacing: .5, marginBottom: 12 }}><i className="ti ti-route" style={{ marginRight: 6, color: B.bronze }} aria-hidden="true" />Initial Estimate Range Response</h3>
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
              <div>
                <label style={{ display: "block", fontSize: ".76rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>Follow-up date</label>
                <input style={INP} type="date" value={t.followUp || ""} onChange={e => setT(prev => ({ ...prev, followUp: e.target.value }))} />
              </div>
            </Card>

          </div>
        </div>
      </div>

      {siteVisitDraft && (
        <SiteVisitScheduleModal
          draft={siteVisitDraft}
          crews={crews}
          onClose={() => {
            if (siteVisitSaving) {
              return;
            }
            setSiteVisitDraft(null);
            setSiteVisitError("");
          }}
          onSave={saveSiteVisitSchedule}
          saving={siteVisitSaving}
          error={siteVisitError}
        />
      )}
    </div>
  );
}

function SiteVisitScheduleModal({ draft, crews, onClose, onSave, saving = false, error = "" }) {
  const [local, setLocal] = useState(draft);

  useEffect(() => {
    setLocal(draft);
  }, [draft]);

  return (
    <Modal title="Schedule Site Visit" onClose={onClose} width={680}>
      <div className="schedule-modal-stack">
        <div className="schedule-modal-intro">
          <div style={{ fontSize: ".82rem", color: B.gray }}>
            Schedule the site visit using the existing calendar crew assignment flow. Sundays remain blocked and Saturday overrides follow the standard calendar rules.
          </div>
        </div>
        <FormValidationMessage message={error} style={{ marginBottom: error ? 12 : 0 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
        <div>
          <label style={labelStyle}>Customer name</label>
          <input style={{ ...INP, background: "#F7F6F0" }} value={local.customer_name} disabled />
        </div>
        <div>
          <label style={labelStyle}>Estimate ticket ID</label>
          <input style={{ ...INP, background: "#F7F6F0" }} value={local.estimateTicketId} disabled />
        </div>
        <div>
          <label style={labelStyle}>Project type</label>
          <input style={{ ...INP, background: "#F7F6F0" }} value={local.project_type} disabled />
        </div>
        <div>
          <label style={labelStyle}>Project address</label>
          <input style={{ ...INP, background: "#F7F6F0" }} value={local.project_address} disabled />
        </div>
        <div>
          <label htmlFor="site-visit-scheduled-date" style={labelStyle}>Site visit date</label>
          <input
            id="site-visit-scheduled-date"
            style={INP}
            type="date"
            value={local.scheduled_date}
            onChange={e => setLocal(prev => ({ ...prev, scheduled_date: e.target.value }))}
            disabled={saving}
          />
        </div>
        <div>
          <label htmlFor="site-visit-scheduled-time" style={labelStyle}>Start time</label>
          <input
            id="site-visit-scheduled-time"
            style={INP}
            type="time"
            value={local.scheduled_time}
            onChange={e => setLocal(prev => ({ ...prev, scheduled_time: e.target.value }))}
            disabled={saving}
          />
        </div>
        <div>
          <label htmlFor="site-visit-crew" style={labelStyle}>Assigned crew</label>
          <select
            id="site-visit-crew"
            style={{ ...INP, cursor: saving ? "default" : "pointer" }}
            value={local.crew_id}
            onChange={e => setLocal(prev => ({ ...prev, crew_id: e.target.value }))}
            disabled={saving}
          >
            {crews.map(crew => <option key={crew.id} value={crew.id}>{crew.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="site-visit-duration" style={labelStyle}>Estimated duration</label>
          <select
            id="site-visit-duration"
            style={{ ...INP, cursor: saving ? "default" : "pointer" }}
            value={String(local.duration_hours)}
            onChange={e => setLocal(prev => ({ ...prev, duration_hours: Number(e.target.value || 1) }))}
            disabled={saving}
          >
            {SITE_VISIT_DURATION_OPTIONS.map(option => (
              <option key={option} value={option}>{formatDurationLabel(option)}</option>
            ))}
          </select>
          <div style={{ fontSize: ".72rem", color: B.gray, marginTop: 4 }}>
            Estimated end time: {addHoursToTime(local.scheduled_time, local.duration_hours) || "-"}
          </div>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="site-visit-notes" style={labelStyle}>Site visit notes</label>
          <textarea
            id="site-visit-notes"
            style={{ ...INP, minHeight: 96 }}
            value={local.notes}
            onChange={e => setLocal(prev => ({ ...prev, notes: e.target.value }))}
            disabled={saving}
          />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 18, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: ".76rem", color: B.gray }}>
          This creates a real calendar event and then updates the workflow to Site Visit Scheduled automatically.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn v="outline" onClick={onClose} disabled={saving}>Cancel</Btn>
          <Btn v="green" onClick={() => onSave(local)} disabled={saving}>
            {saving ? "Scheduling..." : "Schedule Site Visit"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

function CalendarSection({
  events,
  crews,
  onOpenJob,
  focusDate,
  pendingResidentialDraft,
  onPendingResidentialDraftChange,
  onSavePendingResidentialSchedule,
  onCancelPendingResidentialSchedule,
  pendingBuilderSchedule,
  onPendingBuilderScheduleChange,
  onSavePendingBuilderSchedule,
  onCancelPendingBuilderSchedule,
  readOnly = false,
  loading = false,
  error = "",
  residentialValidation = null,
  onResidentialValidationReset = () => {},
  builderValidation = null,
  onBuilderValidationReset = () => {},
}) {
  const [view, setView] = useState("month");
  const [anchorDate, setAnchorDate] = useState(todayIso());
  const [filters, setFilters] = useState({ crewId: "All", builderId: "All", scheduleType: "All", jobType: "All", status: "All" });
  const schedulingLocked = !readOnly && (!!pendingResidentialDraft || !!pendingBuilderSchedule);
  const activeDraftDate = pendingResidentialDraft?.scheduled_date || pendingBuilderSchedule?.scheduled_date || "";
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

  useEffect(() => {
    if (focusDate) {
      setAnchorDate(focusDate);
    }
  }, [focusDate]);

  useEffect(() => {
    if (!residentialValidation?.field) return;
    const targetId = residentialValidation.field === "reschedule_reason"
      ? "residential-schedule-reschedule-reason-preset"
      : `residential-schedule-${residentialValidation.field}`;
    requestAnimationFrame(() => document.getElementById(targetId)?.focus());
  }, [residentialValidation?.field, pendingResidentialDraft?.scheduleEventDatabaseId]);

  useEffect(() => {
    if (!builderValidation?.field) return;
    requestAnimationFrame(() => document.getElementById(`builder-schedule-${builderValidation.field}`)?.focus());
  }, [builderValidation?.field]);

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
      onResidentialValidationReset();
      onPendingResidentialDraftChange({ ...pendingResidentialDraft, scheduled_date: iso });
    }
    if (pendingBuilderSchedule) {
      onBuilderValidationReset();
      onPendingBuilderScheduleChange({ ...pendingBuilderSchedule, scheduled_date: iso });
    }
  };
  const rangeLabel = view === "month"
    ? new Date(`${anchorDate}T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : view === "week"
      ? `Week of ${fmtDate(anchorDate)}`
      : fmtDate(anchorDate);
  const residentialExistingReason = String(pendingResidentialDraft?.last_reschedule_reason || "").trim();
  const residentialSummaryError = residentialValidation && !residentialValidation.field ? residentialValidation.message : "";
  const builderSummaryError = builderValidation && !builderValidation.field ? builderValidation.message : "";
  const getEventTitle = event => event.customer_name || event.builder_name || event.title;
  const getEventSubtitle = event => (
    event.schedule_type === "builder_slab"
      ? (event.phase_label || "Builder phase")
      : event.schedule_type === "site_visit"
        ? (event.address || event.job_type || "Site Visit")
        : (event.job_type || "Residential")
  );
  const getEventMeta = event => `${event.time || "-"} · Crew ${findCrewById(crews, event.crew_id)?.number || "-"}`;
  const getOpenRecordLabel = event => event.schedule_type === "site_visit" ? "Open estimate" : "Open job";
  const handleResidentialDraftChange = patch => {
    onResidentialValidationReset();
    onPendingResidentialDraftChange({ ...pendingResidentialDraft, ...patch });
  };
  const handleBuilderDraftChange = patch => {
    onBuilderValidationReset();
    onPendingBuilderScheduleChange({ ...pendingBuilderSchedule, ...patch });
  };

  return (
    <>
      <Card className="calendar-header-card" style={{ marginBottom: 14 }}>
        <div className="calendar-header-top">
          <div className="calendar-header-copy">
            <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: B.dark, margin: 0 }}>Calendar Schedule</h1>
            <p style={{ fontSize: ".82rem", color: B.gray, margin: "6px 0 0" }}>View residential jobs, site visits, and builder slab phases by month, week, or day with crew and builder filters.</p>
          </div>
          <div className="calendar-view-toggle" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["month", "week", "day"].map(item => (
              <button
                className={`oak-button calendar-view-button${view === item ? " is-active" : ""}`}
                key={item}
                onClick={() => setView(item)}
                style={{ padding: "9px 14px", borderRadius: 8, border: `1.5px solid ${view === item ? B.green : B.border}`, background: view === item ? "#e9e0ca" : B.white, color: view === item ? B.green : B.mid, fontWeight: 700, fontSize: ".77rem", cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="calendar-filters" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginTop: 14 }}>
          <label className="calendar-filter-field">
            <span className="calendar-filter-label">Crew</span>
            <select value={filters.crewId} onChange={e => setFilters(prev => ({ ...prev, crewId: e.target.value }))} style={{ ...INP, cursor: "pointer" }}>
              <option value="All">All crews</option>
              {crews.map(crew => <option key={crew.id} value={crew.id}>{crew.name}</option>)}
            </select>
          </label>
          <label className="calendar-filter-field">
            <span className="calendar-filter-label">Builder</span>
            <select value={filters.builderId} onChange={e => setFilters(prev => ({ ...prev, builderId: e.target.value }))} style={{ ...INP, cursor: "pointer" }}>
              <option value="All">All builders</option>
              {builderNames.map(builderName => <option key={builderName} value={builderName}>{builderName}</option>)}
            </select>
          </label>
          <label className="calendar-filter-field">
            <span className="calendar-filter-label">Work type</span>
            <select value={filters.scheduleType} onChange={e => setFilters(prev => ({ ...prev, scheduleType: e.target.value }))} style={{ ...INP, cursor: "pointer" }}>
              <option value="All">Residential, site visits, and builder jobs</option>
              <option value="residential">Residential jobs</option>
              <option value="site_visit">Site visits</option>
              <option value="builder_slab">Builder jobs</option>
            </select>
          </label>
          <label className="calendar-filter-field">
            <span className="calendar-filter-label">Status</span>
            <select value={filters.status} onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))} style={{ ...INP, cursor: "pointer" }}>
              <option value="All">All statuses</option>
              {JOB_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
        </div>
      </Card>

      {readOnly && (
        <Card className="calendar-readonly-card" style={{ marginBottom: 14, background: "#F7F6F0" }}>
          <div style={{ fontSize: ".82rem", color: B.mid, fontWeight: 700 }}>Field view is read-only.</div>
          <div style={{ fontSize: ".76rem", color: B.gray, marginTop: 3 }}>Scheduled work details are available, but creating, editing, rescheduling, deleting, and crew assignment controls are disabled for this role.</div>
        </Card>
      )}

      <div className="calendar-layout" style={{ display: "grid", gridTemplateColumns: schedulingLocked ? "minmax(0,1fr) 320px" : "1fr", gap: 14 }}>
        <Card className="admin-section-card calendar-main-card">
          <div className="calendar-main-toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
            <div className="calendar-nav-controls" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span className="calendar-nav-label">Browse</span>
              <Btn sm v="outline" onClick={() => shiftView(-1)}><i className="ti ti-chevron-left" aria-hidden="true" /></Btn>
              <Btn sm v="outline" onClick={() => setAnchorDate(todayIso())}>Today</Btn>
              <Btn sm v="outline" onClick={() => shiftView(1)}><i className="ti ti-chevron-right" aria-hidden="true" /></Btn>
            </div>
            <div className="calendar-range-title" style={{ fontSize: "1rem", fontWeight: 700, color: B.dark }}>{rangeLabel}</div>
          </div>

          {loading && <div className="calendar-state-copy" style={{ fontSize: ".84rem", color: B.gray, fontWeight: 600 }}>Loading calendar...</div>}
          {!loading && error && <div className="calendar-state-copy" style={{ fontSize: ".84rem", color: "#8A6A12", fontWeight: 700 }}>Unable to load calendar.</div>}
          {!loading && !error && filtered.length === 0 && <div className="calendar-state-copy" style={{ fontSize: ".84rem", color: B.gray, fontWeight: 600 }}>No scheduled work found.</div>}

          {!loading && !error && filtered.length > 0 && view === "month" && (
            <div className="calendar-scroll-wrapper">
              <div className="calendar-month-grid" style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 8 }}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <div key={day} className="calendar-weekday-label">{day}</div>)}
                {monthDays.map(day => {
                  const isSelectedDay = anchorDate === day.iso;
                  const isDraftDay = activeDraftDate === day.iso;
                  return (
                    <div
                      className={`calendar-day-card${day.inMonth ? "" : " is-outside-month"}${isSelectedDay ? " is-selected" : ""}${isDraftDay ? " is-draft-target" : ""}`}
                      key={day.iso}
                      onClick={() => pickScheduleDate(day.iso)}
                      style={{ minHeight: 132, border: `1px solid ${isDraftDay ? B.bronze : isSelectedDay ? B.green : B.border}`, borderRadius: 10, padding: 10, background: day.inMonth ? B.white : B.sand, cursor: readOnly ? "default" : "pointer", boxShadow: isDraftDay ? `inset 0 0 0 1px ${B.bronze}` : "none" }}
                    >
                      <div className="calendar-day-card-head">
                        <span className={`calendar-day-number${isWeekend(day.iso) ? " is-weekend" : ""}${todayIso() === day.iso ? " is-today" : ""}`}>{new Date(`${day.iso}T12:00:00`).getDate()}</span>
                        <span className={`calendar-day-count${isDraftDay ? " is-pending" : ""}`}>{day.events.length > 0 ? `${day.events.length} item${day.events.length === 1 ? "" : "s"}` : isDraftDay ? "Selected" : ""}</span>
                      </div>
                      <div className="calendar-day-events">
                        {day.events.length === 0 && <div className="calendar-empty-copy">No scheduled work</div>}
                        {day.events.slice(0, 3).map(event => (
                          <button
                            className={`calendar-event calendar-event--month${event.schedule_type === "builder_slab" ? " is-builder" : " is-residential"}`}
                            key={event.id}
                            onClick={e => {
                              e.stopPropagation();
                              if (!schedulingLocked) onOpenJob(event.jobId);
                            }}
                            style={{ background: eventColor(event), color: B.white, border: "none", borderRadius: 8, fontSize: ".66rem", padding: "7px 8px", textAlign: "left", cursor: schedulingLocked ? "default" : "pointer" }}
                          >
                            <div className="calendar-event-title">{getEventTitle(event)}</div>
                            <div className="calendar-event-subtitle">{getEventSubtitle(event)}</div>
                            <div className="calendar-event-meta">{getEventMeta(event)}</div>
                          </button>
                        ))}
                        {day.events.length > 3 && <div className="calendar-more-copy">+{day.events.length - 3} more</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && view === "week" && (
            <div className="calendar-scroll-wrapper">
              <div className="calendar-week-grid" style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 10 }}>
                {weekDays.map(day => {
                  const isSelectedDay = anchorDate === day.iso;
                  const isDraftDay = activeDraftDate === day.iso;
                  return (
                    <div
                      className={`calendar-day-card calendar-day-card--week${isSelectedDay ? " is-selected" : ""}${isDraftDay ? " is-draft-target" : ""}`}
                      key={day.iso}
                      onClick={() => pickScheduleDate(day.iso)}
                      style={{ border: `1px solid ${isDraftDay ? B.bronze : isSelectedDay ? B.green : B.border}`, borderRadius: 10, padding: 12, minHeight: 280, cursor: readOnly ? "default" : "pointer" }}
                    >
                      <div className="calendar-week-day-heading">
                        <div className={`calendar-week-day-label${isWeekend(day.iso) ? " is-weekend" : ""}`}>{fmtDateShort(day.iso)}</div>
                        <div className="calendar-week-day-count">{day.events.length ? `${day.events.length} scheduled` : "Open"}</div>
                      </div>
                      <div className="calendar-day-events calendar-day-events--week">
                        {day.events.length === 0 && <div className="calendar-empty-copy">No scheduled work.</div>}
                        {day.events.map(event => (
                          <button
                            className={`calendar-event calendar-event--week${event.schedule_type === "builder_slab" ? " is-builder" : " is-residential"}`}
                            key={event.id}
                            onClick={e => {
                              e.stopPropagation();
                              if (!schedulingLocked) onOpenJob(event.jobId);
                            }}
                            style={{ background: `${eventColor(event)}14`, color: B.dark, border: `1px solid ${eventColor(event)}30`, borderRadius: 8, padding: "10px 10px 9px", textAlign: "left", cursor: schedulingLocked ? "default" : "pointer" }}
                          >
                            <div className="calendar-event-title">{getEventTitle(event)}</div>
                            <div className="calendar-event-subtitle">{getEventSubtitle(event)}</div>
                            <div className="calendar-event-meta">{getEventMeta(event)}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && view === "day" && (
            <div className="calendar-day-list">
              {schedulingLocked && <button onClick={() => pickScheduleDate(anchorDate)} style={{ alignSelf: "flex-start", background: `${B.bronze}12`, border: `1px solid ${B.bronze}40`, color: B.bronze, borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: ".76rem" }}>Use {fmtDate(anchorDate)} for this job</button>}
              {dayEvents.length === 0 && <div className="calendar-state-copy" style={{ fontSize: ".82rem", color: B.gray }}>No work scheduled for {fmtDate(anchorDate)}.</div>}
              {dayEvents.map(event => (
                <Card key={event.id} className={`calendar-event calendar-event--day${event.schedule_type === "builder_slab" ? " is-builder" : " is-residential"}`} style={{ padding: 16, background: `${eventColor(event)}10`, borderColor: `${eventColor(event)}35` }}>
                  <div className="calendar-day-event-row">
                    <div>
                      <div className="calendar-event-title calendar-event-title--day">{getEventTitle(event)}</div>
                      <div className="calendar-event-subtitle calendar-event-subtitle--day">{event.schedule_type === "builder_slab" ? (event.community ? `${event.phase_label} · ${event.community}` : event.phase_label) : `${event.job_type} · ${event.address}`}</div>
                    </div>
                    <div className="calendar-day-event-actions">
                      <span className="calendar-day-event-meta">{`${event.time} · Crew ${findCrewById(crews, event.crew_id)?.number || "-"} · ${fmtCap(event.capacity_used)}`}</span>
                      <Pill status={event.status} />
                      {!schedulingLocked && <Btn sm v="outline" onClick={() => onOpenJob(event.jobId)}>{getOpenRecordLabel(event)}</Btn>}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>

        {!readOnly && pendingResidentialDraft && (
          <Card className="calendar-side-panel admin-section-card" style={{ alignSelf: "start", position: "sticky", top: 18 }}>
            <div className="calendar-side-panel-header">
              <div style={{ fontSize: ".82rem", fontWeight: 700, color: B.dark, textTransform: "uppercase", letterSpacing: .5 }}>Schedule Residential Job</div>
              <div style={{ fontSize: ".92rem", fontWeight: 700, color: B.dark }}>{pendingResidentialDraft.customer_name}</div>
              <div style={{ fontSize: ".76rem", color: B.gray }}>{pendingResidentialDraft.job_type}</div>
            </div>
            <FormValidationMessage message={residentialSummaryError} style={{ marginBottom: 12 }} />
            <div className="calendar-side-panel-form">
              <div>
                <label htmlFor="residential-schedule-scheduled_date" style={labelStyle}>Scheduled date</label>
                <input id="residential-schedule-scheduled_date" aria-invalid={residentialValidation?.field === "scheduled_date" || undefined} style={getErrorInputStyle(residentialValidation?.field === "scheduled_date")} type="date" value={pendingResidentialDraft.scheduled_date} onChange={e => handleResidentialDraftChange({ scheduled_date: e.target.value })} />
                <div style={{ fontSize: ".7rem", color: B.gray, marginTop: 4 }}>Click a date in the calendar to schedule from the live view.</div>
                {residentialValidation?.field === "scheduled_date" && <div style={{ fontSize: ".72rem", color: VALIDATION_COLOR, marginTop: 6, fontWeight: 700 }}>{residentialValidation.message}</div>}
              </div>
              <div>
                <label htmlFor="residential-schedule-scheduled_time" style={labelStyle}>Start time</label>
                <input id="residential-schedule-scheduled_time" aria-invalid={residentialValidation?.field === "scheduled_time" || undefined} style={getErrorInputStyle(residentialValidation?.field === "scheduled_time")} type="time" value={pendingResidentialDraft.scheduled_time} onChange={e => handleResidentialDraftChange({ scheduled_time: e.target.value })} />
                {residentialValidation?.field === "scheduled_time" && <div style={{ fontSize: ".72rem", color: VALIDATION_COLOR, marginTop: 6, fontWeight: 700 }}>{residentialValidation.message}</div>}
              </div>
              <div>
                <label htmlFor="residential-schedule-crew_id" style={labelStyle}>Crew</label>
                <select id="residential-schedule-crew_id" aria-invalid={residentialValidation?.field === "crew_id" || undefined} style={getErrorInputStyle(residentialValidation?.field === "crew_id", { cursor: "pointer" })} value={pendingResidentialDraft.crew_id} onChange={e => handleResidentialDraftChange({ crew_id: e.target.value })}>
                  {crews.map(crew => <option key={crew.id} value={crew.id}>{crew.name}</option>)}
                </select>
                {residentialValidation?.field === "crew_id" && <div style={{ fontSize: ".72rem", color: VALIDATION_COLOR, marginTop: 6, fontWeight: 700 }}>{residentialValidation.message}</div>}
              </div>
              <div className="calendar-side-panel-grid">
                <div>
                  <label htmlFor="residential-schedule-estimated_duration" style={labelStyle}>Estimated duration (days)</label>
                  <input id="residential-schedule-estimated_duration" style={INP} type="number" step="0.25" value={pendingResidentialDraft.estimated_duration} onChange={e => handleResidentialDraftChange({ estimated_duration: Number(e.target.value || 0.25) })} />
                </div>
                <div>
                  <label htmlFor="residential-schedule-day_capacity_used" style={labelStyle}>Day capacity used</label>
                  <input id="residential-schedule-day_capacity_used" style={INP} type="number" step="0.25" value={pendingResidentialDraft.day_capacity_used} onChange={e => handleResidentialDraftChange({ day_capacity_used: Number(e.target.value || 0.25) })} />
                </div>
              </div>
              <div>
                <label htmlFor="residential-schedule-work_order_number" style={labelStyle}>PO number</label>
                <input id="residential-schedule-work_order_number" style={INP} value={pendingResidentialDraft.work_order_number} onChange={e => handleResidentialDraftChange({ work_order_number: e.target.value })} />
              </div>
              <div>
                <label htmlFor="residential-schedule-status" style={labelStyle}>Status</label>
                <select id="residential-schedule-status" style={{ ...INP, cursor: "pointer" }} value={pendingResidentialDraft.status} onChange={e => handleResidentialDraftChange({ status: e.target.value })}>
                  {JOB_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
              {!!pendingResidentialDraft.scheduleEventDatabaseId && (
                <RescheduleReasonInput
                  value={pendingResidentialDraft.reschedule_reason || ""}
                  onChange={nextReason => handleResidentialDraftChange({ reschedule_reason: nextReason })}
                  helperText={residentialExistingReason ? `Required only when changing the scheduled date or time. Last saved reschedule reason: ${residentialExistingReason}` : "Required only when changing the scheduled date or time."}
                  error={residentialValidation?.field === "reschedule_reason" ? residentialValidation.message : ""}
                  inputIdPrefix="residential-schedule-reschedule-reason"
                />
              )}
              <div>
                <label htmlFor="residential-schedule-notes" style={labelStyle}>Notes</label>
                <textarea id="residential-schedule-notes" style={{ ...INP, minHeight: 104 }} value={pendingResidentialDraft.notes} onChange={e => handleResidentialDraftChange({ notes: e.target.value })} />
              </div>
              <div className="calendar-side-panel-actions">
                <Btn v="outline" onClick={onCancelPendingResidentialSchedule}>Cancel</Btn>
                <Btn v="green" onClick={() => onSavePendingResidentialSchedule(pendingResidentialDraft)}>Save Scheduled Job</Btn>
              </div>
            </div>
          </Card>
        )}
        {!readOnly && pendingBuilderSchedule && (
          <Card className="calendar-side-panel admin-section-card" style={{ alignSelf: "start", position: "sticky", top: 18 }}>
            <div className="calendar-side-panel-header">
              <div style={{ fontSize: ".82rem", fontWeight: 700, color: B.dark, textTransform: "uppercase", letterSpacing: .5 }}>Schedule Builder Job</div>
              <div style={{ fontSize: ".92rem", fontWeight: 700, color: B.dark }}>{pendingBuilderSchedule.builder_name}</div>
              <div style={{ fontSize: ".76rem", color: B.gray }}>{[pendingBuilderSchedule.community, pendingBuilderSchedule.lot_number ? `Lot ${pendingBuilderSchedule.lot_number}` : ""].filter(Boolean).join(" · ")}</div>
            </div>
            <FormValidationMessage message={builderSummaryError} style={{ marginBottom: 12 }} />
            <div className="calendar-side-panel-form">
              <div>
                <label htmlFor="builder-schedule-scheduled_date" style={labelStyle}>Start date</label>
                <input id="builder-schedule-scheduled_date" aria-invalid={builderValidation?.field === "scheduled_date" || undefined} style={getErrorInputStyle(builderValidation?.field === "scheduled_date")} type="date" value={pendingBuilderSchedule.scheduled_date} onChange={e => handleBuilderDraftChange({ scheduled_date: e.target.value })} />
                {builderValidation?.field === "scheduled_date" && <div style={{ fontSize: ".72rem", color: VALIDATION_COLOR, marginTop: 6, fontWeight: 700 }}>{builderValidation.message}</div>}
              </div>
              <div>
                <label htmlFor="builder-schedule-scheduled_time" style={labelStyle}>Start time</label>
                <input id="builder-schedule-scheduled_time" style={INP} type="time" value={pendingBuilderSchedule.scheduled_time} onChange={e => handleBuilderDraftChange({ scheduled_time: e.target.value })} />
              </div>
              <div>
                <label htmlFor="builder-schedule-crew_id" style={labelStyle}>Crew</label>
                <select id="builder-schedule-crew_id" style={{ ...INP, cursor: "pointer" }} value={pendingBuilderSchedule.crew_id} onChange={e => handleBuilderDraftChange({ crew_id: e.target.value })}>
                  {crews.map(crew => <option key={crew.id} value={crew.id}>{crew.name}</option>)}
                </select>
              </div>
              <div className="calendar-side-panel-actions">
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

function JobsSection({ jobs, crews = [], loading = false, error = "", onSelectJob, onCreateBuilderJob, canCreateBuilderJob = true }) {
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
  const getCurrentOperationalPhase = job => {
    const phases = sortBuilderPhases(job.phases || []);
    return phases.find(phase => !["Completed", "Cancelled"].includes(phase.status)) || phases[0] || null;
  };
  const getCrewLabel = crewId => {
    if (!crewId) return "Unassigned";
    const crew = findCrewById(crews, crewId);
    if (!crew) return "Unassigned";
    return crew.name || `Crew ${getCrewNumber(crew) || "-"}`;
  };
  const getScheduledLabel = (job, currentPhase) => {
    if (job.schedule_type === "residential") {
      return job.scheduled_date ? `${fmtDate(job.scheduled_date)} · ${job.scheduled_time || "-"}` : "Not scheduled";
    }

    return currentPhase?.scheduled_date ? `${fmtDate(currentPhase.scheduled_date)} · ${currentPhase.scheduled_time || "-"}` : "Not scheduled";
  };
  const getReferenceMeta = (job, currentPhase) => (
    job.schedule_type === "residential"
      ? { label: "PO Number", value: job.work_order_number || "-" }
      : { label: "Work Order", value: currentPhase?.work_order_number || job.work_order_number || "-" }
  );
  const getAttentionMeta = (job, currentPhase) => {
    const isScheduled = job.schedule_type === "residential" ? !!job.scheduled_date : !!currentPhase?.scheduled_date;
    if (job.status === "Delayed") {
      return { tone: "delayed", note: "Delayed job requires follow-up." };
    }
    if (job.status === "Ready to Schedule") {
      return { tone: "ready", note: "Ready to schedule." };
    }
    if (!isScheduled && !["Completed", "Cancelled"].includes(job.status)) {
      return { tone: "unscheduled", note: "No scheduled date assigned." };
    }
    return { tone: "default", note: "" };
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
        <div className="jobs-filter-grid" style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <input style={INP} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search jobs, communities, and references..." />
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

      <div className="jobs-list">
        {!loading && !error && filtered.map(job => {
          const currentPhase = getCurrentOperationalPhase(job);
          const reference = getReferenceMeta(job, currentPhase);
          const attention = getAttentionMeta(job, currentPhase);
          const scheduledLabel = getScheduledLabel(job, currentPhase);
          const crewLabel = getCrewLabel(job.schedule_type === "residential" ? job.crew_id : currentPhase?.crew_id || job.crew_id);
          const jobTypeLabel = job.schedule_type === "residential" ? job.job_type : (job.job_type || "Builder Slab Workflow");
          const title = job.schedule_type === "residential"
            ? (job.customer_name || job.name || "Residential Job")
            : (job.lot_number ? `${job.builder_name} - Lot ${job.lot_number}` : (job.name || job.builder_name || "Builder Job"));
          const subtitle = job.schedule_type === "residential"
            ? (job.job_address || "-")
            : ([job.community, job.job_address].filter(Boolean).join(" - ") || job.job_address || job.community || "-");

          return (
            <Card key={job.id} className={`jobs-row-card ${attention.tone !== "default" ? `jobs-row-card--${attention.tone}` : ""}`} style={{ padding: 18 }}>
              <div className="jobs-row">
                <div className="jobs-row__identity">
                  <div className="jobs-row__type">{jobTypeLabel}</div>
                  <div className="jobs-row__title">{title}</div>
                  <div className="jobs-row__subtitle">{subtitle}</div>
                </div>
                <div className="jobs-row__ops">
                  <div className="jobs-row__meta-grid">
                    <div className="jobs-row__meta">
                      <div className="jobs-row__meta-label">Scheduled</div>
                      <div className="jobs-row__meta-value">{scheduledLabel}</div>
                      {job.schedule_type === "builder_slab" && currentPhase?.phase_label && <div className="jobs-row__meta-subtitle">{currentPhase.phase_label}</div>}
                    </div>
                    <div className="jobs-row__meta">
                      <div className="jobs-row__meta-label">Crew</div>
                      <div className="jobs-row__meta-value">{crewLabel}</div>
                    </div>
                    <div className="jobs-row__meta">
                      <div className="jobs-row__meta-label">{reference.label}</div>
                      <div className="jobs-row__meta-value">{reference.value}</div>
                    </div>
                    <div className="jobs-row__meta jobs-row__meta--status">
                      <div className="jobs-row__meta-label">Status</div>
                      <div className="jobs-row__status">
                        <Pill status={job.status} />
                      </div>
                    </div>
                  </div>
                  {attention.note && <div className="jobs-row__attention">{attention.note}</div>}
                </div>
                <div className="jobs-row__actions">
                  <Btn sm v="outline" onClick={() => onSelectJob(job.id)}>Open Job</Btn>
                </div>
              </div>
            </Card>
          );
        })}
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
          const openQuickView = triggerElement => onSelectCustomer(customer.id, triggerElement);
          const stopCardSelection = event => event.stopPropagation();

          return (
            <Card
              key={customer.id}
              role="button"
              tabIndex={0}
              onClick={event => openQuickView(event.currentTarget)}
              onKeyDown={event => {
                if (event.target !== event.currentTarget) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openQuickView(event.currentTarget);
                }
              }}
              style={{ padding: 16, cursor: "pointer", transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease", boxShadow: "0 8px 22px rgba(15, 26, 18, 0.04)" }}
            >
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
                      <a href={phoneLink.href} onClick={stopCardSelection} style={customerContactLinkStyle}>{phoneLink.display}</a>
                    ) : phoneLink.display}
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  {!isDesktopLayout && <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 2 }}>Email</div>}
                  <div style={{ fontSize: ".82rem", color: B.dark, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {emailLink.href ? (
                      <a href={emailLink.href} onClick={stopCardSelection} style={customerContactLinkStyle}>{emailLink.display}</a>
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
                  <Btn sm v="outline" onClick={event => {
                    stopCardSelection(event);
                    openQuickView(event.currentTarget);
                  }}>Quick View</Btn>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

function CustomerQuickViewModal({
  customer,
  tickets,
  jobs,
  canManageCustomer = false,
  customerActionBusy = false,
  onClose,
  onEditCustomer,
  onOpenFullCustomer,
}) {
  const displayName = formatCustomerDisplayName(customer);
  const customerInitials = buildInitials(displayName, customer.email);
  const phoneLink = formatCustomerPhoneLink(customer.phone);
  const emailLink = formatCustomerEmailLink(customer.email);
  const estimateCount = useMemo(
    () => tickets.filter(ticket => ticket.customerDatabaseId === customer.id).length,
    [customer.id, tickets]
  );
  const jobCount = useMemo(
    () => jobs.filter(job => job.customerDatabaseId === customer.id).length,
    [customer.id, jobs]
  );
  const locationLabel = [customer.street_address, customer.city, customer.state, customer.zip_code]
    .map(value => normalizeCustomerText(value))
    .filter(Boolean)
    .join(", ") || formatCustomerLocation(customer);

  useEffect(() => {
    const focusTimer = window.setTimeout(() => {
      document.querySelector(".customer-quick-view-actions .oak-button--primary")?.focus();
    }, 0);

    const handleKeyDown = event => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <Modal title="Customer Quick View" onClose={onClose} width={620}>
      <div className="customer-quick-view" role="dialog" aria-modal="true" aria-label={`Customer Quick View for ${displayName}`}>
        <div className="customer-quick-view-head">
          <div className="customer-quick-view-identity">
            <div className="customer-quick-view-avatar" aria-hidden="true">{customerInitials}</div>
            <div className="customer-quick-view-copy">
              <div className="customer-quick-view-title">{displayName}</div>
              <div className="customer-quick-view-subtitle">{formatCustomerTypeLabel(customer.customer_type)}</div>
            </div>
          </div>
          <div className="customer-quick-view-status">
            <Pill status={getCustomerStatusLabel(customer)} />
          </div>
        </div>

        <div className="customer-quick-view-grid">
          <div className="customer-quick-view-field">
            <div className="customer-quick-view-label">Phone</div>
            <div className={`customer-quick-view-value${!phoneLink.href && phoneLink.display === EMPTY_FIELD ? " customer-quick-view-value--empty" : ""}`}>
              {phoneLink.href ? <a href={phoneLink.href} style={customerContactLinkStyle}>{phoneLink.display}</a> : phoneLink.display}
            </div>
          </div>
          <div className="customer-quick-view-field">
            <div className="customer-quick-view-label">Email</div>
            <div className={`customer-quick-view-value${!emailLink.href && emailLink.display === EMPTY_FIELD ? " customer-quick-view-value--empty" : ""}`}>
              {emailLink.href ? <a href={emailLink.href} style={customerContactLinkStyle}>{emailLink.display}</a> : emailLink.display}
            </div>
          </div>
          <div className="customer-quick-view-field">
            <div className="customer-quick-view-label">Location</div>
            <div className={`customer-quick-view-value${locationLabel === EMPTY_FIELD ? " customer-quick-view-value--empty" : ""}`}>{locationLabel}</div>
          </div>
          <div className="customer-quick-view-field">
            <div className="customer-quick-view-label">Estimate Count</div>
            <div className="customer-quick-view-value">{estimateCount}</div>
          </div>
          <div className="customer-quick-view-field">
            <div className="customer-quick-view-label">Job Count</div>
            <div className="customer-quick-view-value">{jobCount}</div>
          </div>
        </div>

        <div className="customer-quick-view-actions">
          <Btn sm v="outline" onClick={onClose} style={{ borderRadius: 10 }}>
            Close
          </Btn>
          {canManageCustomer && (
            <Btn sm v="outline" onClick={onEditCustomer} disabled={customerActionBusy} style={{ borderRadius: 10 }}>
              Edit Customer
            </Btn>
          )}
          <Btn sm v="primary" onClick={onOpenFullCustomer} style={{ borderRadius: 10 }}>
            Open Full Customer
          </Btn>
        </div>
      </div>
    </Modal>
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
  const customerInitials = buildInitials(displayName, customer.email);
  const locationLabel = formatCustomerLocation(customer);
  const phoneDisplay = phoneLink.href ? <a href={phoneLink.href} style={customerContactLinkStyle}>{phoneLink.display}</a> : phoneLink.display;
  const emailDisplay = emailLink.href ? <a href={emailLink.href} style={customerContactLinkStyle}>{emailLink.display}</a> : emailLink.display;
  const customerFields = [
    { label: "Display name", value: displayName },
    { label: "Status", value: <Pill status={getCustomerStatusLabel(customer)} /> },
    { label: "Customer type", value: formatCustomerTypeLabel(customer.customer_type) },
    { label: "First name", value: formatDisplayField(customer.first_name) },
    { label: "Last name", value: formatDisplayField(customer.last_name) },
    { label: "Company name", value: formatDisplayField(customer.company_name) },
    { label: "Phone", value: phoneDisplay, empty: !phoneLink.href && phoneLink.display === EMPTY_FIELD },
    { label: "Email", value: emailDisplay, empty: !emailLink.href && emailLink.display === EMPTY_FIELD },
    { label: "Street address", value: formatDisplayField(customer.street_address) },
    { label: "City", value: formatDisplayField(customer.city) },
    { label: "State", value: formatDisplayField(customer.state) },
    { label: "Zip code", value: formatDisplayField(customer.zip_code) },
    { label: "Created date", value: customer.created_at ? formatDateTime(customer.created_at) : EMPTY_FIELD, empty: !customer.created_at },
    { label: "Last updated", value: customer.updated_at ? formatDateTime(customer.updated_at) : EMPTY_FIELD, empty: !customer.updated_at },
  ];

  return (
    <div className="customer-detail-shell">
      <div className="customer-detail-page">
        <button className="customer-detail-back" onClick={onBack}>
          <i className="ti ti-arrow-left" style={{ fontSize: 16 }} aria-hidden="true" />
          Back to Customers
        </button>

        <Card className="customer-detail-hero">
          <div className="customer-detail-hero-row">
            <div className="customer-detail-identity">
              <div className="customer-detail-avatar" aria-hidden="true">{customerInitials}</div>
              <div className="customer-detail-identity-copy">
                <div className="customer-detail-eyebrow">Customer Detail</div>
                <h1 className="customer-detail-title">{displayName}</h1>
                {locationLabel !== EMPTY_FIELD && <div className="customer-detail-location">{locationLabel}</div>}
              </div>
            </div>
            <div className="customer-detail-summary">
              <div className="customer-detail-counter-grid">
                <div className="customer-detail-counter">
                  <div className="customer-detail-counter-label">Estimates</div>
                  <div className="customer-detail-counter-value">{relatedTickets.length}</div>
                </div>
                <div className="customer-detail-counter">
                  <div className="customer-detail-counter-label">Jobs</div>
                  <div className="customer-detail-counter-value">{relatedJobs.length}</div>
                </div>
              </div>
              <div className="customer-detail-summary-meta">
                <Pill status={getCustomerStatusLabel(customer)} />
                <span className="customer-detail-type">{formatCustomerTypeLabel(customer.customer_type)}</span>
              </div>
            </div>
          </div>
          {canManageCustomer && (
            <div className="customer-detail-action-row">
              <div className="customer-detail-action-spacer" />
              <div className="customer-detail-action-group">
                <Btn sm v="outline" onClick={onEditCustomer} disabled={customerActionBusy} style={{ borderRadius: 10 }}>
                  Edit Customer
                </Btn>
                {customer.is_active !== false ? (
                  <Btn sm v="danger" onClick={onDeactivateCustomer} disabled={customerActionBusy} style={{ borderRadius: 10 }}>
                    Deactivate Customer
                  </Btn>
                ) : (
                  <Btn sm v="green" onClick={onReactivateCustomer} disabled={customerActionBusy} style={{ borderRadius: 10 }}>
                    Reactivate Customer
                  </Btn>
                )}
              </div>
            </div>
          )}
          {!!customerActionError && (
            <div className="customer-detail-error">
              {customerActionError}
            </div>
          )}
        </Card>

        <div className="customer-detail-main-grid">
          <Card className="customer-detail-card customer-detail-info-card">
            <div className="customer-detail-section-head">
              <div className="customer-detail-section-title">Customer Information</div>
              <div className="customer-detail-section-subtitle">Current live record details and contact information.</div>
            </div>
            <div className="customer-detail-info-grid">
              {customerFields.map(field => (
                <div key={field.label} className="customer-detail-field">
                  <div className="customer-detail-field-label">{field.label}</div>
                  <div className={`customer-detail-field-value${field.empty ? " customer-detail-field-value--empty" : ""}`}>
                    {field.value}
                  </div>
                </div>
              ))}
            </div>
            <div className="customer-detail-notes">
              <div className="customer-detail-field-label">Notes</div>
              <div className={`customer-detail-notes-value${formatDisplayField(customer.notes) === EMPTY_FIELD ? " customer-detail-field-value--empty" : ""}`}>
                {formatDisplayField(customer.notes)}
              </div>
            </div>
          </Card>

          <Card className="customer-detail-card customer-detail-estimates-card">
            <div className="customer-detail-section-head">
              <div className="customer-detail-section-title">Related Estimates</div>
              <div className="customer-detail-section-subtitle">All live estimate records currently linked to this customer.</div>
            </div>
            {relatedTickets.length === 0 ? (
              <div className="customer-detail-empty">No estimates are linked to this customer yet.</div>
            ) : (
              <div className="customer-detail-record-list">
                {relatedTickets.map(ticket => (
                  <div key={ticket.id} className="customer-detail-record-card">
                    <div className="customer-detail-record-head">
                      <div className="customer-detail-record-copy">
                        <div className="customer-detail-record-title">{ticket.ptype || "Estimate"}</div>
                        <div className={`customer-detail-record-subtitle${!ticket.addr ? " customer-detail-field-value--empty" : ""}`}>
                          {ticket.addr || EMPTY_FIELD}
                        </div>
                      </div>
                      <div className="customer-detail-record-actions">
                        <Pill status={ticket.status} />
                        <Btn sm v="outline" onClick={() => onOpenEstimate(ticket)} style={{ borderRadius: 10 }}>
                          View Estimate
                        </Btn>
                      </div>
                    </div>
                    <div className="customer-detail-meta-grid">
                      <div className="customer-detail-meta-item">
                        <div className="customer-detail-field-label">Estimate date</div>
                        <div className={`customer-detail-meta-value${!ticket.at ? " customer-detail-field-value--empty" : ""}`}>
                          {ticket.at ? fmtDate(ticket.at.slice(0, 10)) : EMPTY_FIELD}
                        </div>
                      </div>
                      <div className="customer-detail-meta-item">
                        <div className="customer-detail-field-label">Project / job type</div>
                        <div className={`customer-detail-meta-value${!ticket.ptype ? " customer-detail-field-value--empty" : ""}`}>
                          {ticket.ptype || EMPTY_FIELD}
                        </div>
                      </div>
                      <div className="customer-detail-meta-item">
                        <div className="customer-detail-field-label">Estimated amount</div>
                        <div className={`customer-detail-meta-value${formatEstimateAmountLabel(ticket) === EMPTY_FIELD ? " customer-detail-field-value--empty" : ""}`}>
                          {formatEstimateAmountLabel(ticket)}
                        </div>
                      </div>
                      <div className="customer-detail-meta-item">
                        <div className="customer-detail-field-label">Submitted</div>
                        <div className={`customer-detail-meta-value${!ticket.at ? " customer-detail-field-value--empty" : ""}`}>
                          {ticket.at ? fmtDateShort(ticket.at.slice(0, 10)) : EMPTY_FIELD}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card className="customer-detail-card customer-detail-jobs-card">
          <div className="customer-detail-section-head">
            <div className="customer-detail-section-title">Related Jobs</div>
            <div className="customer-detail-section-subtitle">Existing linked job records and current scheduled work details.</div>
          </div>
          {relatedJobs.length === 0 ? (
            <div className="customer-detail-empty">No jobs are linked to this customer yet.</div>
          ) : (
            <div className="customer-detail-record-list">
              {relatedJobs.map(job => (
                <div key={job.id} className="customer-detail-record-card">
                  <div className="customer-detail-record-head">
                    <div className="customer-detail-record-copy">
                      <div className="customer-detail-record-title">{getCustomerJobDisplayName(job)}</div>
                      <div className={`customer-detail-record-subtitle${!job.job_address ? " customer-detail-field-value--empty" : ""}`}>
                        {job.job_address || EMPTY_FIELD}
                      </div>
                    </div>
                    <div className="customer-detail-record-actions">
                      <Pill status={job.status} />
                      <Btn sm v="outline" onClick={() => onOpenJob(job.id)} style={{ borderRadius: 10 }}>
                        View Job
                      </Btn>
                    </div>
                  </div>
                  <div className="customer-detail-meta-grid customer-detail-meta-grid--jobs">
                    <div className="customer-detail-meta-item">
                      <div className="customer-detail-field-label">Job type</div>
                      <div className={`customer-detail-meta-value${!job.job_type ? " customer-detail-field-value--empty" : ""}`}>
                        {job.job_type || EMPTY_FIELD}
                      </div>
                    </div>
                    <div className="customer-detail-meta-item">
                      <div className="customer-detail-field-label">Scheduled date / time</div>
                      <div className={`customer-detail-meta-value${getCustomerJobScheduledLabel(job) === EMPTY_FIELD ? " customer-detail-field-value--empty" : ""}`}>
                        {getCustomerJobScheduledLabel(job)}
                      </div>
                    </div>
                    <div className="customer-detail-meta-item">
                      <div className="customer-detail-field-label">PO / WO number</div>
                      <div className={`customer-detail-meta-value${getCustomerJobReference(job) === EMPTY_FIELD ? " customer-detail-field-value--empty" : ""}`}>
                        {getCustomerJobReference(job)}
                      </div>
                    </div>
                    <div className="customer-detail-meta-item">
                      <div className="customer-detail-field-label">Status</div>
                      <div className="customer-detail-meta-value">{job.status || EMPTY_FIELD}</div>
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

function JobDetailView({ job, crews, onBack, onSaveJob, onOpenPhaseEdit, onOpenPhaseDetails, readOnly = false, latestRescheduleReasons = {}, profileDisplayNames = {}, backLabel = "Back to Jobs" }) {
  const crew = findCrewById(crews, job.crew_id);
  const builderHeading = [job.builder_name, job.community, job.lot_number ? `Lot ${job.lot_number}` : ""].filter(Boolean).join(" - ") || job.name || "Builder Job";
  const residentialLastRescheduleReason = job.scheduleEventDatabaseId
    ? (job.last_reschedule_reason || latestRescheduleReasons[job.scheduleEventDatabaseId] || "")
    : "";
  const residentialLastRescheduledBy = job.last_rescheduled_by
    ? (String(profileDisplayNames[job.last_rescheduled_by] || "").trim() || "Unknown user")
    : "";
  const detailHeading = job.schedule_type === "residential" ? job.customer_name : builderHeading;
  const scheduleSummary = job.scheduled_date ? `${fmtDate(job.scheduled_date)}${job.scheduled_time ? ` · ${job.scheduled_time}` : ""}` : "Not scheduled";
  const workOrderLabel = job.work_order_number || job.po_number || "-";
  const statusStyle = STATUS_STYLES[job.status] || { c: B.mid };
  return (
    <div className="job-detail-page">
      <Card className="admin-section-card job-detail-hero">
        <div className="job-detail-hero-row">
          <div className="job-detail-hero-copy">
            <button className="job-detail-back-button" onClick={onBack} type="button">
              <i className="ti ti-arrow-left" style={{ fontSize: 16 }} aria-hidden="true" />
              {backLabel}
            </button>
            <div className="job-detail-eyebrow">{job.schedule_type === "residential" ? "Residential Schedule" : "Builder Slab Workflow"}</div>
            <h1 style={{ fontSize: "1.28rem", fontWeight: 700, color: B.dark, margin: 0 }}>{detailHeading}</h1>
            <div className="job-detail-subtitle">{job.job_address || "Address not available"}</div>
          </div>
          <div className="job-detail-hero-meta">
            <div className="job-detail-meta-chip">
              <span className="job-detail-meta-label">{job.schedule_type === "residential" ? "PO number" : "Work order"}</span>
              <div className="job-detail-meta-value">{workOrderLabel}</div>
            </div>
            <div className="job-detail-meta-chip">
              <span className="job-detail-meta-label">Crew</span>
              <div className="job-detail-meta-value">{crew ? `Crew ${getCrewNumber(crew)}` : "-"}</div>
            </div>
            <div className="job-detail-meta-chip">
              <span className="job-detail-meta-label">Scheduled</span>
              <div className="job-detail-meta-value">{scheduleSummary}</div>
            </div>
            <div className="job-detail-meta-chip">
              <span className="job-detail-meta-label">Status</span>
              <div className="job-detail-meta-value job-detail-meta-value--status" style={{ color: statusStyle.c }}>{job.status}</div>
            </div>
          </div>
        </div>
      </Card>

      {job.schedule_type === "residential" ? (
        <div className="job-detail-main-grid">
          <Card className="admin-section-card job-detail-card">
            <div className="job-detail-section-title">Residential Schedule</div>
            <div className="job-detail-info-grid">
              {[["Scheduled date", fmtDate(job.scheduled_date)], ["Start time", job.scheduled_time || "-"], ["Estimated duration", fmtCap(job.estimated_duration)], ["Day capacity used", fmtCap(job.day_capacity_used)], ["Status", job.status], ["Crew", crew ? `${crew.name}` : "-"]].map(([label, value]) => (
                <div key={label} className="job-detail-info-item">
                  <div className="job-detail-info-label">{label}</div>
                  <div className="job-detail-info-value">{value}</div>
                </div>
              ))}
            </div>
            {(residentialLastRescheduleReason || residentialLastRescheduledBy || job.last_rescheduled_at) && (
              <div className="job-detail-history">
                {residentialLastRescheduleReason && <div><strong>Last reschedule reason:</strong> {residentialLastRescheduleReason}</div>}
                {residentialLastRescheduledBy && <div><strong>Last rescheduled by:</strong> {residentialLastRescheduledBy}</div>}
                {job.last_rescheduled_at && <div><strong>Last rescheduled at:</strong> {formatDateTime(job.last_rescheduled_at)}</div>}
              </div>
            )}
            <div className="job-detail-notes-block">
              <div className="job-detail-info-label">Notes</div>
              <div className="job-detail-notes-copy">{job.notes || "-"}</div>
            </div>
          </Card>
          {!readOnly && (
            <Card className="admin-section-card job-detail-card job-detail-actions-card">
              <div className="job-detail-section-title">Actions</div>
              <div className="job-detail-action-stack">
                <Btn full v="outline" onClick={() => onOpenPhaseEdit(job.id, null)}><i className="ti ti-calendar-time" style={{ marginRight: 6 }} aria-hidden="true" />{job.scheduleEventDatabaseId ? "Reschedule Job" : "Schedule Job"}</Btn>
                <Btn full v="green" onClick={() => onSaveJob({ ...job, status: "Completed" })}><i className="ti ti-check" style={{ marginRight: 6 }} aria-hidden="true" />Mark Completed</Btn>
                <Btn full v="outline" onClick={() => onSaveJob({ ...job, status: "Delayed" })}><i className="ti ti-clock-exclamation" style={{ marginRight: 6 }} aria-hidden="true" />Mark Delayed</Btn>
              </div>
            </Card>
          )}
        </div>
      ) : (
        <Card className="admin-section-card job-detail-card">
          <div className="job-detail-section-title">Builder Slab Workflow</div>
          <div className="builder-workflow-list">
            {sortBuilderPhases(job.phases || []).map((phase, idx) => (
              <div key={phase.id} className={`builder-workflow-row${phase.counts_toward_crew ? "" : " is-dependency"}`}>
                <div className="builder-workflow-row-main">
                  <div className="builder-workflow-row-head">
                    <div>
                      <div className="builder-workflow-phase-title">{idx + 1}. {phase.phase_label}</div>
                      <div className="builder-workflow-phase-subtitle">{phase.responsible_party}</div>
                    </div>
                    <Pill status={phase.status} />
                  </div>
                  <div className="builder-workflow-row-grid">
                    <div className="job-detail-info-item">
                      <div className="job-detail-info-label">Scheduled</div>
                      <div className="job-detail-info-value">{phase.scheduled_date ? `${fmtDate(phase.scheduled_date)} · ${phase.scheduled_time || "-"}` : "Not scheduled"}</div>
                    </div>
                    <div className="job-detail-info-item">
                      <div className="job-detail-info-label">Crew / capacity</div>
                      <div className="job-detail-info-value">
                        {phase.crew_id ? `Crew ${findCrewById(crews, phase.crew_id)?.number || "-"}` : "Dependency task"}
                        {phase.crew_id && ` · ${fmtCap(phase.day_capacity_used)}`}
                      </div>
                    </div>
                    <div className="job-detail-info-item">
                      <div className="job-detail-info-label">Work order</div>
                      <div className="job-detail-info-value">{phase.work_order_number || "-"}</div>
                    </div>
                    {(phase.last_reschedule_reason || latestRescheduleReasons[phase.scheduleEventDatabaseId]) && (
                      <div className="job-detail-info-item builder-workflow-row-note">
                        <div className="job-detail-info-label">Last reschedule reason</div>
                        <div className="job-detail-info-value">{phase.last_reschedule_reason || latestRescheduleReasons[phase.scheduleEventDatabaseId]}</div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="builder-workflow-row-actions">
                  <Btn sm v="outline" onClick={() => onOpenPhaseDetails(job.id, phase.id)}>View Details</Btn>
                  {!readOnly && <Btn sm v="outline" onClick={() => onOpenPhaseEdit(job.id, phase.id)}>{phase.scheduleEventDatabaseId ? "Edit Phase" : "Schedule Phase"}</Btn>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
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
        <div><label style={labelStyle}>PO number</label><input style={INP} value={local.work_order_number} onChange={e => setLocal(prev => ({ ...prev, work_order_number: e.target.value }))} /></div>
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

function RescheduleReasonInput({ value, onChange, helperText = "", required = false, error = "", inputIdPrefix = "reschedule-reason" }) {
  const initialState = parseRescheduleReasonDraft(value);
  const [preset, setPreset] = useState(initialState.preset);
  const [customReason, setCustomReason] = useState(initialState.custom);
  const hasError = !!error;

  useEffect(() => {
    const nextState = parseRescheduleReasonDraft(value);
    setPreset(nextState.preset);
    setCustomReason(nextState.custom);
  }, [value]);

  return (
    <div style={{ gridColumn: "1 / -1" }}>
      <label htmlFor={`${inputIdPrefix}-preset`} style={labelStyle}>Reason for rescheduling</label>
      <select
        id={`${inputIdPrefix}-preset`}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? `${inputIdPrefix}-error` : undefined}
        style={getErrorInputStyle(hasError, { cursor: "pointer" })}
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
          id={`${inputIdPrefix}-custom`}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? `${inputIdPrefix}-error` : undefined}
          style={getErrorInputStyle(hasError, { minHeight: 90, marginTop: 10 })}
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
      {error && <div id={`${inputIdPrefix}-error`} style={{ fontSize: ".72rem", color: VALIDATION_COLOR, marginTop: 6, fontWeight: 700 }}>{error}</div>}
      {helperText && <div style={{ fontSize: ".72rem", color: B.gray, marginTop: 4 }}>{helperText}</div>}
    </div>
  );
}

function PhaseEditModal({ draft, crews, onClose, onSave, isResidential, validation = null, onValidationReset = () => {} }) {
  const [local, setLocal] = useState(draft);
  const existingReason = String(local.last_reschedule_reason || "").trim();

  useEffect(() => {
    if (!validation?.field) return;
    const targetId = validation.field === "reschedule_reason"
      ? "phase-edit-reschedule-reason-preset"
      : `phase-edit-${validation.field}`;
    requestAnimationFrame(() => document.getElementById(targetId)?.focus());
  }, [validation?.field]);

  const updateLocal = patch => {
    onValidationReset();
    setLocal(prev => ({ ...prev, ...patch }));
  };

  return (
    <Modal title={isResidential ? "Reschedule Residential Job" : `Edit ${draft.phase_label}`} onClose={onClose}>
      <div className="schedule-modal-stack">
        <div className="schedule-modal-intro">
          <div style={{ fontSize: ".82rem", color: B.gray }}>
            {isResidential ? "Update the residential schedule while keeping the existing reschedule and weekend rules intact." : "Update the phase schedule, crew assignment, and status. Push-forward behavior remains unchanged."}
          </div>
        </div>
        <FormValidationMessage message={validation && !validation.field ? validation.message : ""} />
      </div>
      <div className="schedule-modal-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
        <div>
          <label htmlFor="phase-edit-scheduled_date" style={labelStyle}>Scheduled date</label>
          <input id="phase-edit-scheduled_date" aria-invalid={validation?.field === "scheduled_date" || undefined} style={getErrorInputStyle(validation?.field === "scheduled_date")} type="date" value={local.scheduled_date} onChange={e => updateLocal({ scheduled_date: e.target.value })} />
          {validation?.field === "scheduled_date" && <div style={{ fontSize: ".72rem", color: VALIDATION_COLOR, marginTop: 6, fontWeight: 700 }}>{validation.message}</div>}
        </div>
        <div>
          <label htmlFor="phase-edit-scheduled_time" style={labelStyle}>Scheduled time</label>
          <input id="phase-edit-scheduled_time" aria-invalid={validation?.field === "scheduled_time" || undefined} style={getErrorInputStyle(validation?.field === "scheduled_time")} type="time" value={local.scheduled_time} onChange={e => updateLocal({ scheduled_time: e.target.value })} />
          {validation?.field === "scheduled_time" && <div style={{ fontSize: ".72rem", color: VALIDATION_COLOR, marginTop: 6, fontWeight: 700 }}>{validation.message}</div>}
        </div>
        <div>
          <label htmlFor="phase-edit-crew_id" style={labelStyle}>Crew</label>
          <select id="phase-edit-crew_id" style={{ ...INP, cursor: "pointer" }} value={local.crew_id} onChange={e => updateLocal({ crew_id: e.target.value })}>{crews.map(crew => <option key={crew.id} value={crew.id}>{crew.name}</option>)}</select>
        </div>
        <div>
          <label htmlFor="phase-edit-status" style={labelStyle}>Status</label>
          <select id="phase-edit-status" style={{ ...INP, cursor: "pointer" }} value={local.status} onChange={e => updateLocal({ status: e.target.value })}>{JOB_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}</select>
        </div>
        <div>
          <label htmlFor="phase-edit-day_capacity_used" style={labelStyle}>Day capacity used</label>
          <input id="phase-edit-day_capacity_used" style={INP} type="number" step="0.25" value={local.day_capacity_used} onChange={e => updateLocal({ day_capacity_used: Number(e.target.value || 0) })} />
        </div>
        <div>
          <label htmlFor="phase-edit-responsible_party" style={labelStyle}>Responsible party</label>
          <input id="phase-edit-responsible_party" disabled style={{ ...INP, background: "#F5F5F3" }} value={local.responsible_party || "Southern Oak Concrete"} />
        </div>
        {!!local.scheduleEventDatabaseId && (
          <RescheduleReasonInput
            value={local.reschedule_reason || ""}
            onChange={nextReason => updateLocal({ reschedule_reason: nextReason })}
            helperText="A fresh reason is required only when this update changes the scheduled date or time."
            error={validation?.field === "reschedule_reason" ? validation.message : ""}
            inputIdPrefix="phase-edit-reschedule-reason"
          />
        )}
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="phase-edit-notes" style={labelStyle}>Notes</label>
          <textarea id="phase-edit-notes" style={{ ...INP, minHeight: 96 }} value={local.notes || ""} onChange={e => updateLocal({ notes: e.target.value })} />
        </div>
      </div>
      <div className="schedule-modal-actions" style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 18, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ fontSize: ".76rem", color: B.gray, lineHeight: 1.5 }}>
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

function BuilderWorkflowScheduleModal({ draft, crews, onClose, onSave, validation = null, onValidationReset = () => {} }) {
  const [local, setLocal] = useState(draft);

  useEffect(() => {
    setLocal(draft);
  }, [draft]);

  useEffect(() => {
    if (validation?.phaseIndex === undefined || !validation?.field) return;
    requestAnimationFrame(() => document.getElementById(`builder-workflow-phase-${validation.phaseIndex}-${validation.field}`)?.focus());
  }, [validation?.phaseIndex, validation?.field]);

  const updatePhase = (index, patch, options = {}) => {
    onValidationReset();
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
      <FormValidationMessage message={validation && (validation.phaseIndex === undefined || !validation.field) ? validation.message : ""} style={{ marginBottom: 14 }} />
      <div style={{ fontSize: ".92rem", fontWeight: 700, color: B.dark }}>{local.builder_name || "Builder Job"}</div>
      <div style={{ fontSize: ".78rem", color: B.gray, marginBottom: 16 }}>
        {[local.community, local.lot_number ? `Lot ${local.lot_number}` : "", local.job_address].filter(Boolean).join(" · ") || "Builder slab workflow"}
      </div>
      <div className="builder-workflow-modal-list" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {(local.phases || []).map((phase, index) => (
          <div key={phase.id} className={`builder-workflow-modal-phase${validation?.phaseIndex === index ? " has-error" : ""}`} style={{ border: `1px solid ${validation?.phaseIndex === index ? VALIDATION_BORDER : B.border}`, borderRadius: 10, padding: 14, background: B.white }}>
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
                <label htmlFor={`builder-workflow-phase-${index}-scheduled_date`} style={labelStyle}>Scheduled date</label>
                <input
                  id={`builder-workflow-phase-${index}-scheduled_date`}
                  aria-invalid={validation?.phaseIndex === index && validation?.field === "scheduled_date" || undefined}
                  style={getErrorInputStyle(validation?.phaseIndex === index && validation?.field === "scheduled_date")}
                  type="date"
                  value={phase.scheduled_date || ""}
                  onChange={e => updatePhase(index, { scheduled_date: e.target.value, manual_date_override: index > 0 }, { recalculate: true })}
                />
                {validation?.phaseIndex === index && validation?.field === "scheduled_date" && <div style={{ fontSize: ".72rem", color: VALIDATION_COLOR, marginTop: 6, fontWeight: 700 }}>{validation.message}</div>}
              </div>
              <div>
                <label htmlFor={`builder-workflow-phase-${index}-scheduled_time`} style={labelStyle}>Start time</label>
                <input
                  id={`builder-workflow-phase-${index}-scheduled_time`}
                  style={INP}
                  type="time"
                  value={phase.scheduled_time || ""}
                  onChange={e => updatePhase(index, { scheduled_time: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor={`builder-workflow-phase-${index}-crew_id`} style={labelStyle}>Crew</label>
                <select
                  id={`builder-workflow-phase-${index}-crew_id`}
                  style={{ ...INP, cursor: "pointer" }}
                  value={phase.crew_id || ""}
                  onChange={e => updatePhase(index, { crew_id: e.target.value })}
                >
                  {crews.map(crew => <option key={crew.id} value={crew.id}>{crew.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor={`builder-workflow-phase-${index}-status`} style={labelStyle}>Status</label>
                <select
                  id={`builder-workflow-phase-${index}-status`}
                  style={{ ...INP, cursor: "pointer" }}
                  value={phase.status || "Scheduled"}
                  onChange={e => updatePhase(index, { status: e.target.value })}
                >
                  {JOB_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label htmlFor={`builder-workflow-phase-${index}-notes`} style={labelStyle}>Notes</label>
              <textarea
                id={`builder-workflow-phase-${index}-notes`}
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
      <div className="phase-detail-modal-head" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: ".82rem", color: B.gray }}>{[detail.builder_name, detail.community, detail.lot_number ? `Lot ${detail.lot_number}` : ""].filter(Boolean).join(" · ") || "Builder workflow phase"}</div>
      </div>
      <div className="phase-detail-modal-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
        {values.map(([label, value]) => (
          <div key={label} className="job-detail-info-item">
            <div className="job-detail-info-label">{label}</div>
            <div className="job-detail-info-value">{value}</div>
          </div>
        ))}
      </div>
      <div className="job-detail-notes-block" style={{ marginTop: 16 }}>
        <div className="job-detail-info-label">Notes</div>
        <div className="job-detail-notes-copy">{detail.phase.notes || "-"}</div>
      </div>
      <div className="schedule-modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
        {!detail.phase.scheduleEventDatabaseId && <Btn v="green" onClick={onSchedule}>Schedule Phase</Btn>}
        {!!detail.phase.scheduleEventDatabaseId && <Btn v="outline" onClick={onEdit}>Edit Phase</Btn>}
        {!!detail.phase.scheduleEventDatabaseId && <Btn v="green" onClick={onReschedule}>Reschedule Phase</Btn>}
      </div>
    </Modal>
  );
}

function PushSummaryModal({ preview, onClose, onConfirm, validation = null, onValidationReset = () => {} }) {
  const [rescheduleReason, setRescheduleReason] = useState(preview.reschedule_reason || "");
  const requiresRescheduleReason = !!preview.requiresRescheduleReason;
  const conflictCount = preview.summary.filter(item => item.conflict).length;

  useEffect(() => {
    setRescheduleReason(preview.reschedule_reason || "");
  }, [preview]);

  useEffect(() => {
    if (validation?.field !== "reschedule_reason") return;
    requestAnimationFrame(() => document.getElementById("push-preview-reschedule-reason-preset")?.focus());
  }, [validation?.field]);

  return (
    <Modal title="Confirm Builder Schedule Push" onClose={onClose} width={860}>
      <FormValidationMessage message={validation && !validation.field ? validation.message : ""} style={{ marginBottom: 14 }} />
      <div className="push-summary-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginBottom: 16 }}>
        <Card className="push-summary-card" style={{ padding: 14, background: B.white }}>
          <div style={{ fontSize: ".72rem", color: B.gray, textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>Phases affected</div>
          <div style={{ fontSize: "1.2rem", fontWeight: 700, color: B.dark }}>{preview.summary.length}</div>
        </Card>
        <Card className="push-summary-card" style={{ padding: 14, background: conflictCount ? "#FFF6F4" : "#F5FBF6", borderColor: conflictCount ? "#F0C1B8" : "#CFE5D2" }}>
          <div style={{ fontSize: ".72rem", color: B.gray, textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>Conflicts</div>
          <div style={{ fontSize: "1.2rem", fontWeight: 700, color: conflictCount ? "#922B21" : B.green }}>{conflictCount}</div>
        </Card>
        <Card className="push-summary-card" style={{ padding: 14, background: B.white }}>
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
            onChange={nextReason => {
              onValidationReset();
              setRescheduleReason(nextReason);
            }}
            required
            error={validation?.field === "reschedule_reason" ? validation.message : ""}
            inputIdPrefix="push-preview-reschedule-reason"
          />
        </Card>
      )}
      <div className="schedule-modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
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
      <div style={{ fontSize: ".8rem", color: B.gray, marginBottom: 14, lineHeight: 1.6 }}>
        {state.message || "This schedule lands on a weekend. Pick the assigned crew and choose whether to apply a weekend fee before saving."}
      </div>
      <div className="weekend-override-grid" style={{ display: "grid", gap: 12 }}>
        <div>
          <label style={labelStyle}>Assigned crew</label>
          <select style={{ ...INP, cursor: "pointer" }} value={crewId} onChange={e => setCrewId(e.target.value)}>
            {crews.map(crew => <option key={crew.id} value={crew.id}>{crew.name}</option>)}
          </select>
        </div>
        <label className="weekend-override-checkbox" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: ".82rem", color: B.mid }}>
          <input type="checkbox" checked={chargeWeekendFee} onChange={e => setChargeWeekendFee(e.target.checked)} />
          <span>Charge weekend fee</span>
        </label>
      </div>
      <div className="schedule-modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
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
  const [calendarFocusDate, setCalendarFocusDate] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [quickViewCustomerId, setQuickViewCustomerId] = useState(null);
  const [customerModalCustomerId, setCustomerModalCustomerId] = useState(null);
  const [quickViewRestoreTarget, setQuickViewRestoreTarget] = useState(null);
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
    deleteEvent: deleteScheduleEvent,
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
  const [residentialValidation, setResidentialValidation] = useState(null);
  const [builderScheduleValidation, setBuilderScheduleValidation] = useState(null);
  const [builderWorkflowValidation, setBuilderWorkflowValidation] = useState(null);
  const [phaseDraftValidation, setPhaseDraftValidation] = useState(null);
  const [pushPreviewValidation, setPushPreviewValidation] = useState(null);
  const [financeView, setFinanceView] = useState("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if ((appRole === "office" || appRole === "field" || !appRole) && financeView === "expenses") {
      setFinanceView("overview");
    }
  }, [appRole, financeView]);

  const selectedTicket = tickets.find(ticket => ticket.id === selectedTicketId) || null;
  const selectedCustomer = customers.find(customer => customer.id === selectedCustomerId) || null;
  const quickViewCustomer = customers.find(customer => customer.id === quickViewCustomerId) || null;
  const customerModalCustomer = customers.find(customer => customer.id === customerModalCustomerId) || null;
  const customerEditTarget = selectedCustomer || customerModalCustomer || null;
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
    if (!customerEditTarget) {
      setCustomerEditOpen(false);
      setCustomerEditSaving(false);
      setCustomerEditError("");
      setCustomerModalCustomerId(null);
    }
  }, [customerEditTarget]);
  useEffect(() => {
    if (!selectedCustomer) {
      setCustomerDeactivateOpen(false);
      setCustomerLifecycleSaving(false);
      setCustomerLifecycleError("");
    }
  }, [selectedCustomer]);
  const closeQuickView = (restoreFocus = true) => {
    const nextRestoreTarget = quickViewRestoreTarget;
    setQuickViewCustomerId(null);
    setQuickViewRestoreTarget(null);

    if (restoreFocus && nextRestoreTarget?.isConnected && typeof nextRestoreTarget.focus === "function") {
      window.setTimeout(() => {
        nextRestoreTarget.focus();
      }, 0);
    }
  };
  const openQuickViewForCustomer = (customerId, triggerElement = null) => {
    setQuickViewRestoreTarget(triggerElement || null);
    setQuickViewCustomerId(customerId);
  };
  const openCustomerEdit = () => {
    setCustomerModalCustomerId(null);
    setCustomerEditError("");
    setCustomerEditOpen(true);
  };
  const openQuickViewEdit = customerId => {
    closeQuickView(false);
    setSelectedCustomerId(null);
    setCustomerModalCustomerId(customerId);
    setCustomerEditError("");
    setCustomerEditOpen(true);
  };
  const openFullCustomerFromQuickView = customerId => {
    closeQuickView(false);
    setCustomerModalCustomerId(null);
    setSelectedCustomerId(customerId);
  };
  const navigateToAdminSection = nextSection => {
    closeQuickView(false);
    setSelectedJobId(null);
    setSelectedCalendarJobId(null);
    setSelectedCustomerId(null);
    setCustomerModalCustomerId(null);
    setCustomerEditOpen(false);
    setCustomerEditSaving(false);
    setCustomerEditError("");
    setCustomerDeactivateOpen(false);
    setCustomerLifecycleSaving(false);
    setCustomerLifecycleError("");
    setResidentialDraft(null);
    setBuilderScheduleDraft(null);
    setBuilderWorkflowDraft(null);
    setPhaseDraft(null);
    setPhaseDetailState(null);
    setPushPreview(null);
    setConflictState(null);
    setWeekendOverrideState(null);
    setWarningState(null);
    setResidentialValidation(null);
    setBuilderScheduleValidation(null);
    setBuilderWorkflowValidation(null);
    setPhaseDraftValidation(null);
    setPushPreviewValidation(null);
    setSection(nextSection);
    if (nextSection !== "finance") {
      setFinanceView("overview");
    }
    setMobileNavOpen(false);
  };
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
  const isSiteVisitScheduleUniqueViolation = error => {
    const summary = error?.supabaseError;
    const text = `${summary?.message || ""} ${summary?.details || ""} ${summary?.hint || ""}`.toLowerCase();
    return summary?.code === "23505" && text.includes("schedule_events_one_active_site_visit_per_estimate_idx");
  };
  const appendWorkflowHistoryEntry = (ticket, status, note) => {
    const existingHistory = Array.isArray(ticket.history) ? ticket.history : [];
    const lastEntry = existingHistory[existingHistory.length - 1];

    if (lastEntry?.s === status && lastEntry?.n === note) {
      return existingHistory;
    }

    return [...existingHistory, { s: status, d: new Date().toISOString(), n: note }];
  };
  const findActiveSiteVisitScheduleRow = estimateDatabaseId => (
    scheduleRows.find(row =>
      row.builder_step === "site_visit"
      && row.estimate_id === estimateDatabaseId
      && ACTIVE_SITE_VISIT_DATABASE_STATUSES.includes(row.status)
    ) || null
  );
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
      closeQuickView(false);
      setSection(defaultSection);
      setSelectedTicketId(null);
      setSelectedJobId(null);
      setSelectedCalendarJobId(null);
      setSelectedCustomerId(null);
      setCustomerModalCustomerId(null);
      setCustomerEditOpen(false);
      setCustomerEditSaving(false);
      setCustomerEditError("");
      setCustomerDeactivateOpen(false);
      setCustomerLifecycleSaving(false);
      setCustomerLifecycleError("");

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
      showScheduleWarning("Builder Job Unavailable", "Add a builder first before creating a builder job.");
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
    const savedTicket = await onUpdateTicket(updated);
    setSelectedTicketId((savedTicket || updated).id);
    return savedTicket || updated;
  };

  const syncTicketFromDatabase = async estimateDatabaseId => {
    if (!estimateDatabaseId) {
      return null;
    }

    const refreshedEstimate = await fetchEstimateById(estimateDatabaseId);
    const refreshedTicket = databaseEstimateToTicket(refreshedEstimate);
    return updateTicket(refreshedTicket);
  };

  const buildWorkflowTicketUpdate = (
    ticket,
    status,
    note,
    overrides: { workflowStatus?: string; customerStatus?: string | null } = {}
  ) => {
    const resolvedCustomerStatus = Object.prototype.hasOwnProperty.call(overrides, "customerStatus")
      ? overrides.customerStatus
      : (ticket.customerStatus ?? null);

    return {
      ...ticket,
      status,
      workflowStatus: overrides.workflowStatus || mapTicketStatusToWorkflowStatus(status, ticket.workflowStatus || "new_request"),
      customerStatus: resolvedCustomerStatus,
      history: appendWorkflowHistoryEntry(ticket, status, note),
    };
  };

  const applyTicketStatus = async (ticket, status, note) => {
    if (status === "Estimate Accepted") {
      return;
    }

    const updated = buildWorkflowTicketUpdate(
      ticket,
      status,
      note
    );
    try {
      await onUpdateTicket(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update estimate status.";
      console.error("Unable to update estimate status:", error);
      window.alert(message);
    }
  };

  const showScheduleWriteError = (actionLabel, error) => {
    showScheduleWarning("Scheduling Update Failed", buildScheduleErrorMessage(actionLabel, error));
  };

  const openSiteVisitOnCalendar = appointment => {
    if (!appointment) {
      return;
    }

    setSelectedTicketId(null);
    setSelectedJobId(null);
    setSelectedCalendarJobId(null);
    setCalendarFocusDate(appointment.scheduledDate || todayIso());
    setSection("calendar");
  };

  const openCalendarRecord = jobId => {
    if (String(jobId || "").startsWith(SITE_VISIT_CALENDAR_PREFIX)) {
      const estimateDatabaseId = String(jobId).slice(SITE_VISIT_CALENDAR_PREFIX.length);
      const matchingTicket = tickets.find(ticket => ticket.databaseId === estimateDatabaseId);

      if (matchingTicket) {
        setSelectedJobId(null);
        setSelectedCalendarJobId(null);
        setSelectedTicketId(matchingTicket.id);
        setSection("calendar");
        return;
      }
    }

    setSelectedTicketId(null);
    setSelectedCalendarJobId(jobId);
    setSection("calendar");
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
    setBuilderScheduleValidation(null);
    setResidentialValidation(null);
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
    setBuilderScheduleValidation(null);
    setResidentialValidation(null);
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
    setBuilderScheduleValidation(null);
    setResidentialValidation(null);
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
  const buildScheduleErrorMessage = (actionLabel, error) => {
    const message = error instanceof Error ? error.message : `Unable to ${actionLabel}.`;
    console.error(`Unable to ${actionLabel}:`, error);
    return message;
  };
  const showScheduleWarning = (title, message) => {
    setWarningState({ title, message });
  };
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
      return "Reschedule reasons must be 500 characters or fewer.";
    }
    return "";
  };

  const saveSiteVisitSchedule = async (ticket, draft) => {
    if (!canManageSchedule) {
      throw new Error("You do not have permission to schedule site visits.");
    }

    if (!ticket?.databaseId || !draft?.estimateDatabaseId) {
      throw new Error("This estimate is missing its database ID, so the site visit cannot be scheduled.");
    }

    if (!draft.scheduled_date) {
      throw new Error("Choose a site visit date before scheduling.");
    }

    if (!draft.scheduled_time) {
      throw new Error("Choose a site visit start time before scheduling.");
    }

    if (!draft.crew_id) {
      throw new Error("Assign a crew before scheduling this site visit.");
    }

    const durationHours = Number(draft.duration_hours || 0);
    if (!Number.isFinite(durationHours) || durationHours <= 0) {
      throw new Error("Choose an estimated duration before scheduling this site visit.");
    }

    if (isSunday(draft.scheduled_date)) {
      throw new Error("Site visits cannot be scheduled on Sunday. Please choose another date.");
    }

    if (isSaturday(draft.scheduled_date) && settings.skipWeekendsByDefault && !settings.allowWeekendOverride) {
      throw new Error("Saturday scheduling requires an override, and weekend overrides are currently disabled.");
    }

    const candidateEvents = [buildSiteVisitConflictCandidate(draft)];
    const existingActiveSiteVisitRow = findActiveSiteVisitScheduleRow(draft.estimateDatabaseId);
    const existingCalendarEvents = existingActiveSiteVisitRow
      ? scheduleEvents.filter(event => event.databaseId !== existingActiveSiteVisitRow.id)
      : scheduleEvents;
    const conflicts = detectCrewConflicts({
      candidateEvents,
      existingEvents: existingCalendarEvents,
      crews,
    });

    if (conflicts.length) {
      const [conflict] = conflicts;
      const conflictingEvent = conflict.conflictingEvents[0];
      const crewName = conflict.crew?.name || "the selected crew";
      throw new Error(
        `${crewName} is already booked on ${fmtDate(draft.scheduled_date)} for ${conflictingEvent?.customer_name || conflictingEvent?.title || "another scheduled item"}.`
      );
    }

    const scheduleNote = `Site visit scheduled for ${draft.scheduled_date}${draft.scheduled_time ? ` at ${normalizeTimeInputValue(draft.scheduled_time)}` : ""}.`;
    const appendScheduledHistory = currentTicket => ({
      ...currentTicket,
      status: "Site Visit Scheduled",
      workflowStatus: "site_visit_scheduled",
      followUpNeeded: false,
      history: appendWorkflowHistoryEntry(currentTicket, "Site Visit Scheduled", scheduleNote),
    });
    const mergeScheduledHistory = savedTicket => ({
      ...savedTicket,
      history: appendWorkflowHistoryEntry(savedTicket, "Site Visit Scheduled", scheduleNote),
    });

    if (existingActiveSiteVisitRow) {
      const refreshedTicket = await syncTicketFromDatabase(draft.estimateDatabaseId);

      if (refreshedTicket?.status === "Site Visit Scheduled" && refreshedTicket.siteVisitAppointment) {
        await refreshScheduleEvents();
        return refreshedTicket;
      }

      const normalizedTicket = appendScheduledHistory(refreshedTicket || ticket);
      const savedTicket = await updateTicket(normalizedTicket);
      await refreshScheduleEvents();
      return mergeScheduledHistory(savedTicket || normalizedTicket);
    }

    const endTime = addHoursToTime(draft.scheduled_time, durationHours) || null;
    let createdScheduleRow = null;

    try {
      createdScheduleRow = await createScheduleEvent({
        estimate_id: draft.estimateDatabaseId,
        crew_id: draft.crew_id || null,
        scheduled_date: draft.scheduled_date,
        start_time: normalizeTimeInputValue(draft.scheduled_time) || null,
        end_time: endTime,
        builder_step: "site_visit",
        status: "scheduled",
        notes: draft.notes?.trim() || null,
      });

      const savedTicket = await updateTicket(appendScheduledHistory(ticket));
      await refreshScheduleEvents();
      return mergeScheduledHistory(savedTicket || appendScheduledHistory(ticket));
    } catch (error) {
      if (isSiteVisitScheduleUniqueViolation(error)) {
        await refreshScheduleEvents();
        const refreshedTicket = await syncTicketFromDatabase(draft.estimateDatabaseId);

        if (refreshedTicket?.status === "Site Visit Scheduled" && refreshedTicket.siteVisitAppointment) {
          return refreshedTicket;
        }

        if (refreshedTicket) {
          const savedTicket = await updateTicket(appendScheduledHistory(refreshedTicket));
          return savedTicket;
        }
      }

      if (createdScheduleRow?.id) {
        try {
          await deleteScheduleEvent(createdScheduleRow.id);
          await refreshScheduleEvents();
        } catch (cleanupError) {
          console.error("Unable to roll back site visit calendar event after estimate status update failure:", cleanupError);
        }
      }

      throw error;
    }
  };

  const saveResidentialSchedule = async (draft, conflictOverrideReason = "") => {
    if (!canManageSchedule) return;
    if (!draft.scheduled_date) {
      setResidentialValidation({ field: "scheduled_date", message: "Choose a scheduled date before saving this job." });
      return;
    }
    const reasonLengthError = validateRescheduleReasonLength(draft.reschedule_reason);
    if (reasonLengthError) {
      setResidentialValidation({ field: "reschedule_reason", message: reasonLengthError });
      return;
    }
    setResidentialValidation(null);
    let resolvedJobId = draft.job_database_id || "";
    let resolvedScheduleEventDatabaseId = getResidentialScheduleEventId(resolvedJobId, draft.scheduleEventDatabaseId || "");
    if (isSunday(draft.scheduled_date)) {
      blockSundaySchedule("Jobs");
      return;
    }
    if (isSaturday(draft.scheduled_date) && settings.skipWeekendsByDefault && !draft.weekend_override) {
      if (!settings.allowWeekendOverride) {
        setResidentialValidation({ field: null, message: "Saturday scheduling requires an override, and weekend overrides are currently disabled." });
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
        setResidentialValidation({ field: "reschedule_reason", message: "A reschedule reason is required when changing the scheduled date or time." });
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
        setResidentialValidation(null);
        setSelectedCalendarJobId(null);
        setSection(draft.return_section || "calendar");
        return;
      } catch (error) {
        setResidentialValidation({ field: null, message: buildScheduleErrorMessage("update the calendar event", error) });
        return;
      }
    }

    if (!draft.estimateDatabaseId) {
      setResidentialValidation({ field: null, message: "This estimate is not linked to a database job yet, so the calendar event cannot be saved." });
      return;
    }

    let jobId = resolvedJobId || null;

    if (!jobId) {
      try {
        jobId = await findJobIdByEstimateId(draft.estimateDatabaseId);
      } catch (error) {
        setResidentialValidation({ field: null, message: buildScheduleErrorMessage("locate the accepted job", error) });
        return;
      }
    }

    if (!jobId) {
      setResidentialValidation({ field: null, message: "No database job was found for this accepted estimate. Confirm the accepted-estimate job trigger has run before scheduling." });
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
        setResidentialValidation({ field: "reschedule_reason", message: "A reschedule reason is required when changing the scheduled date or time." });
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
        setResidentialValidation(null);
        setSelectedCalendarJobId(null);
        setSection(draft.return_section || "calendar");
        return;
      } catch (error) {
        setResidentialValidation({ field: null, message: buildScheduleErrorMessage("update the calendar event", error) });
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
        void applyTicketStatus({ ...source }, "Won", `Converted to scheduled residential job${draft.work_order_number ? ` (${draft.work_order_number})` : ""}.`);
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
      setResidentialValidation(null);
      setSelectedJobId(null);
      setSection(draft.return_section || "tickets");
    } catch (error) {
      if (isResidentialScheduleUniqueViolation(error)) {
        setResidentialValidation({ field: null, message: "This residential job already has a scheduled event. Reopen it and use Reschedule instead." });
        void refreshScheduleEvents();
        void refreshJobs();
        return;
      }
      setResidentialValidation({ field: null, message: buildScheduleErrorMessage("create the calendar event", error) });
    }
  };

  const createBuilderJob = async draft => {
    const builder = builders.find(item => item.id === draft.builder_id);

    if (!builder?.databaseId) {
      showScheduleWarning("Builder Job Unavailable", "The selected builder is missing its database ID, so this builder job cannot be created.");
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
      showScheduleWarning("Builder Job Unavailable", message);
    }
  };

  const saveBuilderSchedule = draft => {
    if (!canManageSchedule) return;
    if (!draft.scheduled_date) {
      setBuilderScheduleValidation({ field: "scheduled_date", message: "Choose a start date before saving this builder schedule." });
      return;
    }
    setBuilderScheduleValidation(null);
    const databaseBackedBuilderJob = findCalendarJob(draft.job_id);
    if (!databaseBackedBuilderJob) {
      setBuilderScheduleValidation({ field: null, message: "This builder workflow does not have a matching database job record yet, so it cannot be written to Supabase schedule_events in this phase." });
      return;
    }
    setBuilderScheduleValidation({ field: null, message: "Builder scheduling from the Jobs flow is not enabled in this phase unless the workflow is already backed by schedule_events." });
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
      setPhaseDraftValidation(null);
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
    setPhaseDraftValidation(null);
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
    setBuilderWorkflowValidation(null);

    for (let idx = 0; idx < (draft.phases || []).length; idx += 1) {
      const phase = draft.phases[idx];
      const previousPhase = idx > 0 ? draft.phases[idx - 1] : null;

      if (!phase.scheduled_date) {
        setBuilderWorkflowValidation({ phaseIndex: idx, field: "scheduled_date", message: `${phase.phase_label} requires a scheduled date before saving.` });
        return;
      }

      if (previousPhase?.scheduled_date && phase.scheduled_date < previousPhase.scheduled_date) {
        setBuilderWorkflowValidation({ phaseIndex: idx, field: "scheduled_date", message: `${phase.phase_label} cannot be scheduled before ${previousPhase.phase_label}.` });
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
        setBuilderWorkflowValidation({ field: null, message: "Saturday scheduling requires an override, and weekend overrides are currently disabled." });
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
      setBuilderWorkflowValidation({ field: null, message: "This builder workflow does not have a matching database job record, so phase scheduling cannot be written to Supabase." });
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
      setBuilderWorkflowValidation(null);
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
      setBuilderWorkflowValidation({ field: null, message: buildScheduleErrorMessage(savedCount > 0 ? "finish saving the builder workflow" : "save the builder workflow", error) });
    }
  };

  const saveBuilderPhase = async (draft, overrideReason = "") => {
    if (!canManageSchedule) return;
    const reasonLengthError = validateRescheduleReasonLength(draft.reschedule_reason);
    if (reasonLengthError) {
      setPhaseDraftValidation({ field: "reschedule_reason", message: reasonLengthError });
      return;
    }
    setPhaseDraftValidation(null);
    const sourceJob = getBuilderJobSource(draft.job_id, draft.job_database_id);
    if (!sourceJob || sourceJob.schedule_type !== "builder_slab") {
      setPhaseDraftValidation({ field: null, message: "This builder workflow does not have a matching database job record, so phase scheduling cannot be written to Supabase." });
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
        setPhaseDraftValidation({ field: null, message: "Schedule Form Slab first so the initial builder workflow can create all three standard phases together." });
        return;
      }

      setPhaseDraft(null);
      setBuilderWorkflowValidation(null);
      setBuilderWorkflowDraft(createInitialBuilderWorkflowDraft(sourceJob, normalizedDraft, jobDatabaseId));
      return;
    }

    const previousPhase = sortedPhases[phaseIndex - 1];
    if (previousPhase?.scheduled_date && normalizedDraft.scheduled_date && normalizedDraft.scheduled_date < previousPhase.scheduled_date) {
      setPhaseDraftValidation({ field: "scheduled_date", message: `${normalizedDraft.phase_label} cannot be scheduled before ${previousPhase.phase_label}.` });
      return;
    }
    if (normalizedDraft.scheduled_date && isSunday(normalizedDraft.scheduled_date)) {
      blockSundaySchedule(normalizedDraft.phase_label);
      return;
    }
    if (normalizedDraft.scheduled_date && isSaturday(normalizedDraft.scheduled_date) && settings.skipWeekendsByDefault && !normalizedDraft.weekend_override) {
      if (!settings.allowWeekendOverride) {
        setPhaseDraftValidation({ field: null, message: "Saturday scheduling requires an override, and weekend overrides are currently disabled." });
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
      setPhaseDraftValidation({ field: "reschedule_reason", message: "A reschedule reason is required when changing the scheduled date or time." });
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
      setPhaseDraftValidation(null);
      void refreshJobs();
      setPhaseDraft(null);
    } catch (error) {
      setPhaseDraftValidation({ field: null, message: buildScheduleErrorMessage(normalizedDraft.scheduleEventDatabaseId ? "update the builder schedule" : "create the builder schedule", error) });
    }
  };

  const applyPushPreview = async (overrideReason = "", rescheduleReason = "") => {
    if (!canManageSchedule) return;
    if (!pushPreview) return;
    const reasonLengthError = validateRescheduleReasonLength(rescheduleReason);
    if (reasonLengthError) {
      setPushPreviewValidation({ field: "reschedule_reason", message: reasonLengthError });
      return;
    }
    setPushPreviewValidation(null);
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
        setPushPreviewValidation({ field: "reschedule_reason", message: "A push-forward reason is required because one or more existing scheduled phases are being rescheduled." });
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
        setPushPreviewValidation(null);
        void refreshJobs();
        setPushPreview(null);
      } catch (error) {
        setPushPreviewValidation({ field: null, message: buildScheduleErrorMessage("apply the builder schedule push", error) });
      }
      return;
    }
    setPushPreviewValidation({ field: null, message: "This builder schedule push cannot be persisted until the workflow is backed by schedule_events." });
  };

  const saveCustomerEdit = async draft => {
    if (!customerEditTarget) return;

    setCustomerEditSaving(true);
    setCustomerEditError("");

    try {
      await updateStoredCustomer(customerEditTarget.id, {
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
      if (!selectedCustomer) {
        setCustomerModalCustomerId(null);
      }
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
      return (
        <TicketDetailView
          ticket={selectedTicket}
          appRole={appRole}
          crews={crews}
          onBack={() => setSelectedTicketId(null)}
          onRefreshJobs={refreshJobs}
          onUpdateTicket={updateTicket}
          onOpenSchedule={openResidentialSchedule}
          onScheduleSiteVisit={saveSiteVisitSchedule}
          onViewSiteVisitCalendar={openSiteVisitOnCalendar}
          sourceJob={sourceJob}
        />
      );
    }
    if (selectedCalendarJob) {
      return (
        <JobDetailView
          job={selectedCalendarJob}
          crews={crews}
          latestRescheduleReasons={latestRescheduleReasons}
          profileDisplayNames={profileDisplayNames}
          onBack={() => setSelectedCalendarJobId(null)}
          backLabel="Back to Calendar"
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
      return <JobDetailView job={selectedJob} crews={crews} latestRescheduleReasons={latestRescheduleReasons} profileDisplayNames={profileDisplayNames} onBack={() => setSelectedJobId(null)} backLabel="Back to Jobs" onSaveJob={job => {
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
    if (section === "dashboard") return <DashboardHomeSection tickets={tickets} jobs={jobs} events={allEvents} conflicts={activeConflicts} setSection={navigateToAdminSection} />;
    if (section === "tickets") return <EstimateTicketsSection tickets={tickets} ticketsLoading={ticketsLoading} ticketsError={ticketsError} onSelectTicket={ticket => setSelectedTicketId(ticket.id)} onScheduleTicket={openResidentialSchedule} jobs={jobs} scheduledEstimateDatabaseIds={scheduledEstimateDatabaseIds} />;
    if (section === "calendar") return <CalendarSection events={scheduleEvents} crews={crews} onOpenJob={openCalendarRecord} focusDate={calendarFocusDate} pendingResidentialDraft={canManageSchedule ? residentialDraft : null} onPendingResidentialDraftChange={setResidentialDraft} onSavePendingResidentialSchedule={saveResidentialSchedule} onCancelPendingResidentialSchedule={() => { setResidentialDraft(null); setResidentialValidation(null); }} pendingBuilderSchedule={canManageSchedule ? builderScheduleDraft : null} onPendingBuilderScheduleChange={setBuilderScheduleDraft} onSavePendingBuilderSchedule={saveBuilderSchedule} onCancelPendingBuilderSchedule={() => { setBuilderScheduleDraft(null); setBuilderScheduleValidation(null); }} readOnly={calendarReadOnly} loading={scheduleLoading} error={scheduleError} residentialValidation={residentialValidation} onResidentialValidationReset={() => setResidentialValidation(null)} builderValidation={builderScheduleValidation} onBuilderValidationReset={() => setBuilderScheduleValidation(null)} />;
    if (section === "jobs") return <JobsSection jobs={jobs} crews={crews} loading={jobsLoading} error={jobsError} onSelectJob={jobId => setSelectedJobId(jobId)} onCreateBuilderJob={openBuilderJobModal} canCreateBuilderJob={canManageSchedule} />;
    if (section === "customers") return <CustomersSection customers={customers} loading={customersLoading} error={customersError} tickets={tickets} jobs={jobs} onSelectCustomer={openQuickViewForCustomer} search={customerSearch} onSearchChange={setCustomerSearch} typeFilter={customerTypeFilter} onTypeFilterChange={setCustomerTypeFilter} statusFilter={customerStatusFilter} onStatusFilterChange={setCustomerStatusFilter} />;
    if (section === "crews") return <CrewsSection crews={crews} jobs={jobs} onCreateCrew={createCrew} onUpdateCrew={updateCrew} />;
    if (section === "builders") return <BuildersSection builders={builders} buildersLoading={buildersLoading} buildersError={buildersError} jobs={jobs} crews={crews} onCreateBuilderJob={openBuilderJobModal} onCreateBuilder={() => setBuilderRecordDraft({ name: "", contact: "", phone: "", communities: "" })} onOpenJob={jobId => setSelectedJobId(jobId)} />;
    if (section === "finance") return <FinanceDashboard financeView={financeView} onFinanceViewChange={setFinanceView} appRole={appRole} jobs={jobs} jobsLoading={jobsLoading} />;
    return <SettingsSection settings={settings} onUpdateSettings={patch => setSettings(prev => ({ ...prev, ...patch }))} historyCounts={{ scheduleChanges: scheduleHistory.length, overrides: overrideHistory.length }} />;
  })();

  return (
    <div className="admin-page-shell" style={{ minHeight: "100vh", background: "#F4F6F3" }}>
      {!selectedTicket && (
        <div className="admin-shell">
          <AdminSidebar
            section={section}
            setSection={navigateToAdminSection}
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
            <div className="admin-content-shell" style={{ padding: "22px clamp(14px, 1.5vw, 24px) 60px" }}>
              {content}
            </div>
          </div>
        </div>
      )}
      {selectedTicket && content}

      {quickViewCustomer && (
        <CustomerQuickViewModal
          customer={quickViewCustomer}
          tickets={tickets}
          jobs={jobs}
          canManageCustomer={canManageCustomers}
          customerActionBusy={customerEditSaving}
          onClose={() => closeQuickView(true)}
          onEditCustomer={() => openQuickViewEdit(quickViewCustomer.id)}
          onOpenFullCustomer={() => openFullCustomerFromQuickView(quickViewCustomer.id)}
        />
      )}

      {canManageSchedule && builderDraft && <BuilderJobModal draft={builderDraft} crews={crews} builders={builders} onClose={() => setBuilderDraft(null)} onSave={createBuilderJob} />}
      {hasFullAccess(appRole) && builderRecordDraft && <BuilderRecordModal draft={builderRecordDraft} onClose={() => setBuilderRecordDraft(null)} onSave={createBuilderRecord} />}
      {customerEditTarget && customerEditOpen && (
        <CustomerEditModal
          customer={customerEditTarget}
          saving={customerEditSaving}
          error={customerEditError}
          onClose={() => {
            if (customerEditSaving) return;
            setCustomerEditOpen(false);
            setCustomerEditError("");
            if (!selectedCustomer) {
              setCustomerModalCustomerId(null);
            }
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
      {canManageSchedule && builderWorkflowDraft && <BuilderWorkflowScheduleModal draft={builderWorkflowDraft} crews={crews} onClose={() => { setBuilderWorkflowDraft(null); setBuilderWorkflowValidation(null); }} onSave={saveInitialBuilderWorkflow} validation={builderWorkflowValidation} onValidationReset={() => setBuilderWorkflowValidation(null)} />}
      {canManageSchedule && phaseDraft && <PhaseEditModal draft={phaseDraft} crews={crews} onClose={() => { setPhaseDraft(null); setPhaseDraftValidation(null); }} onSave={phaseDraft.isResidential ? saveResidentialReschedule : saveBuilderPhase} isResidential={phaseDraft.isResidential} validation={phaseDraftValidation} onValidationReset={() => setPhaseDraftValidation(null)} />}
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
      {canManageSchedule && pushPreview && <PushSummaryModal preview={pushPreview} onClose={() => { setPushPreview(null); setPushPreviewValidation(null); }} onConfirm={reason => applyPushPreview("", reason)} validation={pushPreviewValidation} onValidationReset={() => setPushPreviewValidation(null)} />}
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
