export const BUILDER_COLOR_PALETTE = ["#2D6A4F", "#A15C16", "#1F5F8B", "#8B3D5E", "#546A2E", "#6C4A8B"];

export const BUILDER_PHASES = [
  { key: "form_slab", label: "Form Slab", responsible_party: "Southern Oak Concrete", counts_toward_crew: true },
  { key: "prep_slab", label: "Prep Slab", responsible_party: "Southern Oak Concrete", counts_toward_crew: true },
  { key: "pour_slab", label: "Pour Slab", responsible_party: "Southern Oak Concrete", counts_toward_crew: true },
];

const BUILDER_PHASE_WORKING_DAY_GAPS = {
  form_slab: 0,
  prep_slab: 1,
  pour_slab: 1,
};

export const BUILDER_SLAB_WORKFLOW = BUILDER_PHASES.map((phase) => ({
  ...phase,
  uiKey: phase.key,
  databaseKey: phase.key === "prep_slab" ? "slab_prep" : phase.key,
  workingDaysAfterPrevious: BUILDER_PHASE_WORKING_DAY_GAPS[phase.key] ?? 0,
}));

export const STANDARD_BUILDER_PHASE_KEYS = BUILDER_SLAB_WORKFLOW.map((phase) => phase.uiKey);

export const getBuilderWorkflowPhaseConfig = (phaseKey) =>
  BUILDER_SLAB_WORKFLOW.find((phase) => phase.uiKey === phaseKey) || null;

const BUILDER_PHASE_INDEX = new Map(BUILDER_PHASES.map((phase, idx) => [phase.key, idx]));

export const sortBuilderPhases = phases => [...(phases || [])].sort((a, b) => (BUILDER_PHASE_INDEX.get(a.phase_key) ?? 999) - (BUILDER_PHASE_INDEX.get(b.phase_key) ?? 999));

export const createBuilderFrontendId = name => {
  const slug = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `builder-${slug}`;
};

export const sortBuildersByName = builders => [...(builders || [])].sort((a, b) => a.name.localeCompare(b.name));

export const databaseBuilderToAppBuilder = (row, index = 0) => ({
  id: createBuilderFrontendId(row.name),
  databaseId: row.id,
  name: row.name || "",
  contact: row.primary_contact || "",
  phone: row.phone || "",
  communities: Array.isArray(row.communities) ? row.communities : [],
  color: row.color || BUILDER_COLOR_PALETTE[index % BUILDER_COLOR_PALETTE.length],
  active: row.active !== false,
});

export const appBuilderToDatabaseBuilder = builder => ({
  name: String(builder.name || "").trim(),
  primary_contact: String(builder.contact || "").trim() || null,
  phone: String(builder.phone || "").trim() || null,
  communities: Array.isArray(builder.communities)
    ? builder.communities
    : String(builder.communities || "").split(",").map(item => item.trim()).filter(Boolean),
  color: builder.color || null,
  active: builder.active !== false,
});
