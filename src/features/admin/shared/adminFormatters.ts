export const todayIso = () => new Date().toISOString().slice(0, 10);

export const fmtDate = iso => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-";

export const fmtMetricNumber = n => `${Number(n || 0).toFixed(Number(n || 0) % 1 ? 2 : 0)}`;
