import { BUILDER_COLOR_PALETTE, BUILDER_PHASES, BUILDER_SLAB_WORKFLOW, sortBuilderPhases } from "../builders/builderUtils";
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

function getSiteVisitCapacityUsed(row: DatabaseScheduleEventRow) {
  const startValue = normalizeTimeValue(row.start_time);
  const endValue = row.end_time ? row.end_time.slice(0, 5) : "";

  if (!endValue) {
    return 0.25;
  }

  const startHours = Number(startValue.slice(0, 2));
  const startMinutes = Number(startValue.slice(3, 5));
  const endHours = Number(endValue.slice(0, 2));
  const endMinutes = Number(endValue.slice(3, 5));
  const durationHours = ((endHours * 60) + endMinutes - ((startHours * 60) + startMinutes)) / 60;

  if (!Number.isFinite(durationHours) || durationHours <= 0) {
    return 0.25;
  }

  return Math.min(Math.max(Number((durationHours / 8).toFixed(2)), 0.25), 1);
}

function formatCustomerName(customer: DatabaseScheduleCustomerRow | null) {
  if (!customer) {
    return "";
  }

  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim();
  return fullName || customer.company_name || "";
}

function formatAddress(row: DatabaseScheduleEventRow) {
  const customer = row.job?.customer || row.estimate?.customer || null;
  const customerAddress = [customer?.street_address, customer?.city, customer?.state, customer?.zip_code]
    .filter(Boolean)
    .join(", ");

  return row.job?.job_address || row.estimate?.job_address || customerAddress;
}

function getBuilderName(row: DatabaseScheduleEventRow) {
  const customer = row.job?.customer;
  return customer?.company_name || formatCustomerName(customer) || row.job?.job_name || "";
}

function getDisplayTitle(row: DatabaseScheduleEventRow, scheduleType: ScheduleType, phaseLabel: string) {
  if (scheduleType === "builder_slab") {
    return `${getBuilderName(row)} - ${phaseLabel}`;
  }

  if (scheduleType === "site_visit") {
    return `Site Visit - ${formatCustomerName(row.estimate?.customer || null) || "Estimate"}`;
  }

  return `${formatCustomerName(row.job?.customer || null) || row.job?.job_name || "Scheduled Job"} - ${row.job?.job_type || "Job"}`;
}

function isBuilderStep(step: string | null | undefined) {
  return !!step && step !== "residential_job" && step !== "site_visit";
}

export function toUiBuilderPhaseKey(builderStep: string | null | undefined) {
  if (!builderStep) {
    return "";
  }

  return builderStep === "slab_prep" ? "prep_slab" : builderStep;
}

export function toDatabaseBuilderStep(phaseKey: string | null | undefined) {
  if (!phaseKey) {
    return null;
  }

  const normalizedPhaseKey = phaseKey.trim().toLowerCase();
  return normalizedPhaseKey === "prep_slab" ? "slab_prep" : normalizedPhaseKey;
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
  if (row.builder_step === "site_visit" || (row.estimate_id && !row.job_id)) {
    return "site_visit";
  }

  return isBuilderStep(row.builder_step) ? "builder_slab" : "residential";
}

export function getSchedulePhaseLabel(builderStep: string | null | undefined) {
  if (builderStep === "site_visit") {
    return "Site Visit";
  }

  const normalizedBuilderStep = toUiBuilderPhaseKey(builderStep);

  if (!normalizedBuilderStep) {
    return "Scheduled Work";
  }

  return BUILDER_PHASE_METADATA.get(normalizedBuilderStep)?.label || humanizeStep(normalizedBuilderStep);
}

export function getResponsibleParty(builderStep: string | null | undefined) {
  const normalizedBuilderStep = toUiBuilderPhaseKey(builderStep);

  if (!normalizedBuilderStep) {
    return "Southern Oak Concrete";
  }

  return BUILDER_PHASE_METADATA.get(normalizedBuilderStep)?.responsible_party || "Southern Oak Concrete";
}

export function getCountsTowardCrew(builderStep: string | null | undefined, crewId: string | null | undefined) {
  if (!crewId) {
    return false;
  }

  const normalizedBuilderStep = toUiBuilderPhaseKey(builderStep);

  if (!normalizedBuilderStep) {
    return true;
  }

  return BUILDER_PHASE_METADATA.get(normalizedBuilderStep)?.counts_toward_crew ?? true;
}

