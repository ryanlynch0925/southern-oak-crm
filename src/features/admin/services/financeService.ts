import { supabase } from "../../../lib/supabase";

interface SupabaseErrorSummary {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

export interface FinanceRevenueSourceRow {
  invoice_id: string;
  customer_id: string;
  job_id: string | null;
  invoice_number: string | null;
  invoice_date: string;
  due_date: string | null;
  total_amount: number | string;
  status: string | null;
  amount_paid: number | string;
  balance_due: number | string;
}

interface PaymentRow {
  id: string;
  invoice_id: string;
  payment_date: string;
  amount: number | string;
  payment_method: string | null;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
}

interface ExpenseRow {
  id: string;
  job_id: string | null;
  expense_date: string;
  category: string | null;
  vendor: string | null;
  description: string | null;
  amount: number | string;
  payment_method: string | null;
  receipt_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface FinanceOverviewSummaryRow {
  total_revenue: number | string | null;
  unpaid_balance: number | string | null;
  total_expenses: number | string | null;
  net_profit: number | string | null;
}

interface CustomerLookupRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
}

interface JobLookupRow {
  id: string;
  job_name: string | null;
}

export const EXPENSE_CATEGORY_VALUES = [
  "material",
  "labor",
  "fuel",
  "equipment",
  "subcontractor",
  "dump_fee",
  "office",
  "software",
  "insurance",
  "general",
  "other",
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORY_VALUES[number];

export interface FinanceReceivableRecord {
  invoiceId: string;
  customerId: string;
  jobId: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  status: string;
  customer: string;
  project: string;
  invoiceProject: string;
}

export interface FinanceRevenueRecord {
  invoiceId: string;
  customerId: string;
  jobId: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  rawStatus: string | null;
  statusLabel: string;
  customerName: string;
}

export interface FinancePaymentRecord {
  id: string;
  invoiceId: string;
  date: string;
  amount: number;
  method: string;
  reference: string;
  notes: string;
  createdAt: string;
  customerJob: string;
  remainingBalance: number;
}

export interface FinanceExpenseRecord {
  id: string;
  jobId: string | null;
  expenseDate: string;
  category: ExpenseCategory;
  vendor: string;
  description: string;
  amount: number;
  paymentMethod: string;
  receiptUrl: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinancePaymentsSnapshot {
  receivables: FinanceReceivableRecord[];
  payments: FinancePaymentRecord[];
}

export interface FinanceRevenueSnapshot {
  items: FinanceRevenueRecord[];
}

export interface FinanceExpensesSnapshot {
  expenses: FinanceExpenseRecord[];
}

export interface FinanceOverviewSummary {
  totalRevenue: number;
  unpaidBalance: number;
  totalExpenses: number;
  netProfit: number;
}

export interface CreatePaymentInput {
  invoiceId: string;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string;
  notes?: string;
}

export interface CreateExpenseInput {
  jobId?: string | null;
  expenseDate: string;
  category: ExpenseCategory;
  vendor?: string;
  description: string;
  amount: number;
  paymentMethod?: string;
  receiptUrl?: string;
  notes?: string;
}

export class FinanceServiceError extends Error {
  supabaseError: SupabaseErrorSummary;

  constructor(context: string, error: unknown) {
    const supabaseError = summarizeSupabaseError(error);
    super(`${context}: ${supabaseError.message || "Supabase request failed."}`);
    this.name = "FinanceServiceError";
    this.supabaseError = supabaseError;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function summarizeSupabaseError(error: unknown): SupabaseErrorSummary {
  if (!isRecord(error)) {
    return {};
  }

  return {
    message: typeof error.message === "string" ? error.message : undefined,
    code: typeof error.code === "string" ? error.code : undefined,
    details: typeof error.details === "string" ? error.details : undefined,
    hint: typeof error.hint === "string" ? error.hint : undefined,
  };
}

function throwFinanceServiceError(context: string, error: unknown): never {
  const serviceError = new FinanceServiceError(context, error);

  console.error(context, {
    message: serviceError.supabaseError.message,
    code: serviceError.supabaseError.code,
    details: serviceError.supabaseError.details,
    hint: serviceError.supabaseError.hint,
  });

  throw serviceError;
}

function toMoney(value: number | string | null | undefined) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toStatusLabel(value: string | null | undefined) {
  return String(value || "unknown")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function toInvoiceNumber(value: string | null | undefined) {
  return value?.trim() || "Invoice";
}

function resolveInvoiceStatusLabel(row: Pick<FinanceRevenueSourceRow, "status" | "amount_paid" | "balance_due" | "due_date">) {
  if (row.status?.trim()) {
    return toStatusLabel(row.status);
  }

  const amountPaid = toMoney(row.amount_paid);
  const balanceDue = toMoney(row.balance_due);

  if (balanceDue <= 0) {
    return "Paid";
  }

  if (amountPaid > 0) {
    return "Partial";
  }

  if (row.due_date && row.due_date < getTodayIsoDate()) {
    return "Overdue";
  }

  return "Unpaid";
}

function isExpenseCategory(value: string | null | undefined): value is ExpenseCategory {
  return EXPENSE_CATEGORY_VALUES.includes(String(value || "") as ExpenseCategory);
}

function toExpenseCategory(value: string | null | undefined): ExpenseCategory {
  return isExpenseCategory(value) ? value : "other";
}

function formatCustomerName(customer: CustomerLookupRow | null | undefined) {
  if (!customer) {
    return "Unknown Customer";
  }

  const fullName = [customer.first_name, customer.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");

  return customer.company_name?.trim() || fullName || "Unknown Customer";
}

async function fetchCustomerLookup(customerIds: string[]) {
  if (customerIds.length === 0) {
    return new Map<string, CustomerLookupRow>();
  }

  const { data, error } = await supabase
    .from("customers")
    .select("id, first_name, last_name, company_name")
    .in("id", customerIds);

  if (error) {
    throwFinanceServiceError("Unable to load finance customers", error);
  }

  return new Map((data || []).map((row) => [row.id, row as CustomerLookupRow]));
}

async function fetchJobLookup(jobIds: string[]) {
  if (jobIds.length === 0) {
    return new Map<string, JobLookupRow>();
  }

  const { data, error } = await supabase
    .from("jobs")
    .select("id, job_name")
    .in("id", jobIds);

  if (error) {
    throwFinanceServiceError("Unable to load finance jobs", error);
  }

  return new Map((data || []).map((row) => [row.id, row as JobLookupRow]));
}

async function fetchInvoiceSummaryRows(orderMode: "receivables" | "revenue") {
  let query = supabase
    .from("invoice_payment_summary")
    .select("invoice_id, customer_id, job_id, invoice_number, invoice_date, due_date, total_amount, status, amount_paid, balance_due");

  query = orderMode === "revenue"
    ? query.order("invoice_date", { ascending: false })
    : query.order("due_date", { ascending: true })
      .order("invoice_date", { ascending: false });

  const { data, error } = await query;

  if (error) {
    throwFinanceServiceError(
      orderMode === "revenue" ? "Unable to load revenue invoices" : "Unable to load receivables",
      error
    );
  }

  return (data || []) as FinanceRevenueSourceRow[];
}

async function fetchPaymentRows() {
  const { data, error } = await supabase
    .from("payments")
    .select("id, invoice_id, payment_date, amount, payment_method, reference_number, notes, created_at")
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throwFinanceServiceError("Unable to load payments", error);
  }

  return (data || []) as PaymentRow[];
}

async function fetchExpenseRows() {
  const { data, error } = await supabase
    .from("expenses")
    .select("id, job_id, expense_date, category, vendor, description, amount, payment_method, receipt_url, notes, created_at, updated_at")
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throwFinanceServiceError("Unable to load expenses", error);
  }

  return (data || []) as ExpenseRow[];
}

export async function fetchFinanceOverviewSummary(): Promise<FinanceOverviewSummary> {
  const { data, error } = await supabase
    .from("finance_dashboard_summary")
    .select("total_revenue, unpaid_balance, total_expenses, net_profit")
    .maybeSingle();

  if (error) {
    throwFinanceServiceError("Unable to load finance overview summary", error);
  }

  const row = (data || null) as FinanceOverviewSummaryRow | null;

  return {
    totalRevenue: toMoney(row?.total_revenue),
    unpaidBalance: toMoney(row?.unpaid_balance),
    totalExpenses: toMoney(row?.total_expenses),
    netProfit: toMoney(row?.net_profit),
  };
}

function mapReceivables(
  summaryRows: FinanceRevenueSourceRow[],
  customerLookup: Map<string, CustomerLookupRow>,
  jobLookup: Map<string, JobLookupRow>
) {
  return summaryRows.map((row) => {
    const customerName = formatCustomerName(customerLookup.get(row.customer_id));
    const jobName = row.job_id ? jobLookup.get(row.job_id)?.job_name?.trim() || "" : "";
    const invoiceNumber = toInvoiceNumber(row.invoice_number);
    const project = jobName || invoiceNumber;
    const invoiceProject = [invoiceNumber, jobName].filter(Boolean).join(" - ") || invoiceNumber;

    return {
      invoiceId: row.invoice_id,
      customerId: row.customer_id,
      jobId: row.job_id,
      invoiceNumber,
      invoiceDate: row.invoice_date,
      dueDate: row.due_date,
      totalAmount: toMoney(row.total_amount),
      amountPaid: toMoney(row.amount_paid),
      balanceDue: toMoney(row.balance_due),
      status: resolveInvoiceStatusLabel(row),
      customer: customerName,
      project,
      invoiceProject,
    } satisfies FinanceReceivableRecord;
  });
}

function mapRevenueItems(
  summaryRows: FinanceRevenueSourceRow[],
  customerLookup: Map<string, CustomerLookupRow>
) {
  return summaryRows.map((row) => ({
    invoiceId: row.invoice_id,
    customerId: row.customer_id,
    jobId: row.job_id,
    invoiceNumber: toInvoiceNumber(row.invoice_number),
    invoiceDate: row.invoice_date,
    dueDate: row.due_date,
    totalAmount: toMoney(row.total_amount),
    amountPaid: toMoney(row.amount_paid),
    balanceDue: toMoney(row.balance_due),
    rawStatus: row.status,
    statusLabel: resolveInvoiceStatusLabel(row),
    customerName: formatCustomerName(customerLookup.get(row.customer_id)),
  } satisfies FinanceRevenueRecord));
}

function mapPayments(
  paymentRows: PaymentRow[],
  receivables: FinanceReceivableRecord[]
) {
  const receivableByInvoiceId = new Map(receivables.map((row) => [row.invoiceId, row]));
  const historicalBalanceByPaymentId = new Map<string, number>();
  const paymentsByInvoiceId = new Map<string, PaymentRow[]>();

  for (const paymentRow of paymentRows) {
    const existingRows = paymentsByInvoiceId.get(paymentRow.invoice_id) || [];
    existingRows.push(paymentRow);
    paymentsByInvoiceId.set(paymentRow.invoice_id, existingRows);
  }

  for (const [invoiceId, invoicePayments] of paymentsByInvoiceId.entries()) {
    const receivable = receivableByInvoiceId.get(invoiceId);
    const totalAmount = receivable?.totalAmount;

    if (typeof totalAmount !== "number") {
      continue;
    }

    const orderedPayments = [...invoicePayments].sort((left, right) => {
      const paymentDateCompare = String(left.payment_date || "").localeCompare(String(right.payment_date || ""));
      if (paymentDateCompare !== 0) return paymentDateCompare;

      const createdAtCompare = String(left.created_at || "").localeCompare(String(right.created_at || ""));
      if (createdAtCompare !== 0) return createdAtCompare;

      return String(left.id || "").localeCompare(String(right.id || ""));
    });

    let cumulativePaid = 0;

    for (const orderedPayment of orderedPayments) {
      cumulativePaid += toMoney(orderedPayment.amount);
      historicalBalanceByPaymentId.set(orderedPayment.id, Math.max(totalAmount - cumulativePaid, 0));
    }
  }

  return paymentRows.map((row) => {
    const receivable = receivableByInvoiceId.get(row.invoice_id);
    const customerJob = receivable
      ? `${receivable.customer} - ${receivable.project}`
      : `Invoice ${row.invoice_id.slice(0, 8).toUpperCase()}`;

    return {
      id: row.id,
      invoiceId: row.invoice_id,
      date: row.payment_date,
      amount: toMoney(row.amount),
      method: row.payment_method?.trim() || "-",
      reference: row.reference_number?.trim() || "",
      notes: row.notes?.trim() || "",
      createdAt: row.created_at,
      customerJob,
      remainingBalance: historicalBalanceByPaymentId.get(row.id) ?? receivable?.balanceDue ?? 0,
    } satisfies FinancePaymentRecord;
  });
}

function mapExpenses(expenseRows: ExpenseRow[]) {
  return expenseRows.map((row) => ({
    id: row.id,
    jobId: row.job_id,
    expenseDate: row.expense_date,
    category: toExpenseCategory(row.category),
    vendor: row.vendor?.trim() || "",
    description: row.description?.trim() || "",
    amount: toMoney(row.amount),
    paymentMethod: row.payment_method?.trim() || "",
    receiptUrl: row.receipt_url?.trim() || "",
    notes: row.notes?.trim() || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } satisfies FinanceExpenseRecord));
}

export async function fetchFinancePaymentsSnapshot(): Promise<FinancePaymentsSnapshot> {
  const summaryRows = await fetchInvoiceSummaryRows("receivables");

  const customerIds = [...new Set(summaryRows.map((row) => row.customer_id).filter(Boolean))];
  const jobIds = [...new Set(summaryRows.map((row) => row.job_id).filter((value): value is string => !!value))];

  const [customerLookup, jobLookup, paymentRows] = await Promise.all([
    fetchCustomerLookup(customerIds),
    fetchJobLookup(jobIds),
    fetchPaymentRows(),
  ]);

  const receivables = mapReceivables(summaryRows, customerLookup, jobLookup);
  const payments = mapPayments(paymentRows, receivables);

  return { receivables, payments };
}

export async function fetchFinanceRevenueSnapshot(): Promise<FinanceRevenueSnapshot> {
  const summaryRows = await fetchInvoiceSummaryRows("revenue");
  const customerIds = [...new Set(summaryRows.map((row) => row.customer_id).filter(Boolean))];
  const customerLookup = await fetchCustomerLookup(customerIds);

  return {
    items: mapRevenueItems(summaryRows, customerLookup),
  };
}

export async function fetchFinanceExpensesSnapshot(): Promise<FinanceExpensesSnapshot> {
  const expenseRows = await fetchExpenseRows();
  return {
    expenses: mapExpenses(expenseRows),
  };
}

export async function createPayment(input: CreatePaymentInput) {
  const { error } = await supabase
    .from("payments")
    .insert({
      invoice_id: input.invoiceId,
      payment_date: input.paymentDate,
      amount: input.amount,
      payment_method: input.paymentMethod || null,
      reference_number: input.referenceNumber?.trim() || null,
      notes: input.notes?.trim() || null,
    });

  if (error) {
    throwFinanceServiceError("Unable to save payment", error);
  }
}

export async function createExpense(input: CreateExpenseInput) {
  const { error } = await supabase
    .from("expenses")
    .insert({
      job_id: input.jobId || null,
      expense_date: input.expenseDate,
      category: input.category,
      vendor: input.vendor?.trim() || null,
      description: input.description.trim(),
      amount: input.amount,
      payment_method: input.paymentMethod?.trim() || null,
      receipt_url: input.receiptUrl?.trim() || null,
      notes: input.notes?.trim() || null,
    });

  if (error) {
    throwFinanceServiceError("Unable to save expense", error);
  }
}
