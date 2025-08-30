import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {requireRole, type Role} from "./utils";

// Initialize Admin SDK once (safe across hot reloads / multiple files)
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * Open/close a cash register session.
 * Data payload:
 *  - action: "open" | "close"
 *  - registerId?: string        (required for "open")
 *  - openingFloat?: number      (required for "open")
 *  - sessionId?: string         (required for "close")
 *  - countedCash?: number       (required for "close")
 */
export const manageRegisterSession = onCall({cors: true}, async (req) => {
  // Enforce role first (also ensures req.auth is present)
  requireRole(req, ["admin", "manager"] as Role[]);

  const auth = req.auth!;
  const uid = auth.uid;
  const token = auth.token as { name?: string; email?: string } | undefined;
  const actorName = token?.name || token?.email || uid;

  const {action} = req.data || {};
  if (action !== "open" && action !== "close") {
    throw new HttpsError("invalid-argument", "Invalid action specified.");
  }

  if (action === "open") {
    const {registerId, openingFloat} = req.data as {
      registerId?: string;
      openingFloat?: number;
    };

    if (!registerId || typeof openingFloat !== "number" || isNaN(openingFloat)) {
      throw new HttpsError(
        "invalid-argument",
        "Register ID and numeric opening float are required."
      );
    }

    // Only one open session per register
    const openSnap = await db
      .collection("register_sessions")
      .where("registerId", "==", registerId)
      .where("status", "==", "open")
      .limit(1)
      .get();

    if (!openSnap.empty) {
      throw new HttpsError(
        "failed-precondition",
        "An open session already exists for this register. Please close it first."
      );
    }

    const sessionRef = db.collection("register_sessions").doc();
    await sessionRef.set({
      registerId,
      status: "open",
      openedAt: admin.firestore.FieldValue.serverTimestamp(),
      openedBy: {uid, name: actorName},
      openingFloat,
      expectedCash: openingFloat,
      // Use a subcollection for movements; we keep this top-level array out to avoid duplication
    });

    return {ok: true, sessionId: sessionRef.id};
  }

  if (action === "close") {
    const {sessionId, countedCash} = req.data as {
      sessionId?: string;
      countedCash?: number;
    };

    if (!sessionId || typeof countedCash !== "number" || isNaN(countedCash)) {
      throw new HttpsError(
        "invalid-argument",
        "Session ID and numeric counted cash amount are required."
      );
    }

    const sessionRef = db.collection("register_sessions").doc(sessionId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) {
      throw new HttpsError("not-found", "Session not found.");
    }
    const session = sessionSnap.data()!;
    if (session.status !== "open") {
      throw new HttpsError("failed-precondition", "Session is not open.");
    }

    const expectedCash = Number(session.expectedCash) || 0;
    const overShort = countedCash - expectedCash;

    await sessionRef.update({
      status: "closed",
      closedAt: admin.firestore.FieldValue.serverTimestamp(),
      closedBy: {uid, name: actorName},
      countedCash,
      overShort,
    });

    return {ok: true, overShort};
  }

  // Should be unreachable due to earlier guard
  throw new HttpsError("invalid-argument", "Invalid action.");
});

/**
 * Record a pay-in / pay-out movement against an OPEN register session.
 * Data payload:
 *  - sessionId: string
 *  - type: "payin" | "payout"
 *  - amount: number (positive)
 *  - reason: string
 */
export const postCashMovement = onCall({cors: true}, async (req) => {
  // Enforce role first
  requireRole(req, ["admin", "manager"] as Role[]);

  const auth = req.auth!;
  const uid = auth.uid;
  const token = auth.token as { name?: string; email?: string } | undefined;
  const actorName = token?.name || token?.email || uid;

  const {sessionId, type, amount, reason} = (req.data || {}) as {
    sessionId?: string;
    type?: "payin" | "payout" | string;
    amount?: number;
    reason?: string;
  };

  if (!sessionId || !type || typeof amount !== "number" || !reason) {
    throw new HttpsError("invalid-argument", "Missing required fields.");
  }
  if (type !== "payin" && type !== "payout") {
    throw new HttpsError("invalid-argument", "Invalid movement type.");
  }
  if (!(amount > 0)) {
    throw new HttpsError(
      "invalid-argument",
      "Amount must be a positive number."
    );
  }

  const sessionRef = db.collection("register_sessions").doc(sessionId);
  const movementRef = sessionRef.collection("cash_movements").doc();

  const delta = type === "payin" ? amount : -amount;

  await db.runTransaction(async (tx) => {
    const s = await tx.get(sessionRef);
    if (!s.exists) {
      throw new HttpsError("not-found", "Session not found.");
    }
    const session = s.data()!;
    if (session.status !== "open") {
      throw new HttpsError("failed-precondition", "Session is not open.");
    }

    const currentExpected = Number(session.expectedCash) || 0;
    const newExpected = currentExpected + delta;

    tx.update(sessionRef, {expectedCash: newExpected});
    tx.set(movementRef, {
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      by: {uid, name: actorName},
      type, // "payin" | "payout"
      amount: delta, // stored signed
      reason,
    });
  });

  return {ok: true};
});
