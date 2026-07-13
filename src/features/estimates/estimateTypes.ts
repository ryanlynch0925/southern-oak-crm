export type EstimateDecisionKey = "yes" | "no";

export interface EstimateForm {
  type: string | null;
  len: string;
  wid: string;
  cols: string;
  thick: string;
  tear: string;
  grade: string;
  access: string;
  finish: string;
  timeline: string;
  notes: string;
  name: string;
  phone: string;
  email: string;
  addr: string;
  city: string;
  fileCount: number;
  fileNames: string[];
}

export interface EstimateRow {
  l: string;
  lo: number;
  hi: number;
}

export interface EstimateResult {
  sqft: number;
  lo: number;
  hi: number;
  rows: EstimateRow[];
  notes: string[];
}

export interface EstimateDecisionMeta {
  label: string;
  answer: string;
  status: string;
  customerTitle: string;
  customerBody: string;
  notificationType: string;
  notificationTitle: string;
}

export interface EstimatePricing {
  b1: number;
  b2: number;
  mj: number;
  st1: number;
  st2: number;
  de1: number;
  de2: number;
  th1: number;
  th2: number;
  tr1: number;
  tr2: number;
  gr1: number;
  gr2: number;
  ac1: number;
  ac2: number;
  pb1: number;
  pb2: number;
  bl1: number;
  bl2: number;
  co1: number;
  co2: number;
  re1: number;
  re2: number;
}

export interface EstimateTypeOption {
  id: string;
  label: string;
  sqft: boolean;
}
