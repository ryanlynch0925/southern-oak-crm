import { supabase } from "../../../lib/supabase";
import type {
  ActualProjectDetails,
  ActualProjectDetailsJson,
  ActualProjectDetailsObject,
  ActualProjectMeasuredSection,
  UpsertActualProjectDetailsInput,
} from "./actualProjectDetailsTypes";

type ActualProjectDetailsErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "UNKNOWN";

const ACTUAL_PROJECT_DETAILS_SELECT = `
  id,
  estimate_id,
  project_type,
  measured_sections,
  actual_thickness_in,
  tear_out_required,
  tear_out_quantity,
  tear_out_unit,
  grading_required,
  grading_notes,
  reinforcement_type,
  reinforcement_notes,
  finish_type,
  finish_notes,
  pump_required,
  equipment_notes,
  access_condition,
  access_notes,
  site_preparation_notes,
  estimator_notes,
  project_details,
  created_at,
  updated_at,
  created_by,
  updated_by
`;

const ACTUAL_PROJECT_DETAILS_ERROR_PREFIXES: Record<string, ActualProjectDetailsErrorCode> = {
  ACTUAL_PROJECT_DETAILS_FORBIDDEN: "FORBIDDEN",
  ACTUAL_PROJECT_DETAILS_NOT_FOUND: "NOT_FOUND",
  ACTUAL_PROJECT_DETAILS_VALIDATION: "VALIDATION",
};

interface DatabaseActualProjectDetailsRecord {
  id: unknown;
  estimate_id: unknown;
  project_type: unknown;
  measured_sections: unknown;
  actual_thickness_in: unknown;
  tear_out_required: unknown;
  tear_out_quantity: unknown;
  tear_out_unit: unknown;
  grading_required: unknown;
  grading_notes: unknown;
  reinforcement_type: unknown;
  reinforcement_notes: unknown;
  finish_type: unknown;
  finish_notes: unknown;
  pump_required: unknown;
  equipment_notes: unknown;
  access_condition: unknown;
  access_notes: unknown;
  site_preparation_notes: unknown;
  estimator_notes: unknown;
  project_details: unknown;
  created_at: unknown;
  updated_at: unknown;
  created_by: unknown;
  updated_by: unknown;
}

export class ActualProjectDetailsServiceError extends Error {
  code: ActualProjectDetailsErrorCode;

