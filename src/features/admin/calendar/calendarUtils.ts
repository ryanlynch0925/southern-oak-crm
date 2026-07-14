import { BUILDER_COLOR_PALETTE, BUILDER_PHASES, sortBuilderPhases } from "../builders/builderUtils";
import type {
  CalendarEvent,
  CalendarUiStatus,
  DatabaseScheduleCustomerRow,
  DatabaseScheduleEventRow,
  DatabaseScheduleStatus,
  ScheduleCalendarJob,
  ScheduleCalendarPhase,
  ScheduleType,
} from "./calendarTypes";

const RESIDENTIAL_EVENT_COLOR = "#6C3483";

const BUILDER_PHASE_METADATA = new Map(
  [
    ...BUILDER_PHASES,
    { key: "underground_plumbing", label: "Underground Plumbing", responsible_party: "Plumber", counts_toward_crew: false },
    { key: "inspection", label: "Inspection", responsible_party: "Inspector", counts_toward_crew: false },
    { key: "slab_prep", label: "Slab Prep", responsible_party: "Southern Oak Concrete", counts_toward_crew: true },
    { key: "flatwork", label: "Flatwork", responsible_party: "Southern Oak Concrete", counts_toward_crew: true },
    { key: "other", label: "Other", responsible_party: "Other", counts_toward_crew: false },
    { key: "residential_job", label: "Scheduled Work", responsible_party: "Southern Oak Concrete", counts_toward_crew: true },
  ].map((phase) => [phase.key, phase])
);

function hashString(value: string) {
  return Array.from(value).reduce((total, char) => total + char.charCodeAt(0), 0);
}

