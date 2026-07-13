import { useMemo, useState } from "react";
import { Btn, Card } from "../shared/AdminPrimitives";
import { B, INP } from "../shared/adminStyles";
import { fmtDate, fmtMetricNumber, todayIso } from "../shared/adminFormatters";
import CrewEditorModal from "./CrewEditorModal";
import { normalizeCrew } from "./crewMappers";
import { buildCalendarEvents, buildNewCrewDraft, getCrewProgressTone, getCrewStatusMeta } from "./crewUtils";
export default function CrewsSection({ crews, jobs, onUpdateCrew, onCreateCrew }) {
  const [crewDraft, setCrewDraft] = useState(null);
  const events = useMemo(() => buildCalendarEvents(jobs), [jobs]);
  const crewSummaries = crews.map(crew => {
    const todaysEvents = events.filter(event => event.crew_id === crew.id && event.date === todayIso() && event.counts_toward_crew);
    const todayLoad = todaysEvents.reduce((sum, event) => sum + Number(event.capacity_used || 0), 0);
    const upcoming = events
      .filter(event => event.crew_id === crew.id && event.date >= todayIso())
      .sort((a, b) => `${a.date} ${a.time || "07:00"}`.localeCompare(`${b.date} ${b.time || "07:00"}`))
      .slice(0, 4);
    const status = getCrewStatusMeta(todayLoad, crew.dailyCapacity);
    const progressTone = getCrewProgressTone(todayLoad, crew.dailyCapacity);
    const capacityPercent = crew.dailyCapacity > 0 ? Math.min((todayLoad / crew.dailyCapacity) * 100, 100) : 100;
    return { crew, todayLoad, upcoming, status, progressTone, capacityPercent };
  });
  const scheduledToday = events.filter(event => event.date === todayIso() && event.counts_toward_crew).length;
  const overbookedCrews = crewSummaries.filter(item => item.todayLoad > item.crew.dailyCapacity + 0.0001).length;
  const availableCapacity = crewSummaries.reduce((sum, item) => sum + Math.max(Number(item.crew.dailyCapacity || 0) - item.todayLoad, 0), 0);
  const openCreateCrew = () => setCrewDraft({ mode: "create", ...buildNewCrewDraft(crews) });
  const openEditCrew = crew => setCrewDraft({ mode: "edit", ...normalizeCrew(crew) });
  const closeCrewEditor = () => setCrewDraft(null);
  const saveCrew = async draft => {
    const normalized = normalizeCrew(draft);
    const saved = draft.mode === "create"
      ? await onCreateCrew(normalized)
      : await onUpdateCrew(normalized.id, normalized);

    if (saved) {
      closeCrewEditor();
    }
  };

  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>Crews</h1>
            <p style={{ fontSize: ".8rem", color: B.gray }}>Set daily capacity, review active workload, and catch crew assignments that are overbooked.</p>
          </div>
          <Btn v="primary" onClick={openCreateCrew}>
            <i className="ti ti-plus" style={{ marginRight: 6, fontSize: 13 }} aria-hidden="true" />
            Add Crew
          </Btn>
        </div>
      </Card>
      <div className="crews-summary-grid">
        {[
          { label: "Total Crews", value: crews.length, helper: "Active field crews" },
          { label: "Scheduled Today", value: scheduledToday, helper: "Crew assignments on the board" },
          { label: "Overbooked Crews", value: overbookedCrews, helper: "Need capacity review" },
          { label: "Available Capacity", value: fmtMetricNumber(availableCapacity), helper: "Days open across crews" },
        ].map(metric => (
          <Card key={metric.label} className="crew-metric-card">
            <div className="crew-metric-label">{metric.label}</div>
            <div className="crew-metric-value">{metric.value}</div>
            <div className="crew-metric-helper">{metric.helper}</div>
          </Card>
        ))}
      </div>
      <div className="crews-grid">
        {crewSummaries.map(({ crew, todayLoad, upcoming, status, progressTone, capacityPercent }) => (
          <Card key={crew.id} className="crew-card crew-card--interactive" style={{ cursor: "pointer" }} onClick={() => openEditCrew(crew)}>
            <div className="crew-card-header">
              <div>
                <div className="crew-card-eyebrow">Field Crew</div>
                <div className="crew-card-title">{crew.name}</div>
                <div className="crew-card-foreman">Foreman: {crew.foreman}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                <span className={`crew-status-pill crew-status-pill--${status.tone}`}>{status.label}</span>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    openEditCrew(crew);
                  }}
                  className="crew-edit-button"
                  type="button"
                >
                  <i className="ti ti-pencil" style={{ fontSize: 12 }} aria-hidden="true" />
                  Edit
                </button>
              </div>
            </div>
            <div className="crew-card-body">
              <div className="crew-card-notes">{crew.description}</div>

              <div className="crew-workload-panel">
                <div className="crew-workload-head">
                  <div>
                    <div className="crew-section-label">Workload Today</div>
                    <div className="crew-workload-value">{fmtMetricNumber(todayLoad)} / {fmtMetricNumber(crew.dailyCapacity)} day</div>
                  </div>
                  <span className={`crew-load-badge crew-load-badge--${progressTone}`}>
                    {todayLoad > crew.dailyCapacity + 0.0001 ? "Over capacity" : todayLoad > 0 ? "On schedule" : "Open"}
                  </span>
                </div>
                <div className="crew-progress-track" aria-hidden="true">
                  <div className={`crew-progress-fill crew-progress-fill--${progressTone}`} style={{ width: `${capacityPercent}%` }} />
                </div>
              </div>

              <div className="crew-capacity-panel">
                <label className="crew-section-label">Daily Capacity</label>
                <input
                  className="crew-capacity-input"
                  style={INP}
                  type="number"
                  step="0.25"
                  value={crew.dailyCapacity}
                  onClick={e => e.stopPropagation()}
                  onFocus={e => e.stopPropagation()}
                  onChange={e => onUpdateCrew(crew.id, { dailyCapacity: Number(e.target.value || 1) })}
                />
              </div>

              <div className="crew-section-label" style={{ marginBottom: 8 }}>Upcoming Assignments</div>
              <div className="crew-assignment-list">
              {upcoming.length === 0 && (
                <div className="crew-empty-state">
                  <i className="ti ti-calendar-off" style={{ fontSize: 18, color: B.lgray }} aria-hidden="true" />
                  <div>
                    <div style={{ fontWeight: 700, color: B.mid, marginBottom: 2 }}>No upcoming scheduled work</div>
                    <div>New assignments will appear here once this crew is placed on the board.</div>
                  </div>
                </div>
              )}
              {upcoming.map(event => (
                <div key={event.id} className={`crew-assignment-card crew-assignment-card--${event.schedule_type === "builder_slab" ? "builder" : "residential"}`}>
                  <div className="crew-assignment-icon">
                    <i className={`ti ${event.schedule_type === "builder_slab" ? "ti-building-community" : "ti-home"}`} aria-hidden="true" />
                  </div>
                  <div className="crew-assignment-content">
                    <div className="crew-assignment-title">{event.phase_label}</div>
                    <div className="crew-assignment-meta">{fmtDate(event.date)} - {event.time}</div>
                    <div className="crew-assignment-detail">{event.schedule_type === "builder_slab" ? `${event.builder_name} - Lot ${event.lot_number}` : event.customer_name}</div>
                  </div>
                </div>
              ))}
              </div>
            </div>
          </Card>
        ))}
      </div>
      {crewDraft && <CrewEditorModal draft={crewDraft} crews={crews} onClose={closeCrewEditor} onSave={saveCrew} />}
    </>
  );
}