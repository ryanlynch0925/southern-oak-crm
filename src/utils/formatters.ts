export const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-";

export const fmtTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "-";

export const fmtMoney = (value?: number | null) =>
  value != null ? `$${Number(value).toLocaleString()}` : "-";

export const fmtRange = (low?: number | null, high?: number | null) =>
  low && high ? `$${Number(low).toLocaleString()} - $${Number(high).toLocaleString()}` : "-";
