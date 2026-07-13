import { useState } from "react";
import type { PublicPageProps } from "../appTypes";
import SButton from "../components/common/SButton";
import { B, INP } from "../theme";

export default function ContactPage({ setPage }: PublicPageProps) {
  const [sent, setSent] = useState(false);

  return (
    <div style={{ background: B.sand, minHeight: "100vh" }}>
      <div style={{ background: B.dark, padding: "48px 16px 40px", textAlign: "center" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, color: B.white, marginBottom: 8 }}>Contact Us</h1>
        <p style={{ color: "rgba(255,255,255,.6)", fontSize: ".9rem" }}>Reach out with questions or to discuss your project.</p>
      </div>
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "40px 16px 60px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14, marginBottom: 24 }}>
          {[{ icon: "ti-phone", l: "Phone", v: "(404) 861-4594", href: "tel:4048614594" }, { icon: "ti-map-pin", l: "Location", v: "Thomaston, GA 30286" }, { icon: "ti-clock", l: "Hours", v: "Mon-Sat 7am-6pm" }].map(({ icon, l, v, href }) => (
            <div key={l} style={{ background: B.white, borderRadius: 8, padding: "18px 16px", border: `1px solid ${B.border}`, textAlign: "center" }}>
              <i className={`ti ${icon}`} style={{ fontSize: 24, color: B.bronze, marginBottom: 8, display: "block" }} aria-hidden="true" />
              <div style={{ fontSize: ".72rem", color: B.gray, marginBottom: 3, textTransform: "uppercase", letterSpacing: .5 }}>{l}</div>
              {href ? <a href={href} style={{ fontWeight: 700, color: B.dark, fontSize: ".88rem", textDecoration: "none" }}>{v}</a> : <div style={{ fontWeight: 700, color: B.dark, fontSize: ".88rem" }}>{v}</div>}
            </div>
          ))}
        </div>
        <div style={{ background: B.white, borderRadius: 10, padding: "28px 24px", border: `1px solid ${B.border}` }}>
          {sent ? <div style={{ textAlign: "center", padding: "20px 0" }}>
            <i className="ti ti-circle-check" style={{ fontSize: 40, color: "#1E8449", marginBottom: 12, display: "block" }} aria-hidden="true" />
            <h3 style={{ fontWeight: 700, color: B.dark, marginBottom: 6 }}>Message received!</h3>
            <p style={{ color: B.gray, fontSize: ".85rem" }}>We'll be in touch shortly. For a faster response, <a href="tel:4048614594" style={{ color: B.bronze }}>give us a call</a>.</p>
          </div> : <>
            <h2 style={{ fontWeight: 700, color: B.dark, fontSize: "1.1rem", marginBottom: 16 }}>Send a Message</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div><label style={{ display: "block", fontSize: ".78rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>Name</label><input style={INP} placeholder="Your name" /></div>
              <div><label style={{ display: "block", fontSize: ".78rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>Phone</label><input style={INP} placeholder="(555) 555-5555" type="tel" /></div>
            </div>
            <div style={{ marginBottom: 12 }}><label style={{ display: "block", fontSize: ".78rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>Message</label><textarea style={{ ...INP, resize: "vertical", minHeight: 100 }} placeholder="Tell us about your project..." /></div>
            <div style={{ display: "flex", gap: 10 }}>
              <SButton onClick={() => setSent(true)} full style={{ fontSize: ".9rem", padding: "11px 0" }}>
                <i className="ti ti-send" style={{ marginRight: 7, fontSize: 14, verticalAlign: -2 }} aria-hidden="true" />Send Message
              </SButton>
              <SButton onClick={() => setPage("estimate")} v="outlineDark" style={{ whiteSpace: "nowrap", fontSize: ".85rem", padding: "11px 16px" }}>
                Get Estimate
              </SButton>
            </div>
          </>}
        </div>
      </div>
    </div>
  );
}
