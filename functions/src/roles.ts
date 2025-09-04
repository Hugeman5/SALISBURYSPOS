import type { CallableRequest } from "firebase-functions/v2/https";

export const ROLES       = ["admin","manager","cashier","waiter","kitchen"] as const;
export const ADMIN_ROLES = ["admin","manager"] as const;
export const STAFF_ROLES = ["admin","manager","cashier","waiter"] as const;

export type Role      = (typeof ROLES)[number];
export type AdminRole = (typeof ADMIN_ROLES)[number];
export type StaffRole = (typeof STAFF_ROLES)[number];

export function getRole(req: CallableRequest<any>): Role | null {
  const r = (req.auth as any)?.token?.role;
  return (ROLES as readonly string[]).includes(r) ? (r as Role) : null;
}

export function requireRole<T extends readonly Role[]>(
  req: CallableRequest<any>, allowed: T
): T[number] {
  const role = getRole(req);
  if (!role || !allowed.includes(role as T[number])) {
    const e: any = new Error("permission-denied");
    e.code = "permission-denied";
    throw e;
  }
  return role as T[number];
}
