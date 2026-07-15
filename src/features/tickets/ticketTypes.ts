import type { EstimateDecisionKey } from "../estimates/estimateTypes";

export const STATUS_STYLES = {
  "New Request": { c: "#1A5276", bg: "#D6EAF8" },
  "Needs Review": { c: "#784212", bg: "#FDEBD0" },
  "Rough Estimate Sent": { c: "#6C3483", bg: "#F4ECF7" },
  Interested: { c: "#1A5632", bg: "#D5F5E3" },
  "Site Visit Requested": { c: "#196F3D", bg: "#DCF3E4" },
  "Follow Up Needed": { c: "#9C640C", bg: "#FCF3CF" },
  Declined: { c: "#7B7D7D", bg: "#F2F3F4" },
  "Site Visit Needed": { c: "#922B21", bg: "#FADBD8" },
  Scheduled: { c: "#1A5632", bg: "#D5F5E3" },
  "Final Quote Sent": { c: "#1B4F72", bg: "#D6EAF8" },
  "Estimate Accepted": { c: "#1A5632", bg: "#D5F5E3" },
  "Ready to Schedule": { c: "#8A6A12", bg: "#F8F1D9" },
  "In Progress": { c: "#5B4A88", bg: "#EEE9F8" },
  Completed: { c: "#1A5632", bg: "#D5F5E3" },
  Delayed: { c: "#6B4EA0", bg: "#EEE9F8" },
  Cancelled: { c: "#7B7D7D", bg: "#F2F3F4" },
  Won: { c: "#145A32", bg: "#A9DFBF" },
  Lost: { c: "#4D5656", bg: "#EAEDED" },
  Pending: { c: "#586455", bg: "#EEF1EC" },
} as const;

export type TicketStatus = keyof typeof STATUS_STYLES;

export const STATUS_LIST = Object.keys(STATUS_STYLES) as TicketStatus[];

export interface TicketHistoryEntry {
  s: string;
  d: string;
  n: string;
}

export interface TicketNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  databaseId?: string;
  customerDatabaseId?: string;
  at: string;
  name: string;
  phone: string;
  email: string;
  addr: string;
  city: string;
  ptype: string;
  len: number;
  wid: number;
  sqft: number;
  thick: string;
  finish: string;
  tear: string;
  grade: string;
  access: string;
  timeline: string;
  notes: string;
  rLow: number | null;
  rHigh: number | null;
  quote: number | null;
  status: TicketStatus;
  followUp: string;
  files: string[];
  history: TicketHistoryEntry[];
  adminNotes: string;
  estimateDecision?: EstimateDecisionKey | null;
  estimateDecisionLabel?: string;
  decisionQuestion?: string;
  decisionAt?: string;
  decisionFeedbackReason?: string;
  decisionFeedbackComment?: string;
  notifications?: TicketNotification[];
}
