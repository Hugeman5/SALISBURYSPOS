
/**
 * @fileoverview User and authentication management functions.
 */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as bcrypt from "bcryptjs";
import {z} from "zod";
import {db, requireRole} from "./utils";

const UpsertUserPayloadSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(64),
  role: z.enum(["admin", "manager", "cashier", "waiter", "kitchen"]),
  active: z.boolean(),
  hourlyRateZar: z.number().min(0),
});

/**
 * A callable function for admins/managers to create or update a user profile.
 * It handles validation and ensures role permissions.
 * @param {object} req The request object.
 * @return {Promise<{ok: true, id: string}>} A promise that resolves on success.
 */
export const adminUpsertUser = onCall({cors: true}, async (req) => {
  const actorRole = requireRole(req, ["admin", "manager"]);
  const result = UpsertUserPayloadSchema.safeParse(req.data);
  if (!result.success) {
    throw new HttpsError("invalid-argument", result.error.message);
  }
  const data = result.data;

  // Additional Validation
  if (!data.id && !/^[a-z0-9-]{3,24}$/.test(data.id || "")) {
    throw new HttpsError(
      "invalid-argument",
      "On create, ID must be 3-24 lowercase letters, numbers, or hyphens."
    );
  }
  if (actorRole !== "admin" && data.role === "admin") {
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
    nameLower: data.name.toLowerCase(),
    role: data.role,
    active: data.active,
    hourlyRateCents,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const doc = await userRef.get();
  if (!doc.exists) {
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
 * @return {Promise<{ok: true, id: string}>} A promise that resolves on success.
 */
export const adminDeleteUser = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin"]);
  const {id} = z.object({id: z.string().min(1)}).parse(req.data);

  const batch = db.batch();
  batch.delete(db.collection("users").doc(id));
  batch.delete(db.collection("user_secrets").doc(id));

  await Promise.all([
    batch.commit(),
    admin.auth().deleteUser(id).catch(() => {
      functions.logger.warn(
        `Auth user ${id} not found during deletion, continuing.`
      );
    }),
  ]);

  return {ok: true, id};
});

const SetPinPayloadSchema = z.object({
  id: z.string().min(1),
  pin: z.string().regex(/^\d{4}$/),
});

/**
 * A callable function for admins/managers to set a user's 4-digit PIN.
 * @param {object} req The request object.
 * @return {Promise<{ok: true}>} A promise that resolves on success.
 */
export const adminSetUserPin = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin", "manager"]);
  const {id, pin} = SetPinPayloadSchema.parse(req.data);

  const pinHash = await bcrypt.hash(pin, 10);

  await db.collection("user_secrets").doc(id).set({
    pinHash,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});

  return {ok: true};
});
