import { getFirestore as getDbCN, FieldValue as FVCN } from 'firebase-admin/firestore';
import { onCall as onCallCN } from 'firebase-functions/v2/https';


export const issueCreditNote = onCallCN<{ orderId: string; amountCents: number; customerId?: string }>(async (req) => {
const ctx = req.auth; if (!ctx) throw new Error('UNAUTH');
const role = (ctx.token as any)?.role; if (!['admin','manager','cashier'].includes(role)) throw new Error('FORBIDDEN');
const { orderId, amountCents, customerId } = req.data || {} as any; if (!orderId || !amountCents || amountCents<=0) throw new Error('BAD_REQUEST');
const db = getDbCN(); const cRef = db.collection('credit_notes').doc();
await cRef.set({ id:cRef.id, orderId, customerId: customerId||null, amountCents, remainingCents: amountCents, status:'open', issuedAt:new Date().toISOString(), issuedByUserId: ctx.uid });
return { ok:true, creditNoteId: cRef.id };
});


export const redeemCreditNote = onCallCN<{ creditNoteId: string; orderId: string; amountCents?: number }>(async (req) => {
const ctx = req.auth; if (!ctx) throw new Error('UNAUTH');
const role = (ctx.token as any)?.role; if (!['admin','manager','cashier'].includes(role)) throw new Error('FORBIDDEN');
const { creditNoteId, orderId, amountCents } = req.data || {} as any; if (!creditNoteId || !orderId) throw new Error('BAD_REQUEST');
const db = getDbCN(); const cRef = db.collection('credit_notes').doc(creditNoteId);
await db.runTransaction(async (tx)=>{
const c = await tx.get(cRef); if (!c.exists) throw new Error('NOT_FOUND'); const cn:any = c.data(); if (cn.status!=='open') throw new Error('NOT_OPEN');
const use = Math.min(amountCents || cn.remainingCents, cn.remainingCents); const remaining = cn.remainingCents - use;
tx.update(cRef, { remainingCents: remaining, status: remaining>0? 'open':'redeemed', redeemedAt: remaining>0? null : new Date().toISOString(), redeemedByOrderId: remaining>0? null : orderId });
const oRef = db.collection('orders').doc(orderId);
tx.set(oRef, { payments: { store_creditCents: FVCN.increment(use) }, totalPaidCents: FVCN.increment(use), updatedAt: new Date().toISOString() } as any, { merge: true });
});
return { ok:true };
});