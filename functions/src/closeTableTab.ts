import { onCall as onCallClose } from 'firebase-functions/v2/https';
import { getFirestore as getDbClose } from 'firebase-admin/firestore';


export const closeTableTab = onCallClose<{ tableId: string }>(async (req)=>{
const ctx = req.auth; if (!ctx) throw new Error('UNAUTH');
const role = (ctx.token as any)?.role; if (!['admin','manager','cashier','waiter'].includes(role)) throw new Error('FORBIDDEN');
const { tableId } = req.data || {} as any; const db = getDbClose(); const tRef = db.collection('table_state').doc(tableId);
await db.runTransaction(async (tx)=>{
const t = await tx.get(tRef); if (!t.exists) throw new Error('NOT_FOUND'); const orderId = t.get('orderId');
if (orderId) tx.update(db.collection('orders').doc(orderId), { status:'closed', updatedAt: new Date().toISOString() });
tx.update(tRef, { status:'dirty', orderId: null, covers: 0, updatedAt: new Date().toISOString() });
});
return { ok:true };
});