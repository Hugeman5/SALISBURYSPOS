import { onCall as onCallDisc } from 'firebase-functions/v2/https';
import { getFirestore as getDbDisc, FieldValue as FV } from 'firebase-admin/firestore';
import { DISCOUNT_APPROVAL_PERCENT } from './config';


export const cashierApplyDiscount = onCallDisc<{ orderId: string; lineId: string; discountType: 'percent'|'amount'|'comp'|'promo'|'bogo'; discountValue: number; reason?: string }>(async (req) => {
const ctx = req.auth; if (!ctx) throw new Error('UNAUTH');
const role = (ctx.token as any)?.role; if (!['admin','manager','cashier'].includes(role)) throw new Error('FORBIDDEN');
const { orderId, lineId, discountType, discountValue, reason } = req.data || {} as any;
if (!orderId || !lineId || !discountType) throw new Error('BAD_REQUEST');


const db = getDbDisc(); const oRef = db.collection('orders').doc(orderId); const snap = await oRef.get(); if (!snap.exists) throw new Error('ORDER_NOT_FOUND');
const order: any = snap.data(); const line = (order.lines||[]).find((l:any)=>l.lineId===lineId); if (!line) throw new Error('LINE_NOT_FOUND');
const ext = (line.unitPriceCents||0) * (line.qty||1);
let pct=0, discountCents=0;
if (discountType==='percent'){ pct = discountValue; discountCents = Math.round((ext*pct)/100); }
else if (discountType==='amount'){ discountCents = Math.round(discountValue); pct = ext? Math.round((discountCents/ext)*100):0; }
else if (discountType==='comp'){ discountCents = ext; pct = 100; }
else { discountCents = Math.round(discountValue); pct = ext? Math.round((discountCents/ext)*100):0; }


if (pct >= DISCOUNT_APPROVAL_PERCENT && role === 'cashier') {
const aRef = db.collection('pending_approvals').doc();
await aRef.set({ id:aRef.id, type:'discount', status:'pending', requestedByUserId:ctx.uid, requestedAt:new Date().toISOString(), discount:{ orderId, lineId, discountType, discountValue, reason: reason||null } });
return { ok:'pending', approvalId: aRef.id } as any;
}


await oRef.update({
lines: (order.lines||[]).map((l:any)=> l.lineId===lineId ? { ...l, discountType, discountValue, discountReason: reason||null, appliedByUserId: ctx.uid } : l),
discountsCents: FV.increment(discountCents),
netSalesCents: FV.increment(-discountCents),
updatedAt: new Date().toISOString(),
} as any);
return { ok:true, discountCents };
});