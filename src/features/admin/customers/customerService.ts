import { supabase } from "../../../lib/supabase";

export interface AdminCustomerRecord {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  customer_type: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface SupabaseErrorSummary {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

export class CustomerServiceError extends Error {
  supabaseError: SupabaseErrorSummary;

  constructor(context: string, error: unknown) {
    const supabaseError = summarizeSupabaseError(error);
    super(`${context}: ${supabaseError.message || "Supabase request failed."}`);
    this.name = "CustomerServiceError";
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

function throwCustomerServiceError(context: string, error: unknown): never {
  const serviceError = new CustomerServiceError(context, error);

  console.error(context, {
    message: serviceError.supabaseError.message,
    code: serviceError.supabaseError.code,
    details: serviceError.supabaseError.details,
    hint: serviceError.supabaseError.hint,
  });

  throw serviceError;
}

const CUSTOMER_SELECT = `
  id,
  first_name,
  last_name,
  company_name,
  phone,
  email,
  street_address,
  city,
  state,
  zip_code,
  customer_type,
  notes,
  created_at,
  updated_at
`;

export function normalizeCustomerText(value: string | null | undefined) {
  return value?.trim() || "";
}

export function formatCustomerTypeLabel(customerType: string | null | undefined) {
  switch (normalizeCustomerText(customerType).toLowerCase()) {
    case "builder":
      return "Builder";
    case "commercial":
      return "Commercial";
    case "residential":
    default:
      return "Residential";
  }
}

export function formatCustomerDisplayName(customer: AdminCustomerRecord) {
  const customerType = normalizeCustomerText(customer.customer_type).toLowerCase();
  const firstName = normalizeCustomerText(customer.first_name);
  const lastName = normalizeCustomerText(customer.last_name);
  const companyName = normalizeCustomerText(customer.company_name);
  const personName = [firstName, lastName].filter(Boolean).join(" ").trim();

  if ((customerType === "builder" || customerType === "commercial") && companyName) {
    return companyName;
  }

  if (personName) {
    return personName;
  }

  if (firstName) {
    return firstName;
  }

  if (companyName) {
    return companyName;
  }

  return "Unnamed customer";
}

export interface CustomerContactLink {
  display: string;
  href: string | null;
}

function toUsPhoneParts(digits: string) {
  return {
    areaCode: digits.slice(0, 3),
    prefix: digits.slice(3, 6),
    lineNumber: digits.slice(6, 10),
  };
}

export function formatCustomerPhoneLink(phoneValue: string | null | undefined): CustomerContactLink {
  const trimmedValue = normalizeCustomerText(phoneValue);

  if (!trimmedValue) {
    return { display: "—", href: null };
  }

  const normalizedDigits = trimmedValue.replace(/[\s().-]/g, "");

  if (/^\d{10}$/.test(normalizedDigits)) {
    const { areaCode, prefix, lineNumber } = toUsPhoneParts(normalizedDigits);
    return {
      display: `(${areaCode}) ${prefix}-${lineNumber}`,
      href: `tel:${normalizedDigits}`,
    };
  }

  if (/^\+?1\d{10}$/.test(normalizedDigits)) {
    const dialDigits = normalizedDigits.replace(/^\+/, "");
    const { areaCode, prefix, lineNumber } = toUsPhoneParts(dialDigits.slice(1));
    return {
      display: `+1 (${areaCode}) ${prefix}-${lineNumber}`,
      href: `tel:+${dialDigits}`,
    };
  }

  return {
    display: trimmedValue,
    href: null,
  };
}

export function formatCustomerEmailLink(emailValue: string | null | undefined): CustomerContactLink {
  const trimmedValue = normalizeCustomerText(emailValue);

  if (!trimmedValue) {
    return { display: "—", href: null };
  }

  return {
    display: trimmedValue,
    href: `mailto:${trimmedValue}`,
  };
}

export function buildCustomerSearchText(customer: AdminCustomerRecord) {
  return [
    formatCustomerDisplayName(customer),
    customer.first_name,
    customer.last_name,
    customer.company_name,
    customer.phone,
    customer.email,
    customer.street_address,
    customer.city,
    customer.state,
    customer.zip_code,
  ]
    .map((value) => normalizeCustomerText(value))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export async function fetchCustomers(): Promise<AdminCustomerRecord[]> {
  const { data, error } = await supabase
    .from("customers")
    .select(CUSTOMER_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    throwCustomerServiceError("Unable to load customers", error);
  }

  return (data || []) as AdminCustomerRecord[];
}
