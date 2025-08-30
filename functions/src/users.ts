
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as bcrypt from "bcryptjs";
import {requireRole, Role} from "./utils";

const db = admin.firestore();

// --- Callable: adminUpsertUser ---
type UpsertUserPayload = {
  id: string;
  name: string;
  role: Role;
  active: boolean;
  hourlyRateZar: number;
};
export const adminUpsertUser = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin", "manager"]);
  const data = req.data as UpsertUserPayload;

  // Validation
  if (!data.id || !/^[a-z0-9-]{3,24}$/.test(data.id)) {
    throw new HttpsError("invalid-argument", "ID must be 3-24 lowercase letters, numbers, or hyphens.");
  }
  if (!data.name || data.name.length < 1 || data.name.length > 64) {
    throw new HttpsError("invalid-argument", "Name must be between 1 and 64 characters.");
  }
  const validRoles: Role[] = ["admin", "manager", "cashier", "waiter", "kitchen"];
  if (!validRoles.includes(data.role)) {
    throw new HttpsError("invalid-argument", "Invalid role specified.");
  }
  if (typeof data.hourlyRateZar !== "number" || data.hourlyRateZar < 0) {
    throw new HttpsError("invalid-argument", "Hourly rate must be a non-negative number.");
  }
  if (req.auth?.token.role !== "admin" && data.role === "admin") {
    throw new HttpsError("permission-denied", "Only an admin can assign the admin role.");
  }

  const userRef = db.collection("users").doc(data.id);
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
    // Check for ID conflict on create
    const conflictSnap = await db.collection("users").where("id", "==", data.id).limit(1).get();
    if (!conflictSnap.empty) {
      throw new HttpsError("already-exists", `A user with ID ${data.id} already exists.`);
    }
    // @ts-ignore
    userData.createdAt = admin.firestore.FieldValue.serverTimestamp();
  }

  await userRef.set(userData, {merge: true});

  return {ok: true, id: data.id};
});


// --- Callable: adminDeleteUser ---
type DeleteUserPayload = { id: string };
export const adminDeleteUser = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin"]); // Only admins can hard delete
  const data = req.data as DeleteUserPayload;
  if (!data.id) throw new HttpsError("invalid-argument", "ID is required.");

  // Deleting the user, their secret, and their auth account
  const batch = db.batch();
  batch.delete(db.collection("users").doc(data.id));
  batch.delete(db.collection("user_secrets").doc(data.id));

  await Promise.all([
    batch.commit(),
    admin.auth().deleteUser(data.id).catch((e) => console.warn(`Auth user ${data.id} not found, continuing.`)),
  ]);

  return {ok: true, id: data.id};
});


// --- Callable: adminSetUserPin ---
type SetPinPayload = { id: string; pin: string; };
export const adminSetUserPin = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin", "manager"]);
  const {id, pin} = req.data as SetPinPayload;

  if (!id || typeof id !== "string") {
    throw new HttpsError("invalid-argument", "User ID is required.");
  }
  if (typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
    throw new HttpsError("invalid-argument", "A 4-digit pin is required.");
  }

  const pinHash = await bcrypt.hash(pin, 10);

  await db.collection("user_secrets").doc(id).set({
    pinHash,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});

  return {ok: true};
});
