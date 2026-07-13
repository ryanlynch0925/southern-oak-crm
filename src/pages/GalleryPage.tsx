import { useState } from "react";
import type { PublicPageProps } from "../appTypes";
import SButton from "../components/common/SButton";
import { GALLERY_ITEMS } from "../data/galleryItems";
import { B } from "../theme";

export default function GalleryPage({ setPage }: PublicPageProps) {
  const categories = ["All", ...new Set(GALLERY_ITEMS.map(item => item.type))];
  const [category, setCategory] = useState("All");
  const shown = category === "All" ? GALLERY_ITEMS : GALLERY_ITEMS.filter(item => item.type === category);

  return (
    <div style={{ background: B.sand, minHeight: "100vh" }}>
      <div style={{ background: B.dark, padding: "48px 16px 40px", textAlign: "center" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, color: B.white, marginBottom: 8 }}>Project Gallery</h1>
        <p style={{ color: "rgba(255,255,255,.6)", fontSize: ".9rem" }}>A sample of recent work across Middle Georgia.</p>
      </div>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 16px 60px" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24, justifyContent: "center" }}>
          {categories.map(item => (
            <button key={item} onClick={() => setCategory(item)} style={{ padding: "6px 16px", borderRadius: 20, border: `1.5px solid ${category === item ? B.green : B.border}`, background: category === item ? "#deeade" : B.white, color: category === item ? B.green : B.mid, fontWeight: 600, fontSize: ".76rem", cursor: "pointer", fontFamily: "inherit" }}>
              {item}
            </button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
          {shown.map((item, index) => (
            <div key={index} style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${B.border}`, background: B.white }}>
              <div style={{ height: 160, background: item.hue, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                <i className="ti ti-camera" style={{ fontSize: 36, color: "rgba(255,255,255,.15)" }} aria-hidden="true" />
                <div style={{ position: "absolute", bottom: 10, left: 10 }}>
                  <span style={{ background: "rgba(0,0,0,.5)", color: B.white, fontSize: ".68rem", fontWeight: 700, padding: "3px 9px", borderRadius: 4 }}>{item.type}</span>
                </div>
              </div>
              <div style={{ padding: "12px 14px" }}>
                <div style={{ fontWeight: 700, color: B.dark, fontSize: ".85rem", marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: ".73rem", color: B.gray }}>
                  <i className="ti ti-map-pin" style={{ marginRight: 4, fontSize: 12 }} aria-hidden="true" />{item.loc}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 32 }}>
          <p style={{ color: B.gray, fontSize: ".85rem", marginBottom: 16 }}>Have a project in mind? Let's talk about it.</p>
          <SButton onClick={() => setPage("estimate")}>Get a Free Estimate</SButton>
        </div>
      </div>
    </div>
  );
}
