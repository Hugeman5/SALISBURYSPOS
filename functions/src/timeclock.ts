
'use server';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue } from './utils.js';
import * as bcrypt from 'bcryptjs';

const getOpenPunch = async (uid: string) => {
    const q = db.collection('time_clock').where('uid', '==', uid).where('outAt', '==', null).limit(1);
    const snap = await q.get();
    return snap.docs[0];
};

const validatePin = async (uid: string, pin: string): Promise<boolean> => {
    if (!pin) return false;
    const secretSnap = await db.collection('user_secrets').doc(uid).get();
    const pinHash = secretSnap.data()?.pinHash;
    if (!pinHash) return false;
    return bcrypt.compare(pin, pinHash);
};

export const clockIn = onCall({ cors: true, region: 'us-central1' }, async (req) => {
    const uid = req.auth?.uid;
    const { pin } = req.data;
    if (!uid) throw new HttpsError('unauthenticated', 'Authentication required.');
    
    if (!await validatePin(uid, pin)) {
        throw new HttpsError('permission-denied', 'Invalid PIN.');
    }

    const existing = await getOpenPunch(uid);
    if (existing) {
        return { ok: true, alreadyIn: true };
    }

    const now = FieldValue.serverTimestamp();
    await db.collection('time_clock').add({
        uid,
        inAt: now,
        outAt: null,
        createdAt: now,
        updatedAt: now,
    });

    return { ok: true };
});

export const clockOut = onCall({ cors: true, region: 'us-central1' }, async (req) => {
    const uid = req.auth?.uid;
    const { pin } = req.data;
    if (!uid) throw new HttpsError('unauthenticated', 'Authentication required.');
    
    if (!await validatePin(uid, pin)) {
        throw new HttpsError('permission-denied', 'Invalid PIN.');
    }
    
    const punchDoc = await getOpenPunch(uid);
    if (!punchDoc) {
        throw new HttpsError('not-found', 'No open clock-in found.');
    }
    
    const now = FieldValue.serverTimestamp();
    await punchDoc.ref.update({
        outAt: now,
        updatedAt: now,
    });
    
    return { ok: true };
});
