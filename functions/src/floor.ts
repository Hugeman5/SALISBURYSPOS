
'use server';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue } from './utils.js';
import { requireRole } from './roles.js';

export const adminUpsertFloorPlan = onCall({ cors: true, region: 'us-central1' }, async (req) => {
    requireRole(req, ['admin', 'manager']);
    const { plan } = req.data;
    if (!plan || !plan.id) throw new HttpsError('invalid-argument', 'Plan with ID is required.');
    const ref = db.collection('floor_plans').doc(plan.id);
    await ref.set({ ...plan, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true };
});

export const adminDisableTables = onCall({ cors: true, region: 'us-central1' }, async (req) => {
    requireRole(req, ['admin', 'manager']);
    const { tableIds, disabled } = req.data;
    if (!Array.isArray(tableIds) || typeof disabled !== 'boolean') {
        throw new HttpsError('invalid-argument', 'tableIds array and disabled boolean are required.');
    }
    const batch = db.batch();
    tableIds.forEach(id => {
        const ref = db.collection('table_state').doc(id);
        batch.update(ref, { status: disabled ? 'disabled' : 'open', updatedAt: FieldValue.serverTimestamp() });
    });
    await batch.commit();
    return { ok: true };
});
