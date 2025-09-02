import {onCall as onCallMove} from "firebase-functions/v2/https";
import {getFirestore as getDbMove, FieldValue} from "firebase-admin/firestore";
import {CASH_PAYOUT_APPROVAL_CENTS} from "../../config";


export const postCashMovement = onCallMove<{ sessionId?: string; locationId?: string; amountCents: number; direction: "in"|"out"; reason: string; note?: string }>(async (req) => {
  const ctx = req.auth; if (!ctx) throw new Error("UNAUTH");
  const role = (ctx.token as any)?.role; if (!["admin", "manager", "cashier"].includes(role)) throw new Error("FORBIDDEN");
  const {sessionId, locationId, amountCents, direction, reason, note} = req.data || {} as any;
  if (!amountCents || amountCents <= 0) throw new Error("BAD_AMOUNT");
  if (!["in", "out"].includes(direction)) throw new Error("BAD_DIRECTION");


  const db = getDbMove();
  let sid = sessionId as string | undefined;
  if (!sid) {
    let q: FirebaseFirestore.Query = db.collection("register_sessions").where("userId", "==", ctx.uid).where("status", "==", "open");
    if (locationId) q = q.where("locationId", "==", locationId);
    const snap = await q.limit(1).get(); if (snap.empty) throw new Error("NO_OPEN_SESSION"); sid = snap.docs[0].id;
  }


  if (direction === "out" && amountCents >= CASH_PAYOUT_APPROVAL_CENTS) {
    const aRef = db.collection("pending_approvals").doc();
    await aRef.set({id: aRef.id, type: "cash_movement", status: "pending", requestedByUserId: ctx.uid, requestedAt: new Date().toISOString(), cash: {sessionId: sid, amountCents, direction, reason, note: note||null}});
    return {ok: "pending", approvalId: aRef.id} as any;
  }


  const sessRef = db.collection("register_sessions").doc(String(sid));
  const moveRef = db.collection("cash_movements").doc();
  const signed = direction === "in" ? amountCents : -amountCents;
  await db.runTransaction(async (tx)=>{
    const s = await tx.get(sessRef); if (!s.exists) throw new Error("SESSION_NOT_FOUND"); if (s.get("status")!=="open") throw new Error("SESSION_CLOSED");
    tx.set(moveRef, {id: moveRef.id, sessionId: sid, locationId: s.get("locationId"), userId: ctx.uid, amountCents, direction, reason, note: note||null, createdAt: new Date().toISOString()});
    tx.update(sessRef, {cashMovementsCents: FieldValue.increment(signed), updatedAt: new Date().toISOString()});
  });
  return {ok: true, sessionId: sid};
});
