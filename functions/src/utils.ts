/**
 * @fileoverview Shared utilities for Firebase Functions.
 * @author Your Name
 */

import * as admin from "firebase-admin";
import {HttpsError, type CallableRequest} from "firebase-functions/v2/https";

// --- Initialize Admin once (safe if called multiple times) ---
if (!admin.apps.length) {
  admin.initializeApp();
}

/** The Firestore database instance. */
export const db = admin.firestore();

/** Defines the set of user roles in the application. */
export type Role = "admin" | "manager" | "cashier" | "waiter" | "kitchen";

/**
 * Roles that are considered staff and can access POS/admin functionality.
 */
export const STAFF_ROLES: Role[] = [
  "admin",
  "manager",
  "cashier",
  "waiter",
  "kitchen",
];

/**
 * Enforces role-based access for a callable function. Throws an HttpsError
 * if the user is not authenticated or does not have one of the allowed roles.
 * @param {CallableRequest} req The function request context.
 * @param {Role[]} allowed An array of roles that are allowed to proceed.
 * @return {Role} The role of the authenticated user.
 * @throws {HttpsError} Throws "unauthenticated" or "permission-denied".
 */
export function requireRole(req: CallableRequest, allowed: Role[]): Role {
  if (!req.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }
  const role = req.auth.token?.role as Role | undefined;
  if (!role || !allowed.includes(role)) {
    throw new HttpsError(
      "permission-denied",
      "You do not have sufficient permissions to perform this action."
    );
  }
  return role;
}
