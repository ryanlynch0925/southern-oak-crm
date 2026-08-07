export type ActualProjectDetailsJson =
  | string
  | number
  | boolean
  | null
  | ActualProjectDetailsJson[]
  | { [key: string]: ActualProjectDetailsJson };

export interface ActualProjectDetailsObject {
  [key: string]: ActualProjectDetailsJson;
}

export interface ActualProjectMeasuredSection {
  label: string;
  lengthFt: number | null;
  widthFt: number | null;
  squareFeet: number | null;
  thicknessIn: number | null;
  linearFeet: number | null;
  quantity: number | null;
  notes: string;
}

export interface ActualProjectDetails {
  id: string;
  estimateId: string;
  projectType: string;
  measuredSections: ActualProjectMeasuredSection[];
  actualThicknessIn: number | null;
  tearOutRequired: boolean | null;
  tearOutQuantity: number | null;
  tearOutUnit: string;
  gradingRequired: boolean | null;
  gradingNotes: string;
  reinforcementType: string;
  reinforcementNotes: string;
  finishType: string;
  finishNotes: string;
  pumpRequired: boolean | null;
  equipmentNotes: string;
  accessCondition: string;
  accessNotes: string;
  sitePreparationNotes: string;
  estimatorNotes: string;
  projectDetails: ActualProjectDetailsObject;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface UpsertActualProjectDetailsInput {
  projectType: string;
  measuredSections: ActualProjectMeasuredSection[];
  actualThicknessIn: number | null;
  tearOutRequired: boolean | null;
  tearOutQuantity: number | null;
  tearOutUnit: string;
  gradingRequired: boolean | null;
  gradingNotes: string;
  reinforcementType: string;
  reinforcementNotes: string;
  finishType: string;
  finishNotes: string;
  pumpRequired: boolean | null;
  equipmentNotes: string;
  accessCondition: string;
  accessNotes: string;
  sitePreparationNotes: string;
  estimatorNotes: string;
  projectDetails: ActualProjectDetailsObject;
}

export function createEmptyActualProjectDetailsInput(
  projectType = ""
): UpsertActualProjectDetailsInput {
  return {
    projectType,
    measuredSections: [],
    actualThicknessIn: null,
    tearOutRequired: null,
    tearOutQuantity: null,
    tearOutUnit: "",
    gradingRequired: null,
    gradingNotes: "",
    reinforcementType: "",
    reinforcementNotes: "",
    finishType: "",
    finishNotes: "",
    pumpRequired: null,
    equipmentNotes: "",
    accessCondition: "",
    accessNotes: "",
    sitePreparationNotes: "",
    estimatorNotes: "",
    projectDetails: {},
  };
}
