import type {
  FinalEstimateDepositType,
} from "../../estimates/finalEstimateTypes";

export const FINAL_ESTIMATE_CUSTOM_TEMPLATE_ID = "custom_keep_current";
export const FINAL_ESTIMATE_TEMPLATE_HELPER_TEXT = "Selecting a template fills the field below. You can edit the wording before publishing.";

export interface FinalEstimateTemplateOption {
  id: string;
  label: string;
}

interface FinalEstimateTextTemplate extends FinalEstimateTemplateOption {
  text: string;
}

interface FinalEstimateScopeTemplate extends FinalEstimateTextTemplate {
  matchKeywords: string[];
}

const CUSTOM_TEMPLATE_OPTION: FinalEstimateTemplateOption = {
  id: FINAL_ESTIMATE_CUSTOM_TEMPLATE_ID,
  label: "Custom / Keep Current Text",
};

const SCOPE_TEMPLATES: FinalEstimateScopeTemplate[] = [
  {
    id: "driveway_installation",
    label: "Driveway Installation",
    matchKeywords: ["driveway"],
    text: "Install a new concrete driveway within the listed dimensions. Scope includes normal site preparation for the described work area, forming, reinforcement as listed in the final scope, concrete placement, finishing, and normal cleanup.",
  },
  {
    id: "driveway_replacement",
    label: "Driveway Replacement",
    matchKeywords: ["driveway", "replacement", "replace", "tear out"],
    text: "Remove and replace the existing driveway within the listed dimensions. Scope may include saw cutting, breakup, and removal of existing concrete where specifically listed in this estimate. Disposal and haul-off are included only when expressly stated in the written scope. Perform base preparation as needed for the listed work area, install forms and reinforcement as described in the final scope, place and finish new concrete, and complete normal cleanup.",
  },
  {
    id: "patio_installation",
    label: "Patio Installation",
    matchKeywords: ["patio"],
    text: "Install a new concrete patio within the listed dimensions. Scope includes normal site preparation for the described work area, forming, reinforcement as listed in the final scope, concrete placement, finishing, and normal cleanup.",
  },
  {
    id: "sidewalk_installation",
    label: "Sidewalk Installation",
    matchKeywords: ["sidewalk", "walkway"],
    text: "Install new concrete sidewalk work within the listed dimensions. Scope includes normal site preparation for the described work area, forming, reinforcement as listed in the final scope, concrete placement, finishing, and normal cleanup.",
  },
  {
    id: "concrete_slab",
    label: "Concrete Slab",
    matchKeywords: ["slab", "pad"],
    text: "Install a new concrete slab within the listed dimensions. Scope includes normal site preparation for the described work area, forming, reinforcement as listed in the final scope, concrete placement, finishing, and normal cleanup.",
  },
  {
    id: "foundation_footing_work",
    label: "Foundation / Footing Work",
    matchKeywords: ["foundation", "footing", "footer"],
    text: "Provide concrete foundation or footing work within the listed dimensions and layout shown in the final scope. Scope includes forming, reinforcement as listed in the final scope, concrete placement, finishing where applicable, and normal cleanup for the described work area.",
  },
  {
    id: "concrete_repair",
    label: "Concrete Repair",
    matchKeywords: ["repair", "patch", "resurface"],
    text: "Perform concrete repair work within the listed areas described in this estimate. Scope includes the specific repair preparation, repair placement, finishing, and normal cleanup expressly described in the final edited scope.",
  },
  {
    id: "general_concrete_work",
    label: "General Concrete Work",
    matchKeywords: [],
    text: "Provide concrete work within the listed dimensions and work areas described in this estimate. Scope includes the specific site preparation, forming, reinforcement, concrete placement, finishing, and cleanup expressly described in the final edited scope.",
  },
];

const PAYMENT_TEMPLATE_OPTIONS: FinalEstimateTemplateOption[] = [
  CUSTOM_TEMPLATE_OPTION,
  { id: "deposit_25_percent", label: "25% Deposit" },
  { id: "deposit_50_percent", label: "50% Deposit" },
  { id: "fixed_deposit", label: "Fixed Deposit" },
  { id: "no_deposit", label: "No Deposit" },
];

const SCHEDULING_TEMPLATES: FinalEstimateTextTemplate[] = [
  {
    id: "standard_scheduling",
    label: "Standard Scheduling",
    text: "Scheduling will be confirmed after the required deposit is received. Work dates are subject to weather, material availability, site conditions, and crew availability.",
  },
  {
    id: "no_deposit_required",
    label: "No Deposit Required",
    text: "Scheduling will be confirmed after written acceptance. Work dates are subject to weather, material availability, site conditions, and crew availability.",
  },
  {
    id: "permit_or_approval_required",
    label: "Permit or Approval Required",
    text: "Scheduling will be confirmed after all required permits, approvals, site access, and customer responsibilities are completed. Work dates remain subject to weather and crew availability.",
  },
  {
    id: "customer_site_preparation_required",
    label: "Customer Site Preparation Required",
    text: "Scheduling will be confirmed after the customer completes all required site-access and preparation responsibilities. Work dates remain subject to weather, material availability, and crew availability.",
  },
];

