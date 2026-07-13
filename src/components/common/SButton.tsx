import type { CSSProperties, ReactNode } from "react";
import { B } from "../../theme";

type ButtonVariant = "primary" | "dark" | "green" | "outline" | "outlineDark" | "danger" | "success";

interface SButtonProps {
  children: ReactNode;
  onClick?: () => void;
  v?: ButtonVariant;
  sm?: boolean;
  full?: boolean;
  style?: CSSProperties;
}

export default function SButton({ children, onClick, v = "primary", sm = false, full = false, style = {} }: SButtonProps) {
  const padding = sm ? "6px 14px" : "10px 20px";
  const variants: Record<ButtonVariant, CSSProperties> = {
    primary: { background: B.bronze, color: B.white, border: "none" },
    dark: { background: B.dark, color: B.white, border: "none" },
    green: { background: B.green, color: B.white, border: "none" },
    outline: { background: "transparent", color: B.white, border: "1.5px solid rgba(255,255,255,.5)" },
    outlineDark: { background: "transparent", color: B.mid, border: `1.5px solid ${B.border}` },
    danger: { background: "#C0392B", color: B.white, border: "none" },
    success: { background: "#1E8449", color: B.white, border: "none" },
  };

  return (
    <button
      className={`oak-button oak-button--${v}`}
      onClick={onClick}
      style={{
        padding,
        borderRadius: 6,
        fontSize: sm ? ".78rem" : ".88rem",
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "inherit",
        display: full ? "block" : "inline-block",
        width: full ? "100%" : undefined,
        textAlign: "center",
        ...variants[v],
        ...style,
      }}
    >
      {children}
    </button>
  );
}
