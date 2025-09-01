
import { onCall } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

export const moveTabToTable = onCall(async (req) => {
  const ctx = req.auth; if (!ctx) throw new Error('UNAUTH');
  const role = (ctx.token as any)?.role; if (!['admin','manager','cashier','waiter'].includes(role)) throw new Error('FORBIDDEN');
  const { fromTableId, toTableId } = (req.data || {}) as any;
  const db = getFirestore();
  const fromRef = db.collection('table_state').doc(fromTableId);
  const toRef = db.collection('table_state').doc(toTableId);
  await db.runTransaction(async (tx)=>{
    const [from, to] = await Promise.all([tx.get(fromRef), tx.get(toRef)]);
    if (!from.exists) throw new Error('FROM_NOT_FOUND');
    const orderId = from.get('orderId');
    if (!orderId) throw new Error('NO_ORDER');
    if (to.exists && to.get('status') === 'occupied') throw new Error('TO_OCCUPIED');
    tx.update(fromRef, { status:'open', orderId: null, covers: 0, updatedAt: new Date().toISOString() });
    tx.set(toRef, { id: toTableId, status:'occupied', orderId, serverUserId: ctx.uid, updatedAt: new Date().toISOString() }, { merge: true });
    tx.update(db.collection('orders').doc(orderId), { tableId: toTableId, updatedAt: new Date().toISOString() });
  });
  return { ok:true };
});
