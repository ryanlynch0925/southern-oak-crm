export type EstimateRateSetStatus = "draft" | "active" | "retired";

export type EstimateRatePricingMethod = "per_unit" | "flat" | "percentage";

export type EstimateRateMetadataValue =
  | string
  | number
  | boolean
  | null
  | EstimateRateMetadataValue[]
  | { [key: string]: EstimateRateMetadataValue };

export interface EstimateRateMetadata {
  [key: string]: EstimateRateMetadataValue;
}

export interface EstimateRateSet {
  id: string;
  name: string;
  versionNumber: number;
  status: EstimateRateSetStatus;
  effectiveFrom: string;
  effectiveTo: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface EstimateRateItem {
  id: string;
  rateSetId: string;
  rateKey: string;
  label: string;
  category: string;
  projectType: string;
  pricingMethod: EstimateRatePricingMethod;
  unit: string;
  rateAmount: number;
  minimumCharge: number | null;
  description: string;
  sortOrder: number;
  metadata: EstimateRateMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface EstimateRateSetWithItems extends EstimateRateSet {
  items: EstimateRateItem[];
}

export interface CreateEstimateRateSetInput {
  name: string;
  versionNumber: number;
  effectiveFrom: string;
  effectiveTo: string;
  notes: string;
}

export interface UpsertEstimateRateItemInput {
  id?: string | null;
  rateKey: string;
  label: string;
  category: string;
  projectType: string;
  pricingMethod: EstimateRatePricingMethod;
  unit: string;
  rateAmount: number;
  minimumCharge: number | null;
  description: string;
  sortOrder: number;
  metadata: EstimateRateMetadata;
}
