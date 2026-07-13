import { useState } from "react";
import { Btn, Modal } from "../shared/AdminPrimitives";
import { B, INP, labelStyle } from "../shared/adminStyles";
export default function BuilderRecordModal({ draft, onClose, onSave }) {
  const [local, setLocal] = useState(draft);
  return (
    <Modal title="Add Builder" onClose={onClose} width={640}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label style={labelStyle}>Builder name</label><input style={INP} value={local.name} onChange={e => setLocal(prev => ({ ...prev, name: e.target.value }))} /></div>
        <div><label style={labelStyle}>Primary contact</label><input style={INP} value={local.contact} onChange={e => setLocal(prev => ({ ...prev, contact: e.target.value }))} /></div>
        <div><label style={labelStyle}>Phone</label><input style={INP} value={local.phone} onChange={e => setLocal(prev => ({ ...prev, phone: e.target.value }))} /></div>
        <div style={{ gridColumn: "1 / -1" }}><label style={labelStyle}>Communities</label><input style={INP} value={local.communities} onChange={e => setLocal(prev => ({ ...prev, communities: e.target.value }))} placeholder="Pine Brook, Oak Trace" /></div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: ".76rem", color: B.gray }}>Enter communities as a comma-separated list.</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn v="outline" onClick={onClose}>Cancel</Btn>
          <Btn v="green" onClick={() => onSave(local)} disabled={!local.name.trim()}>Save Builder</Btn>
        </div>
      </div>
    </Modal>
  );
}