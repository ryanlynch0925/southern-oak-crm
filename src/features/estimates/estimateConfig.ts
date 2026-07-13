import type { EstimateDecisionKey, EstimateDecisionMeta, EstimateForm, EstimatePricing, EstimateTypeOption } from "./estimateTypes";

export const ESTIMATE_DECISIONS: Record<EstimateDecisionKey, EstimateDecisionMeta> = {
  yes: {
    label: "Yes / Interested",
    answer: "Yes, I'd like to move forward",
    status: "Site Visit Requested",
    customerTitle: "Estimate request submitted for review.",
    customerBody: "Someone from Southern Oak Concrete & Construction will reach out soon to discuss your project and next steps.",
    notificationType: "warm_lead",
    notificationTitle: "Warm lead",
  },
  no: {
    label: "No / Follow Up Needed",
    answer: "No, not at this time",
    status: "Follow Up Needed",
    customerTitle: "Thanks for checking with Southern Oak.",
    customerBody: "We've saved your estimate details, and Southern Oak can still help if your plans change. The owner may follow up with a quick sales call.",
    notificationType: "sales_follow_up",
    notificationTitle: "Sales follow-up",
  },
};

export const NO_DECISION_FEEDBACK_OPTIONS = [
  "Price was higher than expected",
  "Project timing is not right",
  "I am comparing other quotes",
  "I need to change the project scope",
  "I was only researching pricing",
  "Other",
];

export const DP: EstimatePricing = {
  b1: 7,
  b2: 10,
  mj: 1500,
  st1: 8,
  st2: 15,
  de1: 4,
  de2: 8,
  th1: 1,
  th2: 2,
  tr1: 2.5,
  tr2: 4.5,
  gr1: 500,
  gr2: 1500,
  ac1: 300,
  ac2: 800,
  pb1: 7,
  pb2: 11,
  bl1: 25,
  bl2: 45,
  co1: 800,
  co2: 2500,
  re1: 400,
  re2: 1800,
};

export const TYPES: EstimateTypeOption[] = [
  { id: "driveway", label: "Driveway", sqft: true },
  { id: "patio", label: "Patio", sqft: true },
  { id: "sidewalk", label: "Sidewalk", sqft: true },
  { id: "slab", label: "General Slab", sqft: true },
  { id: "stamped", label: "Stamped Concrete", sqft: true },
  { id: "decorative", label: "Decorative Concrete", sqft: true },
  { id: "repair", label: "Concrete Repair", sqft: false },
  { id: "pole_barn", label: "Pole Barn Slab", sqft: true },
  { id: "block", label: "Block Foundation", sqft: true },
  { id: "columns", label: "Columns", sqft: false },
  { id: "other", label: "Other / Not Sure", sqft: true },
];

export const getDecisionMeta = (decision: EstimateDecisionKey | null) =>
  decision ? ESTIMATE_DECISIONS[decision] : null;

export const getInitialEstimateForm = (): EstimateForm => ({
  type: null,
  len: "",
  wid: "",
  cols: "",
  thick: "ns",
  tear: "no",
  grade: "no",
  access: "yes",
  finish: "ns",
  timeline: "flex",
  notes: "",
  name: "",
  phone: "",
  email: "",
  addr: "",
  city: "",
  fileCount: 0,
  fileNames: [],
});
