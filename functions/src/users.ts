/**
 * @fileoverview User and authentication management functions.
 */

import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import {auth, db, requireRole, FieldValue} from "./utils.js";
import * as bcrypt from "bcryptjs";
import {z} from "zod";

type Req<T = any> = CallableRequest<T>;

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
export const adminUpsertUser = onCall({ cors: true }, async (req: Req<z.infer<typeof UpsertUserPayloadSchema>>) => {
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
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (isNew) {
    userData.createdAt = FieldValue.serverTimestamp();
    await userRef.set(userData);
  } else {
    await userRef.update(userData);
  }

  return {ok: true, id: userId};
});

/**
 * A callable function for admins/managers to deactivate a user account.
 * This is a soft delete.
 * @param {object} req The request object.
 * @return {Promise<{ok: true, id: string}>} A promise that resolves on success.
 */
export const adminDeleteUser = onCall({ cors: true }, async (req: Req<{id: string}>) => {
  requireRole(req, ["admin", "manager"]);
  const {id} = z.object({id: z.string().min(1)}).parse(req.data);
  await db.collection("users").doc(id).update({active: false});
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
export const adminSetUserPin = onCall({ cors: true }, async (req: Req<z.infer<typeof SetPinPayloadSchema>>) => {
  requireRole(req, ["admin", "manager"]);
  const {id, pin} = SetPinPayloadSchema.parse(req.data);

  // Ensure user exists in Firestore before setting a pin.
  const userDoc = await db.collection("users").doc(id).get();
  if (!userDoc.exists) {
    throw new HttpsError("not-found", `User with ID ${id} not found.`);
  }

  // Ensure user exists in Firebase Auth, creating if necessary.
  try {
    await auth.getUser(id);
  } catch (error: unknown) {
    const firebaseError = error as {code?: string; message?: string};
    if (firebaseError.code === "auth/user-not-found") {
      const userData = userDoc.data();
      await auth.createUser({
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
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true}
    );

  return {ok: true};
});
