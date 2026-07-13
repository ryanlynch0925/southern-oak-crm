import { B } from "../../theme";

interface PillOption {
  v: string;
  l: string;
}

interface PillsProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  opts: PillOption[];
}

export default function Pills({ label, value, onChange, opts }: PillsProps) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: ".8rem", fontWeight: 700, color: B.dark, marginBottom: 5 }}>{label}</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {opts.map(option => (
          <button
            key={option.v}
            onClick={() => onChange(option.v)}
            style={{
              padding: "6px 12px",
              borderRadius: 20,
              border: `1.5px solid ${value === option.v ? B.green : B.border}`,
              background: value === option.v ? "#deeade" : B.white,
              color: value === option.v ? B.green : B.gray,
              fontWeight: 600,
              fontSize: ".76rem",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {option.l}
          </button>
        ))}
      </div>
    </div>
  );
}
