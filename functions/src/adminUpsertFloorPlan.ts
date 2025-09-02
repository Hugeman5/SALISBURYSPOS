import { onCall as onCallFloor } from 'firebase-functions/v2/https';
import { getFirestore as getDbFloor } from 'firebase-admin/firestore';


export const adminUpsertFloorPlan = onCallFloor<{ id?: string; locationId: string; name: string; width?: number; height?: number; tables: any[] }>(async (req)=>{
const ctx = req.auth; if (!ctx) throw new Error('UNAUTH');
const role = (ctx.token as any)?.role; if (!['admin','manager'].includes(role)) throw new Error('FORBIDDEN');
const { id, locationId, name, width, height, tables } = req.data || {} as any; if (!locationId || !name) throw new Error('BAD_REQUEST');
const db = getDbFloor(); const fid = id || db.collection('floor_plans').doc().id;
await db.doc(`floor_plans/${fid}`).set({ id: fid, locationId, name, width: width||900, height: height||600, tables: tables||[], updatedAt: new Date().toISOString() }, { merge: true });
return { ok:true, id: fid };
});