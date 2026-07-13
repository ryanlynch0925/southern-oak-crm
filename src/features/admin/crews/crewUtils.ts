import { BUILDER_COLOR_PALETTE, sortBuilderPhases } from "../builders/builderUtils";
import { normalizeCrew } from "./crewMappers";

const RESIDENTIAL_EVENT_COLOR = "#6C3483";

export const getNextCrewNumber = crews => {
  const used = new Set(crews.map(crew => Number(crew.crewNumber ?? crew.number)).filter(Boolean));
  let next = 1;
  while (used.has(next)) next += 1;
  return next;
};

export const buildNewCrewDraft = crews => {
  const nextNumber = getNextCrewNumber(crews);
  return normalizeCrew({
    id: undefined,
    crewNumber: nextNumber,
    name: `Crew ${nextNumber}`,
    foreman: "",
    description: "",
    dailyCapacity: 1,
    phone: "",
    status: "active",
  }, crews.length);
};

export function findCrewById(crews, id) {
  return crews.find(crew => crew.id === id);
}

export function getCrewNumber(crew) {
  return Number(crew?.crewNumber ?? crew?.number ?? 0);
}

export const getCrewStatusMeta = (todayLoad, dailyCapacity) => {
  if (todayLoad > dailyCapacity + 0.0001) return { label: "Overbooked", tone: "overbooked" };
  if (todayLoad > 0.0001) return { label: "Scheduled", tone: "scheduled" };
  return { label: "Available", tone: "available" };
};

export const getCrewProgressTone = (todayLoad, dailyCapacity) => {
  const safeCapacity = Number(dailyCapacity || 0);
  if (safeCapacity <= 0) return "overbooked";
  const ratio = todayLoad / safeCapacity;
  if (ratio > 1) return "overbooked";
  if (ratio >= 0.8) return "near";
  return "good";
};

const clampDateValue = d => new Date(`${d}T12:00:00`);
const isSaturday = d => clampDateValue(d).getDay() === 6;
const isSunday = d => clampDateValue(d).getDay() === 0;
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

export function buildResidentialEvents(job) {
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

export function buildBuilderEvents(job) {
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

export function buildCalendarEvents(jobs) {
  return jobs.flatMap(job => job.schedule_type === "builder_slab" ? buildBuilderEvents(job) : buildResidentialEvents(job));
}
