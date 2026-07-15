import { BUILDER_COLOR_PALETTE, BUILDER_PHASES, sortBuilderPhases } from "../builders/builderUtils";
import {
  databaseStatusToCalendarStatus,
  getCountsTowardCrew,
  getResponsibleParty,
  getSchedulePhaseLabel,
  toUiBuilderPhaseKey,
} from "../calendar/calendarUtils";

export interface DatabaseJobCustomerRow {
  id: string;
  first_name: string;
  last_name: string | null;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  customer_type: string | null;
  notes: string | null;
}

export interface DatabaseJobScheduleEventRow {
  id: string;
  job_id: string;
  crew_id: string | null;
  scheduled_date: string;
  start_time: string | null;
  end_time: string | null;
  work_order_number: string | null;
  builder_step: string | null;
  status: string;
  notes: string | null;
  last_reschedule_reason?: string | null;
  last_rescheduled_at?: string | null;
  last_rescheduled_by?: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface DatabaseJobRow {
  id: string;
  customer_id: string;
  estimate_id: string | null;
  purchase_order_number?: string | null;
  builder_id?: string | null;
  job_name: string;
  job_address: string | null;
  job_type: string;
  status: string;
  description: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  community?: string | null;
  lot_number?: string | null;
  customer: DatabaseJobCustomerRow | null;
  schedule_events: DatabaseJobScheduleEventRow[] | null;
}

export interface JobBuilderReference {
  id: string;
  databaseId?: string;
  name: string;
  phone?: string;
  color?: string;
}

export interface FrontendJobPhase {
  id: string;
  scheduleEventDatabaseId: string;
  phase_key: string;
  phase_label: string;
  responsible_party: string;
  counts_toward_crew: boolean;
  scheduled_date: string;
  scheduled_time: string;
  end_time?: string;
  crew_id: string;
  work_order_number: string;
  day_capacity_used: number;
  estimated_duration: number;
  status: string;
  notes: string;
  last_reschedule_reason?: string;
}

export interface FrontendJob {
  id: string;
  databaseId: string;
  customerDatabaseId?: string;
  scheduleEventDatabaseId: string;
  estimate_database_id: string;
  schedule_type: "residential" | "builder_slab";
  name: string;
  customer_name: string;
  sourceTicketId: string;
  builder_id: string;
  builder_database_id: string;
  builder_name: string;
  builder_color: string;
  community: string;
  lot_number: string;
  job_type: string;
  job_address: string;
  scheduled_date: string;
  scheduled_time: string;
  estimated_duration: number;
  day_capacity_used: number;
  crew_id: string;
  work_order_number: string;
  status: string;
  notes: string;
  last_reschedule_reason?: string;
  created_from: "estimate" | "builder";
  phases: FrontendJobPhase[];
}

function normalizeTimeValue(value: string | null | undefined) {
  return value ? value.slice(0, 5) : "";
}

function humanizeValue(value: string | null | undefined) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatCustomerName(customer: DatabaseJobCustomerRow | null) {
  if (!customer) {
    return "";
  }

  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim();
  return fullName || customer.company_name || "";
}

function formatEstimateTicketId(estimateId: string | null | undefined) {
  return estimateId ? `T-${estimateId.slice(0, 8).toUpperCase()}` : "";
}

function formatAddress(row: DatabaseJobRow) {
  const customer = row.customer;
  const customerAddress = [
    customer?.street_address,
    customer?.city,
    customer?.state,
    customer?.zip_code,
  ].filter(Boolean).join(", ");

  return row.job_address || customerAddress;
}

function isBuilderStep(step: string | null | undefined) {
  return !!step && step !== "residential_job";
}

function isBuilderJob(row: DatabaseJobRow) {
  return row.customer?.customer_type === "builder"
    || (row.schedule_events || []).some((event) => isBuilderStep(event.builder_step));
}

function getBuilderName(row: DatabaseJobRow) {
  return row.customer?.company_name || row.job_name || "";
}

function getBuilderColor(builderName: string, builders: JobBuilderReference[]) {
  const matchedBuilder = builders.find((builder) => builder.name.trim().toLowerCase() === builderName.trim().toLowerCase());
  if (matchedBuilder?.color) {
    return matchedBuilder.color;
  }

  const hash = Array.from(builderName).reduce((total, character) => total + character.charCodeAt(0), 0);
  return BUILDER_COLOR_PALETTE[hash % BUILDER_COLOR_PALETTE.length];
}

function getMatchedBuilder(row: DatabaseJobRow, builderName: string, builders: JobBuilderReference[]) {
  if (row.builder_id) {
    const matchedByDatabaseId = builders.find((builder) => builder.databaseId === row.builder_id);
    if (matchedByDatabaseId) {
      return matchedByDatabaseId;
    }
  }

  return builders.find((builder) => builder.name.trim().toLowerCase() === builderName.trim().toLowerCase()) || null;
}

function sortScheduleEvents(events: DatabaseJobScheduleEventRow[]) {
  return [...events].sort((first, second) => {
    const firstKey = `${first.scheduled_date} ${normalizeTimeValue(first.start_time)}`;
    const secondKey = `${second.scheduled_date} ${normalizeTimeValue(second.start_time)}`;
    return firstKey.localeCompare(secondKey) || first.id.localeCompare(second.id);
  });
}

function buildUnscheduledBuilderPhases() {
  return BUILDER_PHASES.map((phaseTemplate) => ({
    id: phaseTemplate.key,
    scheduleEventDatabaseId: "",
    phase_key: phaseTemplate.key,
    phase_label: phaseTemplate.label,
    responsible_party: phaseTemplate.responsible_party,
    counts_toward_crew: phaseTemplate.counts_toward_crew,
    scheduled_date: "",
    scheduled_time: "",
    end_time: "",
    crew_id: "",
    work_order_number: "",
    day_capacity_used: phaseTemplate.counts_toward_crew ? (phaseTemplate.key === "pour_slab" ? 1 : 0.5) : 0,
    estimated_duration: phaseTemplate.counts_toward_crew ? (phaseTemplate.key === "pour_slab" ? 1 : 0.5) : 0,
    status: "Ready to Schedule",
    notes: "",
    last_reschedule_reason: "",
  }));
}

function buildScheduledBuilderPhase(event: DatabaseJobScheduleEventRow) {
  const phaseKey = toUiBuilderPhaseKey(event.builder_step) || "other";
  return {
    id: event.id,
    scheduleEventDatabaseId: event.id,
    phase_key: phaseKey,
    phase_label: getSchedulePhaseLabel(phaseKey),
    responsible_party: getResponsibleParty(phaseKey),
    counts_toward_crew: getCountsTowardCrew(phaseKey, event.crew_id),
    scheduled_date: event.scheduled_date,
    scheduled_time: normalizeTimeValue(event.start_time),
    end_time: normalizeTimeValue(event.end_time),
    crew_id: event.crew_id || "",
    work_order_number: event.work_order_number || "",
    day_capacity_used: getCountsTowardCrew(phaseKey, event.crew_id) ? 1 : 0,
    estimated_duration: 1,
    status: databaseStatusToCalendarStatus(event.status),
    notes: event.notes || "",
    last_reschedule_reason: event.last_reschedule_reason || "",
  };
}

function buildBuilderPhases(events: DatabaseJobScheduleEventRow[]) {
  if (events.length === 0) {
    return buildUnscheduledBuilderPhases();
  }

  const scheduledPhases = sortBuilderPhases(events.map(buildScheduledBuilderPhase));
  const templatePhaseKeys = new Set(BUILDER_PHASES.map((phase) => phase.key));
  const scheduledByKey = new Map<string, FrontendJobPhase>();
  const extraScheduledPhases: FrontendJobPhase[] = [];

  scheduledPhases.forEach((phase) => {
    if (templatePhaseKeys.has(phase.phase_key) && !scheduledByKey.has(phase.phase_key)) {
      scheduledByKey.set(phase.phase_key, phase);
      return;
    }

    extraScheduledPhases.push(phase);
  });

  const mergedStandardPhases = buildUnscheduledBuilderPhases().map((phase) => ({
    ...phase,
    ...(scheduledByKey.get(phase.phase_key) || {}),
  }));

  return sortBuilderPhases([...mergedStandardPhases, ...extraScheduledPhases]);
}

function getResidentialStatus(row: DatabaseJobRow, events: DatabaseJobScheduleEventRow[]) {
  if (events.length > 0) {
    return databaseStatusToCalendarStatus(events[0].status);
  }

  switch (row.status) {
    case "completed":
      return "Completed";
    case "delayed":
      return "Delayed";
    case "cancelled":
      return "Cancelled";
    case "in_progress":
      return "In Progress";
    case "scheduled":
      return "Scheduled";
    case "unscheduled":
    default:
      return "Ready to Schedule";
  }
}

function getBuilderStatus(row: DatabaseJobRow, phases: FrontendJobPhase[]) {
  const activePhase = phases.find((phase) => !["Completed", "Cancelled"].includes(phase.status));
  if (activePhase) {
    return activePhase.status;
  }

  if (phases.length > 0 && phases.every((phase) => phase.status === "Completed")) {
    return "Completed";
  }

  return getResidentialStatus(row, []);
}

function mapResidentialJob(row: DatabaseJobRow, events: DatabaseJobScheduleEventRow[]): FrontendJob {
  const customerName = formatCustomerName(row.customer) || row.job_name || "Job";
  const primaryEvent = events[0] || null;

  return {
    id: row.id,
    databaseId: row.id,
    customerDatabaseId: row.customer_id,
    scheduleEventDatabaseId: primaryEvent?.id || "",
    estimate_database_id: row.estimate_id || "",
    schedule_type: "residential",
    name: customerName,
    customer_name: customerName,
    sourceTicketId: formatEstimateTicketId(row.estimate_id),
    builder_id: "",
    builder_database_id: "",
    builder_name: "",
    builder_color: BUILDER_COLOR_PALETTE[0],
    community: "",
    lot_number: "",
    job_type: humanizeValue(row.job_type) || "Job",
    job_address: formatAddress(row),
    scheduled_date: primaryEvent?.scheduled_date || "",
    scheduled_time: normalizeTimeValue(primaryEvent?.start_time),
    estimated_duration: 1,
    day_capacity_used: primaryEvent?.crew_id ? 1 : 0,
    crew_id: primaryEvent?.crew_id || "",
    work_order_number: row.purchase_order_number || primaryEvent?.work_order_number || "",
    status: getResidentialStatus(row, events),
    notes: primaryEvent?.notes || row.notes || row.description || "",
    last_reschedule_reason: primaryEvent?.last_reschedule_reason || "",
    created_from: "estimate",
    phases: [],
  };
}

function mapBuilderJob(row: DatabaseJobRow, events: DatabaseJobScheduleEventRow[], builders: JobBuilderReference[]): FrontendJob {
  const phases = buildBuilderPhases(events);
  const builderName = getBuilderName(row);
  const matchedBuilder = getMatchedBuilder(row, builderName, builders);
  const nextPhase = phases.find((phase) => !["Completed", "Cancelled"].includes(phase.status)) || phases[0];

  return {
    id: row.id,
    databaseId: row.id,
    customerDatabaseId: row.customer_id,
    scheduleEventDatabaseId: "",
    estimate_database_id: row.estimate_id || "",
    schedule_type: "builder_slab",
    name: row.job_name || builderName || "Builder Job",
    customer_name: "",
    sourceTicketId: "",
    builder_id: matchedBuilder?.id || "",
    builder_database_id: row.builder_id || matchedBuilder?.databaseId || "",
    builder_name: builderName,
    builder_color: getBuilderColor(builderName, builders),
    community: String(row.community || ""),
    lot_number: String(row.lot_number || ""),
    job_type: "Builder Slab",
    job_address: formatAddress(row),
    scheduled_date: nextPhase?.scheduled_date || "",
    scheduled_time: nextPhase?.scheduled_time || "",
    estimated_duration: phases.length || 1,
    day_capacity_used: nextPhase?.day_capacity_used || 1,
    crew_id: nextPhase?.crew_id || "",
    work_order_number: nextPhase?.work_order_number || "",
    status: getBuilderStatus(row, phases),
    notes: row.notes || row.description || "",
    last_reschedule_reason: nextPhase?.last_reschedule_reason || "",
    created_from: "builder",
    phases,
  };
}

export function databaseJobToFrontendJob(row: DatabaseJobRow, builders: JobBuilderReference[] = []) {
  const events = sortScheduleEvents(row.schedule_events || []);
  return isBuilderJob(row)
    ? mapBuilderJob(row, events, builders)
    : mapResidentialJob(row, events);
}

export function mapDatabaseJobsToFrontendJobs(rows: DatabaseJobRow[], builders: JobBuilderReference[] = []) {
  return sortFrontendJobs(rows.map((row) => databaseJobToFrontendJob(row, builders)));
}

export function sortFrontendJobs(jobs: FrontendJob[]) {
  return [...jobs].sort((first, second) => {
    const firstScheduled = !!first.scheduled_date;
    const secondScheduled = !!second.scheduled_date;

    if (firstScheduled !== secondScheduled) {
      return firstScheduled ? 1 : -1;
    }

    if (firstScheduled && secondScheduled) {
      const dateCompare = `${first.scheduled_date} ${first.scheduled_time}`.localeCompare(`${second.scheduled_date} ${second.scheduled_time}`);
      if (dateCompare !== 0) {
        return dateCompare;
      }
    }

    return first.name.localeCompare(second.name);
  });
}
