
import {onCall} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as bcrypt from "bcryptjs";
import {requireRole, Role, STAFF_ROLES} from "./utils";

const db = admin.firestore();

type UpsertUserPayload = {
  uid?: string;
  id?: string;
  name: string;
  role: Role;
  active: boolean;
  hourlyRateCents?: number;
  hourlyRateZAR?: number;
  pin?: string | null;
};

export const adminUpsertUser = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin", "manager"]);
  const data = req.data as UpsertUserPayload;

  const uid = (data.uid || data.id || "").trim();
  if (!uid) {
    throw new Error("uid/id is required");
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

  let hourlyRateCents = data.hourlyRateCents ?? null;
  if (hourlyRateCents == null && typeof data.hourlyRateZAR === "number") {
    hourlyRateCents = Math.round(data.hourlyRateZAR * 100);
  }
  if (hourlyRateCents == null || hourlyRateCents < 0) {
    throw new Error("hourlyRateCents is required and must be non-negative.");
  }

  // Upsert user profile
  const userRef = db.collection("users").doc(uid);
  const userDoc = {
    id: uid,
    name,
    role: roleVal,
    active,
    hourlyRateCents,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const existingUser = await userRef.get();
  if (!existingUser.exists) {
    // @ts-ignore
    userDoc.createdAt = admin.firestore.FieldValue.serverTimestamp();
  }

  await userRef.set(userDoc, {merge: true});

  // Optional PIN set/reset
  if (typeof data.pin === "string" && data.pin) {
    const pinHash = bcrypt.hashSync(data.pin, 10);
    await db.collection("userSecrets").doc(uid).set({pinHash}, {merge: true});
  }

  return {ok: true, uid};
});
