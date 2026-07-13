export type AppRole = "owner" | "admin" | "office" | "field";

export const FULL_ACCESS_ROLES: AppRole[] = ["owner", "admin"];
export const ESTIMATE_ACCESS_ROLES: AppRole[] = ["owner", "admin", "office"];
export const CALENDAR_VIEW_ROLES: AppRole[] = ["owner", "admin", "office", "field"];
export const CALENDAR_MANAGE_ROLES: AppRole[] = ["owner", "admin", "office"];
export const FINANCE_ACCESS_ROLES: AppRole[] = ["owner", "admin", "office"];

export function isAppRole(value: string | null | undefined): value is AppRole {
  return value === "owner" || value === "admin" || value === "office" || value === "field";
}

export function canAccessEstimates(role: AppRole | null) {
  return !!role && ESTIMATE_ACCESS_ROLES.includes(role);
}

export function canViewCalendar(role: AppRole | null) {
  return !!role && CALENDAR_VIEW_ROLES.includes(role);
}

export function canManageCalendar(role: AppRole | null) {
  return !!role && CALENDAR_MANAGE_ROLES.includes(role);
}

export function canAccessFinance(role: AppRole | null) {
  return !!role && FINANCE_ACCESS_ROLES.includes(role);
}

export function hasFullAccess(role: AppRole | null) {
  return !!role && FULL_ACCESS_ROLES.includes(role);
}
