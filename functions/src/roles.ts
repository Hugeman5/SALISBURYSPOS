import type { CallableRequest } from "firebase-functions/v2/https";

// Canonical role sets (as const tuples so TypeScript narrows correctly)
export const ROLES = ["admin", "manager", "cashier", "waiter", "kitchen"] as const;
export type Role = (typeof ROLES)[number];

export const STAFF_ROLES = ["admin", "manager", "cashier", "waiter"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

// Extract role from the callable request (or null if missing)
export function getRole(req: CallableRequest<any>): Role | null {
  const r = (req.auth as any)?.token?.role;
  return (ROLES as readonly string[]).includes(r) ? (r as Role) : null;
}

// Generic guard that returns a *narrowed union* of allowed roles
export function requireRole<T extends readonly Role[]>(
  req: CallableRequest<any>,
  allowed: T
): T[number] {
  const role = getRole(req);
  if (!role || !allowed.includes(role as T[number])) {
    throw new Error("permission-denied");
  }
  return role as T[number];
}
