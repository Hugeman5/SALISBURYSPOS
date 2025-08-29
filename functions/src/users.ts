
import {onCall} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as bcrypt from "bcryptjs";
import {requireRole, Role, STAFF_ROLES} from "./utils";

const db = admin.firestore();

type UpsertUserPayload = {
  id?: string;
  name: string;
  role: Role;
  active: boolean;
  hourlyRateCents?: number;
  hourlyRateZar?: number; // Kept for compatibility if client sends it
  pin?: string | null;
};

export const adminUpsertUser = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin", "manager"]);
  const data = req.data as UpsertUserPayload;
  
  const uid = data.id;
  if (!uid) {
    throw new Error("id is required");
  }

  const name = (data.name || "").trim();
  if (!name) {
    throw new Error("name is required");
  }

  const roleVal = data.role as Role;
  if (!STAFF_ROLES.includes(roleVal)) {
    throw new Error("Invalid role provided");
  }

  const active = !!data.active;

  let hourlyRateCents = data.hourlyRateCents;
  if (hourlyRateCents === undefined && typeof data.hourlyRateZar === "number") {
    hourlyRateCents = Math.round(data.hourlyRateZar * 100);
  }

  const userRef = db.collection("users").doc(uid);
  const userDoc: any = {
    name,
    role: roleVal,
    active,
    hourlyRateCents: hourlyRateCents ?? 0,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const existingUser = await userRef.get();
  if (!existingUser.exists) {
    userDoc.createdAt = admin.firestore.FieldValue.serverTimestamp();
  }

  await userRef.set(userDoc, { merge: true });
  
  return {ok: true, uid };
});


export const adminSetUserPin = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin", "manager"]);
  const {uid, pin, hourlyRateZar} = req.data || {};

  if (!uid || typeof uid !== "string") {
    throw new Error("uid is required");
  }
  
  const updates: any = {};
  const secretUpdates: any = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (pin) {
    if (typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
      throw new Error("A 4-digit pin is required if provided");
    }
    secretUpdates.pinHash = await bcrypt.hash(pin, 10);
  }

  if (hourlyRateZar !== undefined) {
    if (typeof hourlyRateZar !== "number" || hourlyRateZar < 0) {
      throw new Error("hourlyRateZar must be a non-negative number if provided");
    }
    updates.hourlyRateCents = Math.round(hourlyRateZar * 100);
  }

  const batch = db.batch();
  
  if (Object.keys(updates).length > 0) {
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    batch.set(db.collection("users").doc(uid), updates, { merge: true });
  }

  if (Object.keys(secretUpdates).length > 1) { // more than just timestamp
    batch.set(db.collection("userSecrets").doc(uid), secretUpdates, { merge: true });
  }

  await batch.commit();

  return {ok: true};
});
