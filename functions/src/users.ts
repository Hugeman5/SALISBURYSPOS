/**
 * @fileoverview User and authentication management functions.
 */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as bcrypt from "bcryptjs";
import {db, requireRole, Role} from "./utils";

/**
 * Represents the payload for creating or updating a user.
 * The `id` is required for updates, optional for creation.
 */
interface UpsertUserPayload {
  id?: string;
  name: string;
  role: Role;
  active: boolean;
  hourlyRateZar: number;
}

/**
 * A callable function for admins/managers to create or update a user profile.
 * It handles validation and ensures role permissions.
 * @param {object} req The request object.
 * @param {UpsertUserPayload} req.data The user data.
 * @return {Promise<{ok: true, id: string}>} A promise that resolves on success.
 */
export const adminUpsertUser = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin", "manager"]);
  const data = req.data as UpsertUserPayload;

  // --- Validation ---
  if (!data.id && !/^[a-z0-9-]{3,24}$/.test(data.id || "")) {
    throw new HttpsError(
      "invalid-argument",
      "On create, ID must be 3-24 lowercase letters, numbers, or hyphens."
    );
  }
  if (!data.name || data.name.length < 1 || data.name.length > 64) {
    throw new HttpsError(
      "invalid-argument",
      "Name must be between 1 and 64 characters."
    );
  }
  const validRoles: Role[] =
    ["admin", "manager", "cashier", "waiter", "kitchen"];
  if (!validRoles.includes(data.role)) {
    throw new HttpsError("invalid-argument", "Invalid role specified.");
  }
  if (typeof data.hourlyRateZar !== "number" || data.hourlyRateZar < 0) {
    throw new HttpsError(
      "invalid-argument",
      "Hourly rate must be a non-negative number."
    );
  }
  if (req.auth?.token.role !== "admin" && data.role === "admin") {
    throw new HttpsError(
      "permission-denied",
      "Only an admin can assign the admin role."
    );
  }

  const userId = data.id || db.collection("users").doc().id;
  const userRef = db.collection("users").doc(userId);
  const hourlyRateCents = Math.round(data.hourlyRateZar * 100);

  const userData = {
    name: data.name,
    role: data.role,
    active: data.active,
    hourlyRateCents,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const doc = await userRef.get();
  if (!doc.exists) {
    // Add createdAt timestamp only for new documents
    await userRef.set({
      ...userData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    await userRef.update(userData);
  }

  return {ok: true, id: userId};
});


/**
 * A callable function for admins to permanently delete a user account.
 * This removes user profile, their secret (PIN), and their auth record.
 * @param {object} req The request object.
 * @param {string} req.data.id The ID of the user to delete.
 * @return {Promise<{ok: true, id: string}>} A promise that resolves on success.
 */
export const adminDeleteUser = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin"]); // Only admins can hard delete
  const {id} = req.data as {id?: string};
  if (!id) {
    throw new HttpsError("invalid-argument", "User ID is required.");
  }

  const batch = db.batch();
  batch.delete(db.collection("users").doc(id));
  batch.delete(db.collection("user_secrets").doc(id));

  await Promise.all([
    batch.commit(),
    admin.auth().deleteUser(id).catch(() => {
      // If auth user doesn't exist, it's not a fatal error.
      functions.logger.warn(
        `Auth user ${id} not found during deletion, continuing.`
      );
    }),
  ]);

  return {ok: true, id};
});


/**
 * A callable function for admins/managers to set a user's 4-digit PIN.
 * The PIN is hashed before being stored in a secure client-inaccessible doc.
 * @param {object} req The request object.
 * @param {string} req.data.id The user's ID.
 * @param {string} req.data.pin The user's 4-digit PIN.
 * @return {Promise<{ok: true}>} A promise that resolves on success.
 */
export const adminSetUserPin = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin", "manager"]);
  const {id, pin} = req.data as {id?: string, pin?: string};

  if (!id || typeof id !== "string") {
    throw new HttpsError("invalid-argument", "User ID is required.");
  }
  if (typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
    throw new HttpsError("invalid-argument", "A valid 4-digit PIN is required.");
  }

  const pinHash = await bcrypt.hash(pin, 10);

  await db.collection("user_secrets").doc(id).set({
    pinHash,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});

  return {ok: true};
});
