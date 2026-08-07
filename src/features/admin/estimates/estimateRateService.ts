import { supabase } from "../../../lib/supabase";
import type {
  CreateEstimateRateSetInput,
  EstimateRateItem,
  EstimateRateMetadata,
  EstimateRateMetadataValue,
  EstimateRatePricingMethod,
  EstimateRateSet,
  EstimateRateSetStatus,
  EstimateRateSetWithItems,
  UpsertEstimateRateItemInput,
} from "./estimateRateTypes";

type EstimateRateServiceErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "UNKNOWN";

const ESTIMATE_RATE_SET_SELECT = `
  id,
  name,
  version_number,
  status,
  effective_from,
  effective_to,
  notes,
  created_at,
  updated_at,
  created_by,
  updated_by
`;

const ESTIMATE_RATE_SET_WITH_ITEMS_SELECT = `
  id,
  name,
  version_number,
  status,
  effective_from,
  effective_to,
  notes,
  created_at,
  updated_at,
  created_by,
  updated_by,
  items:estimate_rate_items (
    id,
    rate_set_id,
    rate_key,
    label,
    category,
    project_type,
    pricing_method,
    unit,
    rate_amount,
    minimum_charge,
    description,
    sort_order,
    metadata,
    created_at,
    updated_at
  )
`;

const ESTIMATE_RATE_ERROR_PREFIXES: Record<string, EstimateRateServiceErrorCode> = {
  ESTIMATE_RATE_SET_FORBIDDEN: "FORBIDDEN",
  ESTIMATE_RATE_SET_NOT_FOUND: "NOT_FOUND",
  ESTIMATE_RATE_SET_VALIDATION: "VALIDATION",
  ESTIMATE_RATE_ITEM_FORBIDDEN: "FORBIDDEN",
  ESTIMATE_RATE_ITEM_NOT_FOUND: "NOT_FOUND",
  ESTIMATE_RATE_ITEM_VALIDATION: "VALIDATION",
};

interface DatabaseEstimateRateSetRecord {
  id: unknown;
  name: unknown;
  version_number: unknown;
  status: unknown;
  effective_from: unknown;
  effective_to: unknown;
  notes: unknown;
  created_at: unknown;
  updated_at: unknown;
  created_by: unknown;
  updated_by: unknown;
}

interface DatabaseEstimateRateItemRecord {
  id: unknown;
  rate_set_id: unknown;
  rate_key: unknown;
  label: unknown;
  category: unknown;
  project_type: unknown;
  pricing_method: unknown;
  unit: unknown;
  rate_amount: unknown;
  minimum_charge: unknown;
  description: unknown;
  sort_order: unknown;
  metadata: unknown;
  created_at: unknown;
  updated_at: unknown;
}

interface DatabaseEstimateRateSetWithItemsRecord extends DatabaseEstimateRateSetRecord {
  items?: DatabaseEstimateRateItemRecord[] | null;
}

export class EstimateRateServiceError extends Error {
  code: EstimateRateServiceErrorCode;

