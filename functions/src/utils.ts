// Modular Admin SDK bootstrap (ESM-safe, no race conditions)
import { getApps, initializeApp, App } from "firebase-admin/app";
import {
  getFirestore,
  FieldValue,
  Timestamp,
  FieldPath,
  Firestore,
} from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";
import { getStorage, Storage } from "firebase-admin/storage";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";

// Create (or reuse) the default app synchronously and KEEP A HANDLE
const app: App = getApps()[0] ?? initializeApp();

// Always pass the app instance explicitly
export const db: Firestore = getFirestore(app);
export const auth: Auth = getAuth(app);
export const storage: Storage = getStorage(app);

// Re-export common helpers so other files never reach into admin.* directly
export { FieldValue, Timestamp, FieldPath };


/**
 * Asserts that the caller has one of the specified roles.
 * @param {CallableRequest} req - The request object.
 * @param {string[]} roles - The allowed roles.
 * @throws {HttpsError} - If the user is not authenticated or does not have the required role.
 * @returns {string} The role of the user.
 */
export function requireRole(req: CallableRequest, roles: string[]): Role {
  const uid = req.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }
  const role = req.auth?.token.role as Role;
  if (!roles.includes(role)) {
    throw new HttpsError(
      "permission-denied",
      `You must have one of the following roles: ${roles.join(", ")}.`
    );
  }
  return role;
}

// Define roles
export type Role = "admin" | "manager" | "staff";
export const ALL_ROLES: Role[] = ["admin", "manager", "staff"];
export const STAFF_ROLES: Role[] = ["admin", "manager", "staff"];
