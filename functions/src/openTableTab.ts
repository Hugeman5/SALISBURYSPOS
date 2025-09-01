
import { onCall } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

export const openTableTab = onCall(async (req) => {
  const ctx = req.auth; if (!ctx) throw new Error('UNAUTH');
  const role = (ctx.token as any)?.role; if (!['admin','manager','cashier','waiter'].includes(role)) throw new Error('FORBIDDEN');
  const { tableId, locationId, covers } = (req.data || {}) as { tableId: string; locationId: string; covers?: number };
  const db = getFirestore();
  const orderRef = db.collection('orders').doc();
  const stateRef = db.collection('table_state').doc(tableId);
  await db.runTransaction(async (tx)=>{
    const st = await tx.get(stateRef);
    if (st.exists && st.get('status') === 'occupied') throw new Error('ALREADY_OCCUPIED');
    tx.set(orderRef, { id: orderRef.id, type:'dine_in', tableId, locationId, lines: [], totalCents: 0, totalPaidCents:0, status:'open', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    tx.set(stateRef, { id: tableId, locationId, status:'occupied', serverUserId: ctx.uid, covers: covers||0, orderId: orderRef.id, updatedAt: new Date().toISOString() }, { merge: true });
  });
  return { ok:true };
});