  constructor(message: string, code: EstimateRateServiceErrorCode = "UNKNOWN") {
    super(message);
    this.name = "EstimateRateServiceError";
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

  return "Estimate rate request failed.";
}

function unwrapRpcError(error: unknown) {
  const message = getErrorMessage(error);

  for (const [prefix, code] of Object.entries(ESTIMATE_RATE_ERROR_PREFIXES)) {
    const marker = `${prefix}:`;
    const markerIndex = message.indexOf(marker);

    if (markerIndex >= 0) {
      const detail = message.slice(markerIndex + marker.length);
      return new EstimateRateServiceError(
        detail.trim() || message.trim() || "Estimate rate request failed.",
        code
      );
    }
  }

  return new EstimateRateServiceError(message);
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

function readNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeRateSetStatus(value: unknown): EstimateRateSetStatus {
  if (value === "draft" || value === "active" || value === "retired") {
    return value;
  }

  return "draft";
}

function normalizePricingMethod(value: unknown): EstimateRatePricingMethod {
  if (value === "per_unit" || value === "flat" || value === "percentage") {
    return value;
  }

  return "flat";
}

function toMetadataValue(value: unknown): EstimateRateMetadataValue {
  if (
    value == null
    || typeof value === "string"
    || typeof value === "number"
    || typeof value === "boolean"
  ) {
    return value as EstimateRateMetadataValue;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toMetadataValue(item));
  }

  if (isRecord(value)) {
    const nextValue: EstimateRateMetadata = {};

    Object.entries(value).forEach(([key, item]) => {
      nextValue[key] = toMetadataValue(item);
    });

    return nextValue;
  }

  return null;
}

function normalizeMetadata(value: unknown): EstimateRateMetadata {
  if (!isRecord(value)) {
    return {};
  }

  const metadata: EstimateRateMetadata = {};

  Object.entries(value).forEach(([key, item]) => {
    metadata[key] = toMetadataValue(item);
  });

  return metadata;
}

function mapEstimateRateSet(record: DatabaseEstimateRateSetRecord): EstimateRateSet {
  return {
    id: readString(record.id),
    name: readString(record.name),
    versionNumber: readNumber(record.version_number),
    status: normalizeRateSetStatus(record.status),
    effectiveFrom: readString(record.effective_from),
    effectiveTo: readString(record.effective_to),
    notes: readString(record.notes),
    createdAt: readString(record.created_at),
    updatedAt: readString(record.updated_at),
    createdBy: readNullableString(record.created_by),
    updatedBy: readNullableString(record.updated_by),
  };
}

function mapEstimateRateItem(record: DatabaseEstimateRateItemRecord): EstimateRateItem {
  return {
    id: readString(record.id),
    rateSetId: readString(record.rate_set_id),
    rateKey: readString(record.rate_key),
    label: readString(record.label),
    category: readString(record.category),
    projectType: readString(record.project_type),
    pricingMethod: normalizePricingMethod(record.pricing_method),
    unit: readString(record.unit),
    rateAmount: readNumber(record.rate_amount),
    minimumCharge: readNullableNumber(record.minimum_charge),
    description: readString(record.description),
    sortOrder: readNumber(record.sort_order),
    metadata: normalizeMetadata(record.metadata),
    createdAt: readString(record.created_at),
    updatedAt: readString(record.updated_at),
  };
}

function mapEstimateRateSetWithItems(
  record: DatabaseEstimateRateSetWithItemsRecord
): EstimateRateSetWithItems {
  return {
    ...mapEstimateRateSet(record),
    items: Array.isArray(record.items)
      ? record.items.map((item) => mapEstimateRateItem(item))
      : [],
  };
}

function serializeRateSetPayload(input: CreateEstimateRateSetInput) {
  return {
    name: input.name.trim(),
    version_number: String(input.versionNumber),
    effective_from: input.effectiveFrom.trim(),
    effective_to: input.effectiveTo.trim(),
    notes: input.notes.trim(),
  };
}

function serializeRateItemPayload(input: UpsertEstimateRateItemInput) {
  return {
    rate_key: input.rateKey.trim(),
    label: input.label.trim(),
    category: input.category.trim(),
    project_type: input.projectType.trim(),
    pricing_method: input.pricingMethod,
    unit: input.unit.trim(),
    rate_amount: input.rateAmount.toFixed(4),
    minimum_charge: input.minimumCharge == null ? "" : input.minimumCharge.toFixed(2),
    description: input.description.trim(),
    sort_order: String(input.sortOrder),
    metadata: normalizeMetadata(input.metadata),
  };
}

export async function fetchEstimateRateSets() {
  const { data, error } = await supabase
    .from("estimate_rate_sets")
    .select(ESTIMATE_RATE_SET_SELECT)
    .order("status", { ascending: true })
    .order("name", { ascending: true })
    .order("version_number", { ascending: false });

  if (error) {
    throw new EstimateRateServiceError(getErrorMessage(error));
  }

  return (data || []).map((record) => mapEstimateRateSet(record as DatabaseEstimateRateSetRecord));
}

export async function fetchEstimateRateSetById(rateSetId: string) {
  const { data, error } = await supabase
    .from("estimate_rate_sets")
    .select(ESTIMATE_RATE_SET_WITH_ITEMS_SELECT)
    .eq("id", rateSetId)
    .single();

  if (error) {
    throw new EstimateRateServiceError(getErrorMessage(error));
  }

  return mapEstimateRateSetWithItems(data as DatabaseEstimateRateSetWithItemsRecord);
}

export async function fetchActiveEstimateRateSet() {
  const { data, error } = await supabase
    .from("estimate_rate_sets")
    .select(ESTIMATE_RATE_SET_WITH_ITEMS_SELECT)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new EstimateRateServiceError(getErrorMessage(error));
  }

