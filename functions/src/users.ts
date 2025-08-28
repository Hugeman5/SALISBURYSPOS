import {onCall} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as bcrypt from "bcryptjs";

type Role = "admin" | "manager" | "cashier" | "waiter" | "kitchen";

function requireRole(context: any, allowed: Role[]) {
  const role = context?.auth?.token?.role as Role | undefined;
  if (!role || !allowed.includes(role)) throw new Error("PERMISSION_DENIED");
  return role;
}

const db = admin.firestore();

/**
 * Admin/Manager: set/reset a user's PIN.
 * Hashes the PIN on the server and stores it in userSecrets/{uid}.
 * Expects: { uid: string, pin: string }
 */
export const adminSetUserPin = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin", "manager"]);
  const {uid, pin} = req.data || {};
  if (!uid || typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
    throw new Error("uid and a 4-digit pin are required");
  }

  const pinHash = await bcrypt.hash(pin, 10);

  await db.collection("userSecrets").doc(String(uid)).set(
    {pinHash, updatedAt: admin.firestore.FieldValue.serverTimestamp()},
    {merge: true},
  );

  return {ok: true};
});
