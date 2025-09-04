
'use server';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue } from './utils.js';
import { requireRole } from './roles.js';

const getOpenSession = async (uid: string) => {
    const q = db.collection('register_sessions').where('status', '==', 'open').where('openedBy.uid', '==', uid).limit(1);
    const snap = await q.get();
    return snap.docs[0];
};

export const manageRegisterSession = onCall({ cors: true, region: 'us-central1' }, async (req) => {
    requireRole(req, ['admin', 'manager', 'cashier']);
    const { action, floatCents } = req.data;
    const uid = req.auth!.uid;
    const name = req.auth!.token.name || 'Unknown';

    if (action === 'open') {
        const existing = await getOpenSession(uid);
        if (existing) throw new HttpsError('already-exists', 'A session is already open.');
        
        const ref = db.collection('register_sessions').doc();
        await ref.set({
            status: 'open',
            openingFloatCents: floatCents,
            openedBy: { uid, name },
            openedAt: FieldValue.serverTimestamp(),
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { ok: true, sessionId: ref.id };
    }
    
    if (action === 'close') {
        const sessionDoc = await getOpenSession(uid);
        if (!sessionDoc) throw new HttpsError('not-found', 'No open session found.');
        
        await sessionDoc.ref.update({
            status: 'closed',
            closedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            closedBy: { uid, name },
        });
        return { ok: true };
    }
    
    if (action === 'status') {
        const sessionDoc = await getOpenSession(uid);
        return { ok: true, session: sessionDoc ? {id: sessionDoc.id, ...sessionDoc.data()} : null };
    }
    
    throw new HttpsError('invalid-argument', 'Invalid action.');
});

export const postCashMovement = onCall({ cors: true, region: 'us-central1' }, async (req) => {
    requireRole(req, ['admin', 'manager', 'cashier']);
    const { type, amountCents, reason } = req.data;
    if (type !== 'in' && type !== 'out') throw new HttpsError('invalid-argument', 'Type must be "in" or "out".');
    if (typeof amountCents !== 'number' || amountCents <= 0) throw new HttpsError('invalid-argument', 'Amount must be a positive number.');
    
    await db.collection('cash_movements').add({
        type,
        amountCents,
        reason: reason || null,
        status: 'pending', // Requires manager approval
        createdBy: req.auth!.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    });
    return { ok: true };
});
