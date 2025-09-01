
import { onCall } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

export const adminUpsertFloorPlan = onCall(async (req) => {
  const ctx = req.auth; if (!ctx) throw new Error('UNAUTH');
  const role = (ctx.token as any)?.role; if (!['admin','manager'].includes(role)) throw new Error('FORBIDDEN');
  const { id, locationId, name, width, height, tables } = (req.data || {}) as any;
  if (!locationId || !name) throw new Error('BAD_REQUEST');
  const db = getFirestore();
  const fid = id || db.collection('floor_plans').doc().id;
  await db.doc(`floor_plans/${fid}`).set({ id: fid, locationId, name, width: width||800, height: height||600, tables: tables||[], updatedAt: new Date().toISOString() }, { merge: true });
  return { ok: true, id: fid };
});
