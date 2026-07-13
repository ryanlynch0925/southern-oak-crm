import { useState } from "react";
import type { PublicPage } from "../../appTypes";
import { B } from "../../theme";

interface NavProps {
  page: PublicPage;
  setPage: (page: PublicPage) => void;
  adminMode: boolean;
  setAdminMode: (value: boolean) => void;
}

function Wordmark() {
  return <span className="public-wordmark">Southern Oak Construction</span>;
}

export default function Nav({ page, setPage, adminMode, setAdminMode }: NavProps) {
  void adminMode;
  const [open, setOpen] = useState(false);
  const links: Array<{ k: PublicPage; l: string }> = [
    { k: "home", l: "Home" },
    { k: "services", l: "Services" },
    { k: "gallery", l: "Gallery" },
    { k: "about", l: "About" },
    { k: "contact", l: "Contact" },
  ];

  return (
    <div className="public-nav" style={{ background: B.dark, borderBottom: "1px solid rgba(212,180,125,.16)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        <div className="public-brand" onClick={() => { setPage("home"); setAdminMode(false); }}><Wordmark /></div>
        <div className="public-nav-actions" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {links.map(link => (
            <button key={link.k} className="desktopNav" onClick={() => { setPage(link.k); setOpen(false); }} style={{ background: "none", border: "none", color: page === link.k ? B.tan : "rgba(255,255,255,.7)", fontWeight: page === link.k ? 700 : 500, fontSize: ".82rem", cursor: "pointer", padding: "6px 10px", fontFamily: "inherit" }}>
              {link.l}
            </button>
          ))}
          <button onClick={() => setPage("estimate")} style={{ background: B.bronze, border: "none", color: B.white, fontWeight: 700, fontSize: ".78rem", cursor: "pointer", padding: "8px 14px", borderRadius: 6, fontFamily: "inherit", marginLeft: 4 }}>
            <i className="ti ti-file-description" style={{ marginRight: 5, fontSize: 14, verticalAlign: -2 }} aria-hidden="true" />Free Estimate
          </button>
          <a href="tel:4048614594" style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.15)", color: B.white, fontWeight: 700, fontSize: ".78rem", padding: "8px 12px", borderRadius: 6, textDecoration: "none", marginLeft: 2 }}>
            <i className="ti ti-phone" style={{ marginRight: 4, fontSize: 13, verticalAlign: -2 }} aria-hidden="true" />(404) 861-4594
          </a>
          <button className="desktopAdminLink" onClick={() => { setAdminMode(true); setOpen(false); }} style={{ background: "transparent", border: "1px solid rgba(255,255,255,.18)", color: "rgba(255,255,255,.78)", fontWeight: 700, fontSize: ".78rem", cursor: "pointer", padding: "8px 12px", borderRadius: 6, fontFamily: "inherit", marginLeft: 2 }}>
            <i className="ti ti-shield-lock" style={{ marginRight: 5, fontSize: 13, verticalAlign: -2 }} aria-hidden="true" />Admin Sign In
          </button>
          <button className="mobileNavToggle" onClick={() => setOpen(current => !current)} style={{ background: "none", border: "1px solid rgba(255,255,255,.2)", color: B.white, padding: "7px 10px", borderRadius: 6, cursor: "pointer", marginLeft: 2 }}>
            <i className={open ? "ti ti-x" : "ti ti-menu-2"} style={{ fontSize: 18 }} aria-hidden="true" />
          </button>
        </div>
      </div>
      {open && (
        <div className="public-mobile-menu" style={{ background: B.dark2, borderTop: "1px solid rgba(212,180,125,.12)", padding: "8px 16px 12px" }}>
          {links.map(link => (
            <div key={link.k} onClick={() => { setPage(link.k); setOpen(false); }} style={{ padding: "10px 0", color: page === link.k ? B.tan : "rgba(255,255,255,.8)", fontWeight: 600, fontSize: ".88rem", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
              {link.l}
            </div>
          ))}
          <div onClick={() => { setAdminMode(true); setOpen(false); }} style={{ padding: "10px 0", color: "rgba(255,255,255,.5)", fontWeight: 600, fontSize: ".8rem", cursor: "pointer" }}>
            <i className="ti ti-shield-lock" style={{ marginRight: 6, fontSize: 13 }} aria-hidden="true" />Admin Login
          </div>
        </div>
      )}
    </div>
  );
}
