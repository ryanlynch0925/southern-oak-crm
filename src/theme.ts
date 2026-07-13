import type { CSSProperties } from "react";

export const B = {
  dark: "#16130D",
  dark2: "#121A10",
  mid: "#4A382B",
  gray: "#6F5A32",
  lgray: "#CBB895",
  border: "rgba(212,180,125,.25)",
  sand: "#F3E8D0",
  sandD: "#E7D5B2",
  tan: "#D4B47D",
  bronze: "#9A741A",
  bronzeL: "#B98A2E",
  green: "#172315",
  green2: "#25301E",
  white: "#FFF8EA",
} as const;

export const BRAND_LOGO_SRC = `${import.meta.env.BASE_URL}branding/main_logo.png`;

export const INP: CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1.5px solid #DDD5C5",
  borderRadius: 6,
  fontSize: ".88rem",
  fontFamily: "inherit",
  background: B.white,
  color: B.dark,
  outline: "none",
  boxSizing: "border-box",
};