function getBuilderColor(builderName: string) {
  if (!builderName) {
    return BUILDER_COLOR_PALETTE[0];
  }

  return BUILDER_COLOR_PALETTE[hashString(builderName) % BUILDER_COLOR_PALETTE.length];
}

function getCalendarJobId(row: DatabaseScheduleEventRow) {
  if (getScheduleTypeFromRow(row) === "site_visit") {
    return row.estimate_id ? `site_visit:${row.estimate_id}` : `site_visit:${row.id}`;
  }

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
    : scheduleType === "site_visit"
      ? "Site Visit"
      : "Scheduled Work";
  const builderName = scheduleType === "builder_slab" ? getBuilderName(row) : "";
  const customerName = scheduleType === "residential"
    ? (formatCustomerName(row.job?.customer || null) || row.job?.job_name || "")
    : scheduleType === "site_visit"
      ? formatCustomerName(row.estimate?.customer || null)
      : "";
  const color = scheduleType === "builder_slab"
    ? getBuilderColor(builderName)
    : RESIDENTIAL_EVENT_COLOR;

  return {
    id: row.id,
    databaseId: row.id,
    jobId: getCalendarJobId(row),
    estimate_database_id: row.estimate_id || row.job?.estimate_id || "",
    phaseId: scheduleType === "builder_slab" ? row.id : "",
    schedule_type: scheduleType,
    type_label: scheduleType === "builder_slab" ? "Builder" : scheduleType === "site_visit" ? "Site Visit" : "Residential",
    title: getDisplayTitle(row, scheduleType, phaseLabel),
    customer_name: customerName,
    builder_name: builderName,
    job_type: scheduleType === "site_visit" ? (row.estimate?.job_type || "Site Visit") : (row.job?.job_type || ""),
    address: formatAddress(row),
    community: row.job?.community || "",
    lot_number: row.job?.lot_number || "",
    work_order_number: scheduleType === "residential"
      ? (row.job?.purchase_order_number || row.work_order_number || "")
      : (row.work_order_number || ""),
    date: row.scheduled_date,
    time: normalizeTimeValue(row.start_time),
    end_time: row.end_time ? row.end_time.slice(0, 5) : "",
    crew_id: row.crew_id || "",
    crew_number: row.crew?.crew_number || "",
    capacity_used: scheduleType === "site_visit"
      ? getSiteVisitCapacityUsed(row)
      : getCountsTowardCrew(row.builder_step, row.crew_id) ? 1 : 0,
    counts_toward_crew: getCountsTowardCrew(row.builder_step, row.crew_id),
    status: databaseStatusToCalendarStatus(row.status),
    phase_label: phaseLabel,
    color,
    notes: row.notes || row.job?.notes || row.estimate?.description || "",
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
    community: row.job?.community || "",
    lot_number: row.job?.lot_number || "",
    job_type: row.job?.job_type || "",
    job_address: formatAddress(row),
    scheduled_date: row.scheduled_date,
    scheduled_time: normalizeTimeValue(row.start_time),
    estimated_duration: 1,
    day_capacity_used: 1,
    crew_id: row.crew_id || "",
    work_order_number: row.job?.purchase_order_number || row.work_order_number || "",
    status: databaseStatusToCalendarStatus(row.status),
    notes: row.notes || row.job?.notes || "",
    last_reschedule_reason: row.last_reschedule_reason || "",
    last_rescheduled_at: row.last_rescheduled_at || "",
    last_rescheduled_by: row.last_rescheduled_by || "",
    phases: [],
  };
}

function buildBuilderPlaceholderPhase(jobId: string, workflowPhase: typeof BUILDER_SLAB_WORKFLOW[number]): ScheduleCalendarPhase {
  return {
    id: `${jobId}:${workflowPhase.uiKey}:placeholder`,
    databaseId: "",
    phase_key: workflowPhase.uiKey,
    phase_label: workflowPhase.label,
    responsible_party: workflowPhase.responsible_party,
    counts_toward_crew: workflowPhase.counts_toward_crew,
    scheduled_date: "",
    scheduled_time: "",
    end_time: "",
    crew_id: "",
    work_order_number: "",
    day_capacity_used: 0,
    estimated_duration: 1,
    status: "Ready to Schedule",
    notes: "",
    last_reschedule_reason: "",
    last_rescheduled_at: "",
    last_rescheduled_by: "",
  };
}