function humanizeStep(step: string) {
  return step
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeTimeValue(value: string | null | undefined) {
  if (!value) {
    return "07:00";
  }

  return value.slice(0, 5);
}

function formatCustomerName(customer: DatabaseScheduleCustomerRow | null) {
  if (!customer) {
    return "";
  }

  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim();
  return fullName || customer.company_name || "";
}

function formatAddress(row: DatabaseScheduleEventRow) {
  const customer = row.job?.customer;
  const customerAddress = [customer?.street_address, customer?.city, customer?.state, customer?.zip_code]
    .filter(Boolean)
    .join(", ");

  return row.job?.job_address || customerAddress;
}

function getBuilderName(row: DatabaseScheduleEventRow) {
  const customer = row.job?.customer;
  return customer?.company_name || formatCustomerName(customer) || row.job?.job_name || "";
}

function getDisplayTitle(row: DatabaseScheduleEventRow, scheduleType: ScheduleType, phaseLabel: string) {
  if (scheduleType === "builder_slab") {
    return `${getBuilderName(row)} - ${phaseLabel}`;
  }

  return `${formatCustomerName(row.job?.customer || null) || row.job?.job_name || "Scheduled Job"} - ${row.job?.job_type || "Job"}`;
}

function isBuilderStep(step: string | null | undefined) {
  return !!step && step !== "residential_job";
}

export function databaseStatusToCalendarStatus(status: string | null | undefined): CalendarUiStatus {
  switch (status) {
    case "scheduled":
      return "Scheduled";
    case "in_progress":
      return "In Progress";
    case "completed":
      return "Completed";
    case "delayed":
      return "Delayed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Pending";
  }
}

export function calendarStatusToDatabaseStatus(status: string | null | undefined): DatabaseScheduleStatus {
  switch (status) {
    case "In Progress":
      return "in_progress";
    case "Completed":
      return "completed";
    case "Delayed":
      return "delayed";
    case "Cancelled":
      return "cancelled";
    case "Scheduled":
    case "Pending":
    default:
      return "scheduled";
  }
}

export function getScheduleTypeFromRow(row: DatabaseScheduleEventRow): ScheduleType {
  return isBuilderStep(row.builder_step) ? "builder_slab" : "residential";
}

export function getSchedulePhaseLabel(builderStep: string | null | undefined) {
  if (!builderStep) {
    return "Scheduled Work";
  }

  return BUILDER_PHASE_METADATA.get(builderStep)?.label || humanizeStep(builderStep);
}

export function getResponsibleParty(builderStep: string | null | undefined) {
  if (!builderStep) {
    return "Southern Oak Concrete";
  }

  return BUILDER_PHASE_METADATA.get(builderStep)?.responsible_party || "Southern Oak Concrete";
}

export function getCountsTowardCrew(builderStep: string | null | undefined, crewId: string | null | undefined) {
  if (!crewId) {
    return false;
  }

  if (!builderStep) {
    return true;
  }

  return BUILDER_PHASE_METADATA.get(builderStep)?.counts_toward_crew ?? true;
}

function getBuilderColor(builderName: string) {
  if (!builderName) {
    return BUILDER_COLOR_PALETTE[0];
  }

  return BUILDER_COLOR_PALETTE[hashString(builderName) % BUILDER_COLOR_PALETTE.length];
}

function getCalendarJobId(row: DatabaseScheduleEventRow) {
  return getScheduleTypeFromRow(row) === "builder_slab"
    ? row.job_id
    : `${row.job_id}:${row.id}`;
}

export function sortCalendarEvents(events: CalendarEvent[]) {
  return [...events].sort((first, second) => {
    const firstKey = `${first.date} ${first.time || ""}`;
    const secondKey = `${second.date} ${second.time || ""}`;
    return firstKey.localeCompare(secondKey) || first.title.localeCompare(second.title);
  });
}

export function sortScheduleRows(rows: DatabaseScheduleEventRow[]) {
  return [...rows].sort((first, second) => {
    const firstKey = `${first.scheduled_date} ${normalizeTimeValue(first.start_time)}`;
    const secondKey = `${second.scheduled_date} ${normalizeTimeValue(second.start_time)}`;
    return firstKey.localeCompare(secondKey) || first.id.localeCompare(second.id);
  });
}

export function databaseScheduleRowToCalendarEvent(row: DatabaseScheduleEventRow): CalendarEvent {
  const scheduleType = getScheduleTypeFromRow(row);
  const phaseLabel = scheduleType === "builder_slab"
    ? getSchedulePhaseLabel(row.builder_step)
    : "Scheduled Work";
  const builderName = scheduleType === "builder_slab" ? getBuilderName(row) : "";
  const customerName = scheduleType === "residential" ? (formatCustomerName(row.job?.customer || null) || row.job?.job_name || "") : "";
  const color = scheduleType === "builder_slab"
    ? getBuilderColor(builderName)
    : RESIDENTIAL_EVENT_COLOR;

  return {
    id: row.id,
    databaseId: row.id,
    jobId: getCalendarJobId(row),
    phaseId: scheduleType === "builder_slab" ? row.id : "",
    schedule_type: scheduleType,
    type_label: scheduleType === "builder_slab" ? "Builder" : "Residential",
    title: getDisplayTitle(row, scheduleType, phaseLabel),
    customer_name: customerName,
    builder_name: builderName,
    job_type: row.job?.job_type || "",
    address: formatAddress(row),
    community: "",
    lot_number: "",
    work_order_number: row.work_order_number || "",
    date: row.scheduled_date,
    time: normalizeTimeValue(row.start_time),
    end_time: row.end_time ? row.end_time.slice(0, 5) : "",
    crew_id: row.crew_id || "",
    crew_number: row.crew?.crew_number || "",
    capacity_used: getCountsTowardCrew(row.builder_step, row.crew_id) ? 1 : 0,
    counts_toward_crew: getCountsTowardCrew(row.builder_step, row.crew_id),
    status: databaseStatusToCalendarStatus(row.status),
    phase_label: phaseLabel,
    color,
    notes: row.notes || row.job?.notes || "",
  };
}

function buildResidentialCalendarJob(row: DatabaseScheduleEventRow): ScheduleCalendarJob {
  const customerName = formatCustomerName(row.job?.customer || null) || row.job?.job_name || "Scheduled Job";

  return {
    id: getCalendarJobId(row),
    databaseId: row.id,
    job_database_id: row.job_id,
    estimate_database_id: row.job?.estimate_id || "",
    schedule_type: "residential",
    name: customerName,
    customer_name: customerName,
    builder_name: "",
    builder_color: RESIDENTIAL_EVENT_COLOR,
    community: "",
    lot_number: "",
    job_type: row.job?.job_type || "",
    job_address: formatAddress(row),
    scheduled_date: row.scheduled_date,
    scheduled_time: normalizeTimeValue(row.start_time),
    estimated_duration: 1,
    day_capacity_used: 1,
    crew_id: row.crew_id || "",
    work_order_number: row.work_order_number || "",
    status: databaseStatusToCalendarStatus(row.status),
    notes: row.notes || row.job?.notes || "",
    phases: [],
  };
}

function buildBuilderPhase(row: DatabaseScheduleEventRow): ScheduleCalendarPhase {
  return {
    id: row.id,
    databaseId: row.id,
    phase_key: row.builder_step || "other",
    phase_label: getSchedulePhaseLabel(row.builder_step),
    responsible_party: getResponsibleParty(row.builder_step),
    counts_toward_crew: getCountsTowardCrew(row.builder_step, row.crew_id),
    scheduled_date: row.scheduled_date,
    scheduled_time: normalizeTimeValue(row.start_time),
    crew_id: row.crew_id || "",
    work_order_number: row.work_order_number || "",
    day_capacity_used: getCountsTowardCrew(row.builder_step, row.crew_id) ? 1 : 0,
    estimated_duration: 1,
    status: databaseStatusToCalendarStatus(row.status),
    notes: row.notes || "",
  };
}

function buildBuilderCalendarJob(rows: DatabaseScheduleEventRow[]): ScheduleCalendarJob {
  const sortedRows = sortScheduleRows(rows);
  const firstRow = sortedRows[0];
  const phases = sortBuilderPhases(sortedRows.map(buildBuilderPhase));
  const builderName = getBuilderName(firstRow);
  const nextPhase = phases.find((phase) => !["Completed", "Cancelled"].includes(phase.status)) || phases[0];

  return {
    id: firstRow.job_id,
    databaseId: firstRow.job_id,
    job_database_id: firstRow.job_id,
    estimate_database_id: firstRow.job?.estimate_id || "",
    schedule_type: "builder_slab",
    name: firstRow.job?.job_name || builderName || "Builder Job",
    customer_name: "",
    builder_name: builderName,
    builder_color: getBuilderColor(builderName),
    community: "",
    lot_number: "",
    job_type: firstRow.job?.job_type || "",
    job_address: formatAddress(firstRow),
    scheduled_date: nextPhase?.scheduled_date || firstRow.scheduled_date,
    scheduled_time: nextPhase?.scheduled_time || normalizeTimeValue(firstRow.start_time),
    estimated_duration: phases.length || 1,
    day_capacity_used: nextPhase?.day_capacity_used || 1,
    crew_id: nextPhase?.crew_id || firstRow.crew_id || "",
    work_order_number: firstRow.work_order_number || "",
    status: nextPhase?.status || databaseStatusToCalendarStatus(firstRow.status),
    notes: firstRow.notes || firstRow.job?.notes || "",
    phases,
  };
}

export function buildScheduleCalendarJobs(rows: DatabaseScheduleEventRow[]) {
  const builderGroups = new Map<string, DatabaseScheduleEventRow[]>();
  const jobs: ScheduleCalendarJob[] = [];

  sortScheduleRows(rows).forEach((row) => {
    if (getScheduleTypeFromRow(row) === "builder_slab") {
      const existingRows = builderGroups.get(row.job_id) || [];
      builderGroups.set(row.job_id, [...existingRows, row]);
      return;
    }

    jobs.push(buildResidentialCalendarJob(row));
  });

  builderGroups.forEach((groupRows) => {
    jobs.push(buildBuilderCalendarJob(groupRows));
  });

  return [...jobs].sort((first, second) => {
    const firstKey = `${first.scheduled_date} ${first.scheduled_time || ""}`;
    const secondKey = `${second.scheduled_date} ${second.scheduled_time || ""}`;
    return firstKey.localeCompare(secondKey) || first.name.localeCompare(second.name);
  });
}