  if (!data) {
    return null;
  }

  return mapEstimateRateSetWithItems(data as DatabaseEstimateRateSetWithItemsRecord);
}

export async function createEstimateRateSet(input: CreateEstimateRateSetInput) {
  const { data, error } = await supabase.rpc("upsert_estimate_rate_set", {
    p_rate_set_id: null,
    p_payload: serializeRateSetPayload(input),
  });

  if (error) {
    throw unwrapRpcError(error);
  }

  if (!isRecord(data)) {
    throw new EstimateRateServiceError("The estimate rate set create response was incomplete.");
  }

  return mapEstimateRateSet(data as DatabaseEstimateRateSetRecord);
}

export async function updateEstimateRateSet(
  rateSetId: string,
  input: CreateEstimateRateSetInput
) {
  const { data, error } = await supabase.rpc("upsert_estimate_rate_set", {
    p_rate_set_id: rateSetId,
    p_payload: serializeRateSetPayload(input),
  });

  if (error) {
    throw unwrapRpcError(error);
  }

  if (!isRecord(data)) {
    throw new EstimateRateServiceError("The estimate rate set update response was incomplete.");
  }

  return mapEstimateRateSet(data as DatabaseEstimateRateSetRecord);
}

export async function upsertEstimateRateItem(
  rateSetId: string,
  input: UpsertEstimateRateItemInput
) {
  const { data, error } = await supabase.rpc("upsert_estimate_rate_item", {
    p_rate_set_id: rateSetId,
    p_rate_item_id: input.id || null,
    p_payload: serializeRateItemPayload(input),
  });

  if (error) {
    throw unwrapRpcError(error);
  }

  if (!isRecord(data)) {
    throw new EstimateRateServiceError("The estimate rate item save response was incomplete.");
  }

  return mapEstimateRateItem(data as DatabaseEstimateRateItemRecord);
}

export async function deleteEstimateRateItem(rateItemId: string) {
  const { data, error } = await supabase.rpc("delete_estimate_rate_item", {
    p_rate_item_id: rateItemId,
  });

  if (error) {
    throw unwrapRpcError(error);
  }

  if (!isRecord(data)) {
    throw new EstimateRateServiceError("The estimate rate item delete response was incomplete.");
  }

  return {
    rateItemId: readString(data.rate_item_id),
    rateSetId: readString(data.rate_set_id),
    deleted: data.deleted === true,
  };
}

export async function activateEstimateRateSet(rateSetId: string) {
  const { data, error } = await supabase.rpc("activate_estimate_rate_set", {
    p_rate_set_id: rateSetId,
  });

  if (error) {
    throw unwrapRpcError(error);
  }

  if (!isRecord(data)) {
    throw new EstimateRateServiceError("The estimate rate set activation response was incomplete.");
  }

  return mapEstimateRateSet(data as DatabaseEstimateRateSetRecord);
}