const EXCLUSION_TEMPLATES: FinalEstimateTextTemplate[] = [
  {
    id: "standard_exclusions",
    label: "Standard Exclusions",
    text: "Unless specifically included in the written scope, this estimate excludes permits, engineering, utility relocation, unforeseen underground conditions, landscaping restoration, electrical work, plumbing work, and work outside the listed dimensions.",
  },
  {
    id: "permits_and_utilities",
    label: "Permits and Utilities",
    text: "Permits, engineering, utility location, utility relocation, and repairs to unidentified or unmarked utilities are excluded unless specifically listed in the scope.",
  },
  {
    id: "landscaping_and_restoration",
    label: "Landscaping and Restoration",
    text: "Landscaping, irrigation repair, sod replacement, grading beyond the listed work area, and restoration outside the immediate construction area are excluded unless specifically listed in the scope.",
  },
  {
    id: "demolition_and_haul_off",
    label: "Demolition and Haul-Off",
    text: "Demolition, removal, disposal, and haul-off of existing materials are excluded unless specifically listed in the scope.",
  },
  {
    id: "no_standard_exclusions",
    label: "No Standard Exclusions",
    text: "",
  },
];

export const PAYMENT_TEMPLATE_SELECT_OPTIONS = PAYMENT_TEMPLATE_OPTIONS;
export const SCHEDULING_TEMPLATE_SELECT_OPTIONS: FinalEstimateTemplateOption[] = [
  CUSTOM_TEMPLATE_OPTION,
  ...SCHEDULING_TEMPLATES.map(({ id, label }) => ({ id, label })),
];
export const EXCLUSION_TEMPLATE_SELECT_OPTIONS: FinalEstimateTemplateOption[] = [
  CUSTOM_TEMPLATE_OPTION,
  ...EXCLUSION_TEMPLATES.map(({ id, label }) => ({ id, label })),
];

function templateMatchesProjectType(
  template: FinalEstimateScopeTemplate,
  normalizedProjectType: string
) {
  return template.matchKeywords.some((keyword) => normalizedProjectType.includes(keyword));
}

export function getScopeTemplateSelectOptions(projectType: string): FinalEstimateTemplateOption[] {
  const normalizedProjectType = projectType.trim().toLowerCase();
  const orderedTemplates = [...SCOPE_TEMPLATES]
    .sort((left, right) => {
      const leftMatched = templateMatchesProjectType(left, normalizedProjectType);
      const rightMatched = templateMatchesProjectType(right, normalizedProjectType);

      if (leftMatched === rightMatched) {
        return 0;
      }

      return leftMatched ? -1 : 1;
    })
    .map(({ id, label }) => ({ id, label }));

  return [CUSTOM_TEMPLATE_OPTION, ...orderedTemplates];
}

export function getScopeTemplateText(templateId: string) {
  return SCOPE_TEMPLATES.find((template) => template.id === templateId)?.text || null;
}

export function buildPercentageDepositPaymentTerms(percentage: number) {
  return `${percentage}% deposit due upon acceptance. The remaining balance is due upon completion of the agreed scope of work.`;
}

export function buildFixedDepositPaymentTerms(amount: number) {
  return `A fixed deposit of ${formatCurrency(amount)} is due upon acceptance. The remaining balance is due upon completion of the agreed scope of work.`;
}

function formatCurrency(amount: number) {
  return `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function hasValidFixedDepositAmount(
  depositType: FinalEstimateDepositType,
  depositValue: number | null | undefined
) {
  return depositType === "fixed"
    && depositValue != null
    && Number.isFinite(Number(depositValue))
    && Number(depositValue) > 0;
}

export function getPaymentTermsTemplateText(
  templateId: string,
  depositType: FinalEstimateDepositType,
  depositValue: number | null | undefined
) {
  if (templateId === "deposit_25_percent") {
    return buildPercentageDepositPaymentTerms(25);
  }

  if (templateId === "deposit_50_percent") {
    return buildPercentageDepositPaymentTerms(50);
  }

  if (templateId === "fixed_deposit") {
    if (!hasValidFixedDepositAmount(depositType, depositValue)) {
      return null;
    }

    return buildFixedDepositPaymentTerms(Number(depositValue));
  }

  if (templateId === "no_deposit") {
    return "No deposit is required. Full payment is due upon completion of the agreed scope of work.";
  }

  return null;
}

export function getDefaultPaymentTermsText(
  depositType: FinalEstimateDepositType,
  depositValue: number | null | undefined
) {
  if (depositType === "percentage" && depositValue != null && Number.isFinite(Number(depositValue)) && Number(depositValue) >= 0) {
    return buildPercentageDepositPaymentTerms(Number(depositValue));
  }

  if (depositType === "fixed" && hasValidFixedDepositAmount(depositType, depositValue)) {
    return buildFixedDepositPaymentTerms(Number(depositValue));
  }

  if (depositType === "none") {
    return "No deposit is required. Full payment is due upon completion of the agreed scope of work.";
  }

  return "";
}

export function getSchedulingTemplateText(templateId: string) {
  return SCHEDULING_TEMPLATES.find((template) => template.id === templateId)?.text ?? null;
}

export function getExclusionTemplateText(templateId: string) {
  return EXCLUSION_TEMPLATES.find((template) => template.id === templateId)?.text ?? null;
}
