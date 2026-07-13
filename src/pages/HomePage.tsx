import type { PublicPageProps } from "../appTypes";
import { AREAS } from "../data/serviceAreas";
import { SERVICES } from "../data/services";
import SButton from "../components/common/SButton";
import { B } from "../theme";

export default function HomePage({ setPage }: PublicPageProps) {
  return (
    <div>
      <div style={{ background: "linear-gradient(160deg,#141414 0%,#1E2E1E 60%,#1A1A1A 100%)", padding: "80px 16px 72px", textAlign: "center" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(196,168,130,.12)", border: "1px solid rgba(196,168,130,.25)", borderRadius: 20, padding: "5px 14px", marginBottom: 20 }}>
            <i className="ti ti-map-pin" style={{ fontSize: 13, color: B.tan }} aria-hidden="true" />
            <span style={{ fontSize: ".72rem", color: B.tan, fontWeight: 600, letterSpacing: .5 }}>Serving Thomaston & Middle Georgia</span>
          </div>
          <h1 style={{ fontSize: "2.4rem", fontWeight: 700, color: B.white, lineHeight: 1.2, margin: "0 0 16px" }}>
            Concrete & Masonry<br /><span style={{ color: B.tan }}>Built to Last.</span>
          </h1>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,.65)", lineHeight: 1.7, marginBottom: 28, maxWidth: 560, margin: "0 auto 28px" }}>
            Driveways, patios, slabs, stamped concrete, block foundations, and pole barn construction - residential and commercial. Free estimates. No pressure.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <SButton onClick={() => setPage("estimate")} style={{ fontSize: "1rem", padding: "13px 28px" }}>
              <i className="ti ti-file-description" style={{ marginRight: 7, fontSize: 16, verticalAlign: -2 }} aria-hidden="true" />Get a Free Estimate
            </SButton>
            <a href="tel:4048614594" style={{ display: "inline-block", padding: "13px 24px", borderRadius: 6, border: "1.5px solid rgba(255,255,255,.3)", color: B.white, fontWeight: 700, fontSize: "1rem", textDecoration: "none" }}>
              <i className="ti ti-phone" style={{ marginRight: 7, fontSize: 16, verticalAlign: -2 }} aria-hidden="true" />Call (404) 861-4594
            </a>
          </div>
        </div>
      </div>

      <div style={{ background: B.bronze, padding: "14px 16px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", justifyContent: "center", gap: 32, flexWrap: "wrap" }}>
          {[["ti-shield-check", "Licensed & Insured"], ["ti-calendar-check", "Free Estimates"], ["ti-map", "Middle Georgia"], ["ti-award", "Quality Craftsmanship"]].map(([icon, label]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 7, color: B.white, fontWeight: 700, fontSize: ".78rem" }}>
              <i className={`ti ${icon}`} style={{ fontSize: 16 }} aria-hidden="true" />{label}
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: B.sand, padding: "60px 16px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <h2 style={{ fontSize: "1.6rem", fontWeight: 700, color: B.dark, marginBottom: 8 }}>What We Do</h2>
            <p style={{ color: B.gray, fontSize: ".9rem" }}>Concrete and masonry services for residential and commercial projects across Middle Georgia.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
            {SERVICES.map(service => (
              <div key={service.id} onClick={() => setPage("services")} style={{ background: B.dark, borderRadius: 8, padding: "24px 20px", cursor: "pointer", border: "1px solid rgba(255,255,255,.06)" }}>
                <i className={`ti ${service.icon}`} style={{ fontSize: 28, color: B.tan, marginBottom: 12, display: "block" }} aria-hidden="true" />
                <div style={{ fontWeight: 700, color: B.white, fontSize: "1rem", marginBottom: 6 }}>{service.title}</div>
                <p style={{ fontSize: ".8rem", color: "rgba(255,255,255,.6)", lineHeight: 1.6, marginBottom: 14 }}>{service.sub}</p>
                <span style={{ fontSize: ".76rem", color: B.tan, fontWeight: 600 }}>Learn more <i className="ti ti-arrow-right" style={{ fontSize: 12, verticalAlign: -1 }} aria-hidden="true" /></span>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 28 }}>
            <SButton onClick={() => setPage("estimate")} style={{ fontSize: ".95rem", padding: "12px 28px" }}>
              Request a Free Estimate <i className="ti ti-arrow-right" style={{ marginLeft: 6, fontSize: 14, verticalAlign: -2 }} aria-hidden="true" />
            </SButton>
          </div>
        </div>
      </div>

      <div style={{ background: B.white, padding: "56px 16px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "1.5rem", fontWeight: 700, color: B.dark, marginBottom: 36 }}>Why Southern Oak?</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 24 }}>
            {[
              { icon: "ti-eye", t: "No Surprises", d: "Clear estimates, honest pricing, and no hidden charges. You always know what you're getting." },
              { icon: "ti-hammer", t: "Skilled Crews", d: "Experienced concrete and masonry crews who take pride in every pour, every course of block." },
              { icon: "ti-map", t: "Local & Reliable", d: "Based in Thomaston, serving Middle Georgia. We show up on time and finish the job." },
              { icon: "ti-thumb-up", t: "Free Estimates", d: "No pressure, no commitment. Submit your project details online and we'll follow up fast." },
            ].map(({ icon, t, d }) => (
              <div key={t} style={{ textAlign: "center", padding: "20px 12px" }}>
                <div style={{ width: 52, height: 52, background: B.sand, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                  <i className={`ti ${icon}`} style={{ fontSize: 24, color: B.bronze }} aria-hidden="true" />
                </div>
                <div style={{ fontWeight: 700, color: B.dark, marginBottom: 6, fontSize: ".95rem" }}>{t}</div>
                <p style={{ fontSize: ".8rem", color: B.gray, lineHeight: 1.6 }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: B.sandD, padding: "48px 16px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: B.dark, marginBottom: 8 }}>Service Area</h2>
          <p style={{ color: B.gray, fontSize: ".85rem", marginBottom: 24 }}>We serve Thomaston and surrounding communities throughout Middle Georgia.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 12px", justifyContent: "center" }}>
            {AREAS.map(area => <span key={area} style={{ padding: "6px 14px", borderRadius: 20, background: B.white, border: `1px solid ${B.border}`, fontSize: ".78rem", fontWeight: 600, color: B.mid }}>{area}, GA</span>)}
          </div>
          <p style={{ marginTop: 20, fontSize: ".8rem", color: B.gray }}>Not on this list? Call us - we serve many surrounding areas as well.</p>
        </div>
      </div>

      <div style={{ background: B.green, padding: "56px 16px", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2 style={{ fontSize: "1.7rem", fontWeight: 700, color: B.white, marginBottom: 10 }}>Ready to get started?</h2>
          <p style={{ color: "rgba(255,255,255,.7)", marginBottom: 24, fontSize: ".95rem" }}>Get a rough estimate online in minutes. No commitment required. We'll follow up to schedule a free site visit.</p>
          <SButton onClick={() => setPage("estimate")} style={{ fontSize: "1rem", padding: "14px 32px" }}>
            <i className="ti ti-file-description" style={{ marginRight: 8, fontSize: 16, verticalAlign: -2 }} aria-hidden="true" />Start Your Free Estimate
          </SButton>
        </div>
      </div>
    </div>
  );
}
