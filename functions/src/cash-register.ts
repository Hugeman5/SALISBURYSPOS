/**
 * @fileoverview Cloud Functions for cash register session management.
 */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {db, requireRole} from "./utils";

/**
 * Manages cash register sessions (opening and closing).
 * This function is dispatched based on the 'action' property in the payload.
 */
export const manageRegisterSession = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin", "manager"]);
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Auth is required.");

  const actorName = req.auth?.token?.name || req.auth?.token?.email || uid;
  const {action} = req.data as {action?: "open" | "close"};

  if (action === "open") {
    const {registerId, openingFloat} = req.data as {
      registerId?: string; openingFloat?: number;
    };
    if (!registerId || typeof openingFloat !== "number" || isNaN(openingFloat)) {
      throw new HttpsError(
        "invalid-argument", "Register ID and opening float are required."
      );
    }

    const openSnap = await db.collection("register_sessions")
      .where("registerId", "==", registerId)
      .where("status", "==", "open").limit(1).get();
    if (!openSnap.empty) {
      throw new HttpsError(
        "failed-precondition", "This register already has an open session."
      );
    }

    const sessionRef = db.collection("register_sessions").doc();
    await sessionRef.set({
      registerId, status: "open",
      openedAt: admin.firestore.FieldValue.serverTimestamp(),
      openedBy: {uid, name: actorName},
      openingFloat, expectedCash: openingFloat,
    });
    return {ok: true, sessionId: sessionRef.id};
  }

  if (action === "close") {
    const {sessionId, countedCash} = req.data as {
      sessionId?: string; countedCash?: number;
    };
    if (!sessionId || typeof countedCash !== "number" || isNaN(countedCash)) {
      throw new HttpsError(
        "invalid-argument", "Session ID and counted cash are required."
      );
    }
    const sessionRef = db.collection("register_sessions").doc(sessionId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) throw new HttpsError("not-found", "Session not found.");
    const session = sessionSnap.data() || {};
    if (session.status !== "open") {
      throw new HttpsError("failed-precondition", "Session is not open.");
    }

    const expectedCash = Number(session.expectedCash) || 0;
    const overShort = countedCash - expectedCash;
    await sessionRef.update({
      status: "closed",
      closedAt: admin.firestore.FieldValue.serverTimestamp(),
      closedBy: {uid, name: actorName},
      countedCash, overShort,
    });
    return {ok: true, overShort};
  }

  throw new HttpsError("invalid-argument", "Invalid action specified.");
});

/**
 * Records a cash movement (pay-in or pay-out) for an open session.
 * This function transactionally updates the session's expected cash total.
 */
export const postCashMovement = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin", "manager"]);
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Auth is required.");

  const actorName = req.auth?.token?.name || req.auth?.token?.email || uid;
  const {sessionId, type, amount, reason} = req.data as {
    sessionId?: string; type?: "payin" | "payout";
    amount?: number; reason?: string;
  };

  if (!sessionId || !type || typeof amount !== "number" || !reason) {
    throw new HttpsError("invalid-argument", "Missing required fields.");
  }
  if (type !== "payin" && type !== "payout") {
    throw new HttpsError("invalid-argument", "Invalid movement type.");
  }
  if (!(amount > 0)) {
    throw new HttpsError("invalid-argument", "Amount must be positive.");
  }

  const sessionRef = db.collection("register_sessions").doc(sessionId);
  const movementRef = sessionRef.collection("cash_movements").doc();
  const delta = type === "payin" ? amount : -amount;

  await db.runTransaction(async (tx) => {
    const s = await tx.get(sessionRef);
    if (!s.exists) throw new HttpsError("not-found", "Session not found.");
    const session = s.data() || {};
    if (session.status !== "open") {
      throw new HttpsError("failed-precondition", "Session is not open.");
    }
    const newExpected = (Number(session.expectedCash) || 0) + delta;
    tx.update(sessionRef, {expectedCash: newExpected});
    tx.set(movementRef, {
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      by: {uid, name: actorName}, type, amount: delta, reason,
    });
  });

  return {ok: true};
});
