import type { PublicPage } from "../../appTypes";
import Logo from "../common/Logo";
import { AREAS } from "../../data/serviceAreas";
import { SERVICES } from "../../data/services";
import { B } from "../../theme";

interface FooterProps {
  setPage: (page: PublicPage) => void;
  setAdminMode: (value: boolean) => void;
}

export default function Footer({ setPage, setAdminMode }: FooterProps) {
  return (
    <div style={{ background: B.dark, color: "rgba(255,255,255,.7)", marginTop: 0 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 16px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 32, marginBottom: 32 }}>
          <div>
            <Logo />
            <p style={{ fontSize: ".78rem", marginTop: 14, lineHeight: 1.6, color: "rgba(255,255,255,.55)" }}>Professional concrete and masonry construction serving Middle Georgia.</p>
            <a href="tel:4048614594" style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 12, color: B.tan, fontWeight: 700, fontSize: ".85rem", textDecoration: "none" }}>
              <i className="ti ti-phone" style={{ fontSize: 16 }} aria-hidden="true" />(404) 861-4594
            </a>
          </div>
          <div>
            <div style={{ color: B.white, fontWeight: 700, marginBottom: 12, fontSize: ".82rem", textTransform: "uppercase", letterSpacing: 1 }}>Services</div>
            {SERVICES.map(service => <div key={service.id} onClick={() => setPage("services")} style={{ fontSize: ".78rem", marginBottom: 7, cursor: "pointer", color: "rgba(255,255,255,.6)" }}>{service.title}</div>)}
          </div>
          <div>
            <div style={{ color: B.white, fontWeight: 700, marginBottom: 12, fontSize: ".82rem", textTransform: "uppercase", letterSpacing: 1 }}>Service Area</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px" }}>
              {AREAS.map(area => <span key={area} style={{ fontSize: ".74rem", color: "rgba(255,255,255,.55)" }}>{area}, GA</span>)}
            </div>
          </div>
          <div>
            <div style={{ color: B.white, fontWeight: 700, marginBottom: 12, fontSize: ".82rem", textTransform: "uppercase", letterSpacing: 1 }}>Contact</div>
            <div style={{ fontSize: ".78rem", color: "rgba(255,255,255,.6)", lineHeight: 1.9 }}>
              <div><i className="ti ti-map-pin" style={{ marginRight: 6, color: B.tan }} aria-hidden="true" />Thomaston, GA 30286</div>
              <div><i className="ti ti-clock" style={{ marginRight: 6, color: B.tan }} aria-hidden="true" />Mon-Sat 7am-6pm</div>
              <div onClick={() => setPage("estimate")} style={{ cursor: "pointer", color: B.tan, fontWeight: 600, marginTop: 8 }}>
                <i className="ti ti-arrow-right" style={{ marginRight: 5 }} aria-hidden="true" />Request Free Estimate
              </div>
            </div>
          </div>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: ".72rem", color: "rgba(255,255,255,.35)" }}>(c) 2026 Southern Oak Concrete & Construction. All rights reserved.</span>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <button onClick={() => { setAdminMode(true); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ background: "none", border: "none", padding: 0, fontSize: ".72rem", color: "rgba(255,255,255,.35)", cursor: "pointer", fontFamily: "inherit" }}>
              Admin sign in
            </button>
            <button onClick={() => setPage("home")} style={{ background: "none", border: "none", padding: 0, fontSize: ".72rem", color: "rgba(255,255,255,.25)", cursor: "pointer", fontFamily: "inherit" }}>Thomaston, GA</button>
            <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} style={{ background: "none", border: "none", padding: 0, fontSize: ".72rem", color: "rgba(255,255,255,.25)", cursor: "pointer", fontFamily: "inherit" }}>
              Back to top
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
