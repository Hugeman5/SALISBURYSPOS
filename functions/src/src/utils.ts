
import * as admin from "firebase-admin";
import type {https} from "firebase-functions/v2";

// Exported so other modules (e.g., timeclock.ts) can import it.
export type Role = "admin" | "manager" | "cashier" | "waiter" | "kitchen";

// Roles allowed to operate staff-facing screens/APIs.
export const STAFF_ROLES: Role[] = ["admin", "manager", "cashier", "waiter", "kitchen"];


export function requireRole(context: https.CallableRequest, allowed: Role[]) {
  const role = context.auth?.token?.role as Role | undefined;
  if (!role || !allowed.includes(role)) {
    throw new Error("PERMISSION_DENIED");
  }
  return role;
}

export const db = admin.firestore();
