export const makeCrewId = () => globalThis.crypto?.randomUUID?.() || `crew-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const normalizeCrew = (crew, index = 0) => {
  const crewNumber = Number(crew.crewNumber ?? crew.number ?? index + 1);
  const name = (crew.name || "").trim() || `Crew ${crewNumber}`;
  const description = crew.description ?? crew.notes ?? "";
  return {
    id: crew.id || makeCrewId(),
    crewNumber,
    number: crewNumber,
    name,
    foreman: crew.foreman || "",
    description,
    notes: description,
    dailyCapacity: Number(crew.dailyCapacity || 1),
    phone: crew.phone || "",
    status: crew.status === "inactive" ? "inactive" : "active",
  };
};

export const databaseCrewToAppCrew = (row, index = 0) => {
  const crewNumberText = row.crew_number || `Crew ${index + 1}`;
  const matchedNumber = String(crewNumberText).match(/\d+/);
  const crewNumber = matchedNumber ? Number(matchedNumber[0]) : index + 1;

  return normalizeCrew(
    {
      id: row.id,
      crewNumber,
      name: crewNumberText,
      foreman: row.lead_name || "",
      description: row.description || row.notes || row.crew_name || "",
      dailyCapacity: Number(row.daily_capacity || 1),
      phone: row.phone || "",
      status: row.active === false ? "inactive" : "active",
    },
    index
  );
};

export const appCrewToDatabaseCrew = crew => {
  const normalized = normalizeCrew(crew);

  return {
    crew_number: normalized.name || `Crew ${normalized.crewNumber}`,
    crew_name: normalized.description || normalized.name,
    lead_name: normalized.foreman,
    phone: normalized.phone || null,
    active: normalized.status !== "inactive",
    daily_capacity: Number(normalized.dailyCapacity || 1),
  };
};