function buildBuilderPhase(row: DatabaseScheduleEventRow): ScheduleCalendarPhase {
  const phaseKey = toUiBuilderPhaseKey(row.builder_step) || "other";

  return {
    id: row.id,
    databaseId: row.id,
    scheduleEventDatabaseId: row.id,
    phase_key: phaseKey,
    phase_label: getSchedulePhaseLabel(phaseKey),
    responsible_party: getResponsibleParty(phaseKey),
    counts_toward_crew: getCountsTowardCrew(phaseKey, row.crew_id),
    scheduled_date: row.scheduled_date,
    scheduled_time: normalizeTimeValue(row.start_time),
    end_time: row.end_time ? row.end_time.slice(0, 5) : "",
    crew_id: row.crew_id || "",
    work_order_number: row.work_order_number || "",
    day_capacity_used: getCountsTowardCrew(phaseKey, row.crew_id) ? 1 : 0,
    estimated_duration: 1,
    status: databaseStatusToCalendarStatus(row.status),
    notes: row.notes || "",
    last_reschedule_reason: row.last_reschedule_reason || "",
    last_rescheduled_at: row.last_rescheduled_at || "",
    last_rescheduled_by: row.last_rescheduled_by || "",
  };
}

function buildBuilderCalendarJob(rows: DatabaseScheduleEventRow[]): ScheduleCalendarJob {
  const sortedRows = sortScheduleRows(rows);
  const firstRow = sortedRows[0];
  const persistedPhases = sortBuilderPhases(sortedRows.map(buildBuilderPhase));
  const persistedPhaseMap = new Map(
    persistedPhases.map((phase) => [toUiBuilderPhaseKey(phase.phase_key) || phase.phase_key, phase])
  );
  const standardPhases = BUILDER_SLAB_WORKFLOW.map((workflowPhase) =>
    persistedPhaseMap.get(workflowPhase.uiKey) || buildBuilderPlaceholderPhase(firstRow.job_id, workflowPhase)
  );
  const extraPhases = persistedPhases.filter((phase) =>
    !BUILDER_SLAB_WORKFLOW.some((workflowPhase) => workflowPhase.uiKey === (toUiBuilderPhaseKey(phase.phase_key) || phase.phase_key))
  );
  const phases = sortBuilderPhases([...standardPhases, ...extraPhases]);
  const builderName = getBuilderName(firstRow);
  const nextPhase = phases.find((phase) => phase.scheduled_date && !["Completed", "Cancelled"].includes(phase.status))
    || phases.find((phase) => phase.scheduled_date)
    || phases[0];

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
    community: firstRow.job?.community || "",
    lot_number: firstRow.job?.lot_number || "",
    job_type: firstRow.job?.job_type || "",
    job_address: formatAddress(firstRow),
    scheduled_date: nextPhase?.scheduled_date || firstRow.scheduled_date,
    scheduled_time: nextPhase?.scheduled_time || normalizeTimeValue(firstRow.start_time),
    estimated_duration: phases.length || 1,
    day_capacity_used: nextPhase?.day_capacity_used || 1,
    crew_id: nextPhase?.crew_id || firstRow.crew_id || "",
    work_order_number: nextPhase?.work_order_number || "",
    status: nextPhase?.status || databaseStatusToCalendarStatus(firstRow.status),
    notes: firstRow.notes || firstRow.job?.notes || "",
    last_reschedule_reason: nextPhase?.last_reschedule_reason || "",
    last_rescheduled_at: nextPhase?.last_rescheduled_at || "",
    last_rescheduled_by: nextPhase?.last_rescheduled_by || "",
    phases,
  };
}

export function buildScheduleCalendarJobs(rows: DatabaseScheduleEventRow[]) {
  const builderGroups = new Map<string, DatabaseScheduleEventRow[]>();
  const jobs: ScheduleCalendarJob[] = [];

  sortScheduleRows(rows).forEach((row) => {
    if (getScheduleTypeFromRow(row) === "site_visit") {
      return;
    }

    if (getScheduleTypeFromRow(row) === "builder_slab") {
      const groupKey = row.job_id || row.id;
      const existingRows = builderGroups.get(groupKey) || [];
      builderGroups.set(groupKey, [...existingRows, row]);
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
