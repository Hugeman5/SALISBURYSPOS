
import * as admin from "firebase-admin";
import type {https} from "firebase-functions/v2";

export type Role = "admin" | "manager" | "cashier" | "waiter" | "kitchen";

export function requireRole(context: https.CallableRequest, allowed: Role[]) {
  const role = context.auth?.token?.role as Role | undefined;
  if (!role || !allowed.includes(role)) {
    throw new Error("PERMISSION_DENIED");
  }
  return role;
}

export const db = admin.firestore();
