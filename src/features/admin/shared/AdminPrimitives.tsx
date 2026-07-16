import { B } from "./adminStyles";

export function Btn({ children, onClick, v = "primary", sm = false, full = false, style = {}, disabled = false }) {
  const pads = sm ? "6px 14px" : "10px 20px";
  const variants = {
    primary: { background: B.bronze, color: B.white, border: "none" },
    dark: { background: B.dark, color: B.white, border: "none" },
    green: { background: B.green, color: B.white, border: "none" },
    outline: { background: "transparent", color: B.mid, border: `1.5px solid ${B.border}` },
    danger: { background: "#C0392B", color: B.white, border: "none" },
  };
  return (
    <button className={`oak-button oak-button--${v}`} disabled={disabled} onClick={disabled ? undefined : onClick} style={{ padding: pads, borderRadius: 6, fontSize: sm ? ".78rem" : ".88rem", fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1, fontFamily: "inherit", display: full ? "block" : "inline-block", width: full ? "100%" : undefined, textAlign: "center", ...(variants[v] || variants.primary), ...style }}>
      {children}
    </button>
  );
}

export function Card({ children, style = {}, className = "", ...props }) {
  return <div className={className} style={{ background: B.white, borderRadius: 8, padding: 18, border: `1px solid ${B.border}`, ...style }} {...props}>{children}</div>;
}

export function Modal({ title, children, onClose, width = 720 }) {
  return (
    <div className="admin-modal-overlay" role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 3000, padding: 20, overflowY: "auto" }}>
      <div className="admin-modal-shell" style={{ maxWidth: width, margin: "40px auto", background: B.white, borderRadius: 10, border: `1px solid ${B.border}`, overflow: "hidden" }}>
        <div className="admin-modal-header" style={{ padding: "16px 18px", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: B.dark }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: B.gray, cursor: "pointer", fontSize: "1rem" }}>
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>
        <div className="admin-modal-body" style={{ padding: 18 }}>{children}</div>
      </div>
    </div>
  );
}
