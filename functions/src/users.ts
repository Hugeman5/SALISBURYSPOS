/**
 * @fileoverview User and authentication management functions.
 */

import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as bcrypt from "bcryptjs";
import {z} from "zod";
import {db, requireRole} from "./utils";

const UpsertUserPayloadSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(64),
  role: z.enum(["admin", "manager", "cashier", "waiter", "kitchen"]),
  active: z.boolean(),
  hourlyRateZar: z.number().min(0).optional().default(0),
});

/**
 * A callable function for admins/managers to create or update a user profile.
 * It handles validation and ensures role permissions.
 * @param {object} req The request object.
 * @return {Promise<{ok: true, id: string}>} A promise that resolves on success.
 */
export const adminUpsertUser = async (req: CallableRequest) => {
  const actorRole = requireRole(req, ["admin", "manager"]);
  const result = UpsertUserPayloadSchema.safeParse(req.data);
  if (!result.success) {
    throw new HttpsError("invalid-argument", result.error.message);
  }
  const data = result.data;
  const userId = data.id;
  const userRef = db.collection("users").doc(userId);
  const userDoc = await userRef.get();
  const isNew = !userDoc.exists;


  // Additional Validation
  if (isNew && !/^[a-z0-9-]{3,24}$/.test(data.id)) {
    const msg = "On create, ID must be 3-24 letters/numbers/hyphens.";
    throw new HttpsError("invalid-argument", msg);
  }

  if (actorRole !== "admin" && data.role === "admin") {
    throw new HttpsError(
      "permission-denied",
      "Only an admin can assign the admin role."
    );
  }

  const hourlyRateCents = Math.round(data.hourlyRateZar * 100);

  const userData: {[key: string]: unknown} = {
    name: data.name,
    nameLower: data.name.toLowerCase(),
    role: data.role,
    active: data.active,
    hourlyRateCents,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (isNew) {
    userData.createdAt = admin.firestore.FieldValue.serverTimestamp();
    await userRef.set(userData);
  } else {
    await userRef.update(userData);
  }

  return {ok: true, id: userId};
};

/**
 * A callable function for admins/managers to deactivate a user account.
 * This is a soft delete.
 * @param {object} req The request object.
 * @return {Promise<{ok: true, id: string}>} A promise that resolves on success.
 */
export const adminDeleteUser = async (req: CallableRequest) => {
  requireRole(req, ["admin", "manager"]);
  const {id} = z.object({id: z.string().min(1)}).parse(req.data);
  await db.collection("users").doc(id).update({active: false});
  return {ok: true, id};
};

const SetPinPayloadSchema = z.object({
  id: z.string().min(1),
  pin: z.string().regex(/^\d{4}$/),
});

/**
 * A callable function for admins/managers to set a user's 4-digit PIN.
 * @param {object} req The request object.
 * @return {Promise<{ok: true}>} A promise that resolves on success.
 */
export const adminSetUserPin = async (req: CallableRequest) => {
  requireRole(req, ["admin", "manager"]);
  const {id, pin} = SetPinPayloadSchema.parse(req.data);

  // Ensure user exists in Firestore before setting a pin.
  const userDoc = await db.collection("users").doc(id).get();
  if (!userDoc.exists) {
    throw new HttpsError("not-found", `User with ID ${id} not found.`);
  }

  // Ensure user exists in Firebase Auth, creating if necessary.
  try {
    await admin.auth().getUser(id);
  } catch (error: unknown) {
    const firebaseError = error as {code?: string; message?: string};
    if (firebaseError.code === "auth/user-not-found") {
      functions.logger.info(`Creating new Firebase Auth user for ${id}`);
      const userData = userDoc.data();
      await admin.auth().createUser({
        uid: id,
        displayName: userData?.name || id,
      });
    } else {
      throw new HttpsError("internal",
        firebaseError.message || "Unknown auth error");
    }
  }

  const pinHash = await bcrypt.hash(pin, 10);

  await db
    .collection("user_secrets")
    .doc(id)
    .set(
      {
        pinHash,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true}
    );

  return {ok: true};
};
