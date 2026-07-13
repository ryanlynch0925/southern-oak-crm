import { useState } from "react";
import { Btn } from "../shared/AdminPrimitives";
import { INP, labelStyle } from "../shared/adminStyles";
import { getCrewNumber } from "./crewUtils";
export default function CrewEditorModal({ draft, crews, onClose, onSave }) {
  const [local, setLocal] = useState(draft);
  const [error, setError] = useState("");
  const isCreate = local.mode === "create";

  const updateField = patch => {
    setLocal(prev => ({ ...prev, ...patch }));
    if (error) setError("");
  };

  const submit = () => {
    const crewNumber = Number(local.crewNumber);
    const dailyCapacity = Number(local.dailyCapacity);
    if (!crewNumber) {
      setError("Crew number is required.");
      return;
    }
    if (!local.name.trim()) {
      setError("Crew name is required.");
      return;
    }
    if (!local.foreman.trim()) {
      setError("Foreman name is required.");
      return;
    }
    if (!(dailyCapacity > 0)) {
      setError("Daily capacity must be greater than 0.");
      return;
    }
    const duplicate = crews.some(crew => crew.id !== local.id && getCrewNumber(crew) === crewNumber);
    if (duplicate) {
      setError("Crew numbers must be unique.");
      return;
    }
    onSave({
      ...local,
      crewNumber,
      number: crewNumber,
      name: local.name.trim(),
      foreman: local.foreman.trim(),
      description: local.description.trim(),
      notes: local.description.trim(),
      dailyCapacity,
      phone: local.phone.trim(),
      status: local.status === "inactive" ? "inactive" : "active",
    });
  };

  return (
    <div className="crew-modal-overlay" onClick={onClose}>
      <div className="crew-modal-shell" onClick={e => e.stopPropagation()}>
        <div className="crew-modal-header">
          <div>
            <div className="crew-modal-eyebrow">{isCreate ? "Add Crew" : "Edit Crew"}</div>
            <div className="crew-modal-title">{isCreate ? "Create a new crew" : `Update ${local.name}`}</div>
          </div>
          <button onClick={onClose} className="crew-modal-close" type="button" aria-label="Close crew editor">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>
        <div className="crew-modal-body">
          <div className="crew-modal-grid">
            <div>
              <label style={labelStyle}>Crew Number</label>
              <input style={INP} type="number" min="1" value={local.crewNumber} onChange={e => updateField({ crewNumber: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Daily Capacity</label>
              <input style={INP} type="number" step="0.25" min="0.25" value={local.dailyCapacity} onChange={e => updateField({ dailyCapacity: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Crew Name</label>
              <input style={INP} type="text" value={local.name} onChange={e => updateField({ name: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Foreman</label>
              <input style={INP} type="text" value={local.foreman} onChange={e => updateField({ foreman: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input style={INP} type="text" value={local.phone || ""} onChange={e => updateField({ phone: e.target.value })} placeholder="Optional" />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select style={{ ...INP, cursor: "pointer" }} value={local.status || "active"} onChange={e => updateField({ status: e.target.value })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Description</label>
              <textarea style={{ ...INP, minHeight: 110, resize: "vertical" }} value={local.description || ""} onChange={e => updateField({ description: e.target.value })} />
            </div>
          </div>
          {error && <div className="crew-modal-error"><i className="ti ti-alert-circle" style={{ marginRight: 6 }} aria-hidden="true" />{error}</div>}
          <div className="crew-modal-actions">
            <Btn v="outline" onClick={onClose}>Cancel</Btn>
            <Btn v="primary" onClick={submit}>{isCreate ? "Create Crew" : "Save Changes"}</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}