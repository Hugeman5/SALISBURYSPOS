
import {onCall} from "firebase-functions/v2/https";
import {getFirestore, FieldValue} from "firebase-admin/firestore";

interface RefundLine {
  lineId: string;
  qty: number;
  reason: string;
  note?: string;
}
interface Payload {
  orderId: string;
  lines: RefundLine[];
  method: "cash" | "card" | "store_credit";
}

export const cashierRefundItems = onCall<Payload>(async (req) => {
  const ctx = req.auth;
  if (!ctx) throw new Error("UNAUTH");

  const role = (ctx.token as {role?: string})?.role;
  if (!["admin", "manager", "cashier"].includes(role ?? "")) {
    throw new Error("FORBIDDEN");
  }

  const {orderId, lines, method} = req.data;
  if (!orderId || !Array.isArray(lines) || !method) {
    throw new Error("BAD_REQUEST");
  }

  const db = getFirestore();
  const orderRef = db.collection("orders").doc(orderId);
  const retRef = db.collection("returns_ledger").doc();
  await db.runTransaction(async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) throw new Error("ORDER_NOT_FOUND");
    const order: any = orderSnap.data();
    const byId: Record<string, any> = {};
    for (const l of (order.lines || [])) byId[l.lineId] = l;
    let refundCents = 0;
    for (const rl of lines) {
      const ol = byId[rl.lineId];
      if (!ol) throw new Error(`LINE_NOT_FOUND:${rl.lineId}`);
      const qty = Math.min(rl.qty, ol.qty || 0);
      if (qty <= 0) continue;
      const lineRefund = Math.round((ol.unitPriceCents || 0) * qty);
      refundCents += lineRefund;
    }

    tx.set(retRef, {
      id: retRef.id, orderId, lines, method, amountCents: refundCents,
      userId: ctx.uid, createdAt: new Date().toISOString(),
    });

    if (method === "store_credit") {
      const cnRef = db.collection("credit_notes").doc();
      tx.set(cnRef, {
        id: cnRef.id, orderId, customerId: order.customerId || null,
        amountCents: refundCents, remainingCents: refundCents,
        status: "open", issuedAt: new Date().toISOString(),
        issuedByUserId: ctx.uid,
      });
    }

    const newStatus = (order.totalPaidCents || 0) -
      ((order.refundsCents || 0) + refundCents) > 0 ?
      "partially_refunded" : "refunded";

    tx.update(orderRef, {
      refundsCents: FieldValue.increment(refundCents),
      status: newStatus,
    });
  });
  return {ok: true};
});
