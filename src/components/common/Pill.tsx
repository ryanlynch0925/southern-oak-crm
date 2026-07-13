import { STATUS_STYLES } from "../../features/tickets/ticketTypes";

interface PillProps {
  label?: string;
  status: string;
}

export default function Pill({ label, status }: PillProps) {
  const config = STATUS_STYLES[status as keyof typeof STATUS_STYLES] || { c: "#555", bg: "#eee" };
  return <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, background: config.bg, color: config.c, fontWeight: 700, fontSize: ".68rem", whiteSpace: "nowrap" }}>{label || status}</span>;
}