  constructor(message: string, code: ActualProjectDetailsErrorCode = "UNKNOWN") {
    super(message);
    this.name = "ActualProjectDetailsServiceError";
    this.code = code;
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (
    typeof error === "object"
    && error !== null
    && "message" in error
    && typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Actual project details request failed.";
}

function unwrapRpcError(error: unknown) {
  const message = getErrorMessage(error);

  for (const [prefix, code] of Object.entries(ACTUAL_PROJECT_DETAILS_ERROR_PREFIXES)) {
    const marker = `${prefix}:`;
    const markerIndex = message.indexOf(marker);

    if (markerIndex >= 0) {
      const detail = message.slice(markerIndex + marker.length);
      return new ActualProjectDetailsServiceError(
        detail.trim() || message.trim() || "Actual project details request failed.",
        code
      );
    }
  }

  return new ActualProjectDetailsServiceError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function readNullableNumber(value: unknown) {
  if (value == null || value === "") {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function readNullableBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function isJsonObject(value: unknown): value is ActualProjectDetailsObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toJsonValue(value: unknown): ActualProjectDetailsJson {
  if (
    value == null
    || typeof value === "string"
    || typeof value === "number"
    || typeof value === "boolean"
  ) {
    return value as ActualProjectDetailsJson;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonValue(item));
  }

  if (isRecord(value)) {
    const nextValue: ActualProjectDetailsObject = {};

    Object.entries(value).forEach(([key, item]) => {
      nextValue[key] = toJsonValue(item);
    });

    return nextValue;
  }

  return null;
}

function normalizeProjectDetailsObject(value: unknown): ActualProjectDetailsObject {
  if (!isRecord(value)) {
    return {};
  }

  const projectDetails: ActualProjectDetailsObject = {};

  Object.entries(value).forEach(([key, item]) => {
    projectDetails[key] = toJsonValue(item);
  });

  return projectDetails;
}

function normalizeMeasuredSection(value: unknown): ActualProjectMeasuredSection {
  const record = isRecord(value) ? value : {};

  return {
    label: readString(record.label),
    lengthFt: readNullableNumber(record.length_ft),
    widthFt: readNullableNumber(record.width_ft),
    squareFeet: readNullableNumber(record.square_feet),
    thicknessIn: readNullableNumber(record.thickness_in),
    linearFeet: readNullableNumber(record.linear_feet),
    quantity: readNullableNumber(record.quantity),
    notes: readString(record.notes),
  };
}

function mapActualProjectDetailsRecord(
  record: DatabaseActualProjectDetailsRecord
): ActualProjectDetails {
  const measuredSections = Array.isArray(record.measured_sections)
    ? record.measured_sections.map((section) => normalizeMeasuredSection(section))
    : [];

  return {
    id: readString(record.id),
    estimateId: readString(record.estimate_id),
    projectType: readString(record.project_type),
    measuredSections,
    actualThicknessIn: readNullableNumber(record.actual_thickness_in),
    tearOutRequired: readNullableBoolean(record.tear_out_required),
    tearOutQuantity: readNullableNumber(record.tear_out_quantity),
    tearOutUnit: readString(record.tear_out_unit),
    gradingRequired: readNullableBoolean(record.grading_required),
    gradingNotes: readString(record.grading_notes),
    reinforcementType: readString(record.reinforcement_type),
    reinforcementNotes: readString(record.reinforcement_notes),
    finishType: readString(record.finish_type),
    finishNotes: readString(record.finish_notes),
    pumpRequired: readNullableBoolean(record.pump_required),
    equipmentNotes: readString(record.equipment_notes),
    accessCondition: readString(record.access_condition),
    accessNotes: readString(record.access_notes),
    sitePreparationNotes: readString(record.site_preparation_notes),
    estimatorNotes: readString(record.estimator_notes),
    projectDetails: normalizeProjectDetailsObject(record.project_details),
    createdAt: readString(record.created_at),
    updatedAt: readString(record.updated_at),
    createdBy: readNullableString(record.created_by),
    updatedBy: readNullableString(record.updated_by),
  };
}

function serializeMeasuredSection(section: ActualProjectMeasuredSection) {
  const payload: Record<string, unknown> = {};
  const label = section.label.trim();
  const notes = section.notes.trim();

  if (label) {
    payload.label = label;
  }

  if (section.lengthFt != null) {
    payload.length_ft = section.lengthFt;
  }

  if (section.widthFt != null) {
    payload.width_ft = section.widthFt;
  }

  if (section.squareFeet != null) {
    payload.square_feet = section.squareFeet;
  }

  if (section.thicknessIn != null) {
    payload.thickness_in = section.thicknessIn;
  }

  if (section.linearFeet != null) {
    payload.linear_feet = section.linearFeet;
  }

  if (section.quantity != null) {
    payload.quantity = section.quantity;
  }

  if (notes) {
    payload.notes = notes;
  }

  return payload;
}

function buildUpsertPayload(input: UpsertActualProjectDetailsInput) {
  return {
    project_type: input.projectType.trim(),
    measured_sections: input.measuredSections.map((section) => serializeMeasuredSection(section)),
    actual_thickness_in: input.actualThicknessIn,
    tear_out_required: input.tearOutRequired,
    tear_out_quantity: input.tearOutQuantity,
    tear_out_unit: input.tearOutUnit.trim(),
    grading_required: input.gradingRequired,
    grading_notes: input.gradingNotes.trim(),
    reinforcement_type: input.reinforcementType.trim(),
    reinforcement_notes: input.reinforcementNotes.trim(),
    finish_type: input.finishType.trim(),
    finish_notes: input.finishNotes.trim(),
    pump_required: input.pumpRequired,
    equipment_notes: input.equipmentNotes.trim(),
    access_condition: input.accessCondition.trim(),
    access_notes: input.accessNotes.trim(),
    site_preparation_notes: input.sitePreparationNotes.trim(),
    estimator_notes: input.estimatorNotes.trim(),
    project_details: normalizeProjectDetailsObject(input.projectDetails),
  };
}

export async function fetchEstimateActualProjectDetails(estimateId: string) {
  const { data, error } = await supabase
    .from("estimate_actual_project_details")
    .select(ACTUAL_PROJECT_DETAILS_SELECT)
    .eq("estimate_id", estimateId)
    .maybeSingle();

  if (error) {
    throw new ActualProjectDetailsServiceError(
      getErrorMessage(error)
    );
  }

  if (!data) {
    return null;
  }

  return mapActualProjectDetailsRecord(data as DatabaseActualProjectDetailsRecord);
}

export async function upsertEstimateActualProjectDetails(
  estimateId: string,
  input: UpsertActualProjectDetailsInput
) {
  const { data, error } = await supabase.rpc("upsert_estimate_actual_project_details", {
    p_estimate_id: estimateId,
    p_payload: buildUpsertPayload(input),
  });

  if (error) {
    throw unwrapRpcError(error);
  }

  if (!isRecord(data)) {
    throw new ActualProjectDetailsServiceError(
      "The actual project details save response was incomplete."
    );
  }

  return mapActualProjectDetailsRecord(data as DatabaseActualProjectDetailsRecord);
}
