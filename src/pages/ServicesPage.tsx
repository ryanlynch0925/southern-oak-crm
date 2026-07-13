import type { PublicPageProps } from "../appTypes";
import SButton from "../components/common/SButton";
import { SERVICES } from "../data/services";
import { B } from "../theme";

export default function ServicesPage({ setPage }: PublicPageProps) {
  return (
    <div style={{ background: B.sand, minHeight: "100vh" }}>
      <div style={{ background: B.dark, padding: "48px 16px 40px", textAlign: "center" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, color: B.white, marginBottom: 8 }}>Our Services</h1>
        <p style={{ color: "rgba(255,255,255,.6)", fontSize: ".9rem" }}>Concrete and masonry work for residential and commercial projects across Middle Georgia.</p>
      </div>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 16px 60px" }}>
        {SERVICES.map(service => (
          <div key={service.id} style={{ background: B.white, borderRadius: 10, padding: "28px 24px", marginBottom: 20, border: `1px solid ${B.border}` }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
              <div style={{ width: 52, height: 52, background: B.dark, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <i className={`ti ${service.icon}`} style={{ fontSize: 24, color: B.tan }} aria-hidden="true" />
              </div>
              <div>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>{service.title}</h2>
                <p style={{ color: B.gray, fontSize: ".85rem" }}>{service.sub}</p>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 6 }}>
              {service.pts.map(point => (
                <div key={point} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: ".82rem", color: B.mid }}>
                  <i className="ti ti-check" style={{ fontSize: 14, color: B.bronze, flexShrink: 0 }} aria-hidden="true" />{point}
                </div>
              ))}
            </div>
          </div>
        ))}
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <SButton onClick={() => setPage("estimate")} style={{ fontSize: "1rem", padding: "13px 28px" }}>
            <i className="ti ti-file-description" style={{ marginRight: 7, fontSize: 15, verticalAlign: -2 }} aria-hidden="true" />Request a Free Estimate
          </SButton>
        </div>
      </div>
    </div>
  );
}
