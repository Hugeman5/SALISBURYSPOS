import {onCall as onCallApprove} from "firebase-functions/v2/https";
import {getFirestore as getDbApprove, FieldValue as FVA} from "firebase-admin/firestore";


export const managerApprovePending = onCallApprove<{ id: string; approve: boolean; note?: string }>(async (req) => {
  const ctx = req.auth; if (!ctx) throw new Error("UNAUTH");
  const role = (ctx.token as any)?.role; if (!["admin", "manager"].includes(role)) throw new Error("FORBIDDEN");
  const {id, approve, note} = req.data || {} as any; if (!id) throw new Error("BAD_REQUEST");


  const db = getDbApprove(); const aRef = db.collection("pending_approvals").doc(id); const aSnap = await aRef.get(); if (!aSnap.exists) throw new Error("NOT_FOUND");
  const a:any = aSnap.data(); if (a.status !== "pending") throw new Error("ALREADY_DECIDED");


  if (!approve) {
    await aRef.update({status: "denied", approvedByUserId: ctx.uid, approvedAt: new Date().toISOString(), decisionNote: note||null}); return {ok: true, status: "denied"};
  }


  if (a.type === "cash_movement") {
    const {sessionId, amountCents, direction, reason, note: n} = a.cash;
    const sessRef = db.collection("register_sessions").doc(sessionId); const moveRef = db.collection("cash_movements").doc();
    const signed = direction==="in"? amountCents : -amountCents;
    await db.runTransaction(async (tx)=>{
      const s = await tx.get(sessRef); if (!s.exists) throw new Error("SESSION_NOT_FOUND"); if (s.get("status")!=="open") throw new Error("SESSION_CLOSED");
      tx.set(moveRef, {id: moveRef.id, sessionId, locationId: s.get("locationId"), userId: a.requestedByUserId, amountCents, direction, reason, note: n||null, createdAt: new Date().toISOString(), approvedByUserId: ctx.uid});
      tx.update(sessRef, {cashMovementsCents: FVA.increment(signed), updatedAt: new Date().toISOString()});
      tx.update(aRef, {status: "approved", approvedByUserId: ctx.uid, approvedAt: new Date().toISOString(), decisionNote: note||null});
    });
    return {ok: true, status: "approved"};
  }


  if (a.type === "discount") {
    const {orderId, lineId, discountType, discountValue, reason} = a.discount;
    const oRef = db.collection("orders").doc(orderId); const oSnap = await oRef.get(); if (!oSnap.exists) throw new Error("ORDER_NOT_FOUND");
    const order:any = oSnap.data(); const line = (order.lines||[]).find((l:any)=>l.lineId===lineId); if (!line) throw new Error("LINE_NOT_FOUND");
    const ext = (line.unitPriceCents||0)*(line.qty||1);
    const discountCents = discountType==="percent"? Math.round(ext*(discountValue/100)) : (discountType==="comp"? ext : Math.round(discountValue));
    await oRef.update({
      lines: (order.lines||[]).map((l:any)=> l.lineId===lineId ? {...l, discountType, discountValue, discountReason: reason||null, appliedByUserId: a.requestedByUserId, approvedByUserId: ctx.uid} : l),
      discountsCents: FVA.increment(discountCents),
      netSalesCents: FVA.increment(-discountCents),
      updatedAt: new Date().toISOString(),
    } as any);
    await aRef.update({status: "approved", approvedByUserId: ctx.uid, approvedAt: new Date().toISOString(), decisionNote: note||null});
    return {ok: true, status: "approved"};
  }


  throw new Error("UNSUPPORTED_TYPE");
});
