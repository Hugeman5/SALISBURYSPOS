
import {onCall} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as bcrypt from "bcryptjs";
import {requireRole} from "./utils";

const db = admin.firestore();

/**
 * Admin/Manager: set/reset a user's PIN and optionally their hourly rate.
 * Hashes the PIN on the server and stores it in userSecrets/{uid}.
 * Expects: { uid: string, pin: string, hourlyRateZar?: number }
 */
export const adminSetUserPin = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin", "manager"]);
  const {uid, pin, hourlyRateZar} = req.data || {};

  if (!uid || typeof uid !== "string") {
    throw new Error("uid is required");
  }

  const updates: any = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (pin) {
    if (typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
      throw new Error("A 4-digit pin is required if provided");
    }
    updates.pinHash = await bcrypt.hash(pin, 10);
  }

  if (hourlyRateZar !== undefined) {
    if (typeof hourlyRateZar !== "number" || hourlyRateZar < 0) {
      throw new Error("hourlyRateZar must be a non-negative number if provided");
    }
    updates.hourlyRateCents = Math.round(hourlyRateZar * 100);
  }

  if (Object.keys(updates).length > 1) { // more than just timestamp
    await db.collection("userSecrets").doc(uid).set(updates, {merge: true});
  }

  return {ok: true};
});
