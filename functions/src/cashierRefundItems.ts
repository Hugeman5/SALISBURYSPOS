import { onCall } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

interface RefundLine { lineId: string; qty: number; reason: string; note?: string }
interface Payload { orderId: string; lines: RefundLine[]; method: 'cash' | 'card' | 'store_credit'; }

export const cashierRefundItems = onCall<Payload>(async (req) => {
  const ctx = req.auth; if (!ctx) throw new Error('UNAUTHENTICATED');
  const role = (ctx.token as any)?.role; if (!['admin','manager','cashier'].includes(role)) throw new Error('PERMISSION_DENIED');
  const { orderId, lines, method } = req.data || {};
  if (!orderId || !Array.isArray(lines) || !method) throw new Error('BAD_REQUEST');

  const db = getFirestore();
  const orderRef = db.collection('orders').doc(orderId);
  const retRef   = db.collection('returns_ledger').doc();

  await db.runTransaction(async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) throw new Error('ORDER_NOT_FOUND');
    const order = orderSnap.data() as any;

    // compute refund amount from order lines
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

    // write returns ledger (audit)
    tx.set(retRef, {
      id: retRef.id,
      orderId,
      lines,
      method,
      amountCents: refundCents,
      userId: ctx.uid,
      createdAt: new Date().toISOString(),
    });

    // update order aggregates
    tx.update(orderRef, {
      refundsCents: FieldValue.increment(refundCents),
      status: (order.totalPaidCents || 0) - ((order.refundsCents || 0) + refundCents) > 0 ? 'partially_refunded' : 'refunded',
    });
  });

  return { ok: true };
});
