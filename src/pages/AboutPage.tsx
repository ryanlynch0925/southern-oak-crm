import type { PublicPageProps } from "../appTypes";
import SButton from "../components/common/SButton";
import { B } from "../theme";

export default function AboutPage({ setPage }: PublicPageProps) {
  return (
    <div style={{ background: B.sand, minHeight: "100vh" }}>
      <div style={{ background: B.dark, padding: "48px 16px 40px", textAlign: "center" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, color: B.white, marginBottom: 8 }}>About Southern Oak</h1>
        <p style={{ color: "rgba(255,255,255,.6)", fontSize: ".9rem" }}>Concrete and masonry built with pride in Middle Georgia.</p>
      </div>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 16px 60px" }}>
        <div style={{ background: B.white, borderRadius: 10, padding: "32px 28px", border: `1px solid ${B.border}`, marginBottom: 20 }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: B.dark, marginBottom: 16 }}>Our Story</h2>
          <p style={{ color: B.mid, lineHeight: 1.8, marginBottom: 14, fontSize: ".9rem" }}>Southern Oak Concrete and Construction is a locally owned concrete and masonry contractor based in Thomaston, Georgia. We serve residential homeowners, farmers, and commercial customers across Middle Georgia with concrete flatwork, stamped and decorative concrete, masonry, pole barn construction, and block foundations.</p>
          <p style={{ color: B.mid, lineHeight: 1.8, fontSize: ".9rem" }}>We built this company on straightforward work: show up on time, do the job right, stand behind what we build. Every project - whether it's a backyard patio or a 5,000 square foot commercial slab - gets the same attention to detail. We don't cut corners on prep work, reinforcement, or finish.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, marginBottom: 24 }}>
          {[{ icon: "ti-heart", t: "Locally Owned", d: "Thomaston, GA based. We're your neighbors." }, { icon: "ti-certificate", t: "Licensed & Insured", d: "Fully licensed and insured for your protection." }, { icon: "ti-users", t: "Experienced Crews", d: "Skilled craftsmen with years in the field." }].map(({ icon, t, d }) => (
            <div key={t} style={{ background: B.white, borderRadius: 8, padding: "20px", border: `1px solid ${B.border}`, textAlign: "center" }}>
              <i className={`ti ${icon}`} style={{ fontSize: 28, color: B.bronze, marginBottom: 10, display: "block" }} aria-hidden="true" />
              <div style={{ fontWeight: 700, color: B.dark, marginBottom: 5, fontSize: ".9rem" }}>{t}</div>
              <p style={{ fontSize: ".78rem", color: B.gray }}>{d}</p>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center" }}>
          <SButton onClick={() => setPage("estimate")} style={{ fontSize: ".95rem", padding: "12px 28px" }}>Request a Free Estimate</SButton>
        </div>
      </div>
    </div>
  );
}
