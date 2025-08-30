
'use server';

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { requireRole } from "./utils";

const db = admin.firestore();

export const manageRegisterSession = onCall({ cors: true }, async (req) => {
    const { uid, token } = req.auth!;
    requireRole(req, ['admin', 'manager']);

    const { action, registerId, openingFloat, sessionId, countedCash } = req.data;

    if (action === 'open') {
        if (!registerId || typeof openingFloat !== 'number') {
            throw new HttpsError('invalid-argument', 'Register ID and opening float are required.');
        }

        const openSessionQuery = await db.collection('register_sessions').where('status', '==', 'open').limit(1).get();
        if (!openSessionQuery.empty) {
            throw new HttpsError('failed-precondition', 'An open session already exists. Please close it first.');
        }

        const sessionRef = db.collection('register_sessions').doc();
        await sessionRef.set({
            registerId,
            status: 'open',
            openedAt: admin.firestore.FieldValue.serverTimestamp(),
            openedBy: { uid, name: token.name || 'Unknown' },
            openingFloat,
            expectedCash: openingFloat,
            cashMovements: [],
        });
        return { ok: true, sessionId: sessionRef.id };
    }

    if (action === 'close') {
        if (!sessionId || typeof countedCash !== 'number') {
            throw new HttpsError('invalid-argument', 'Session ID and counted cash amount are required.');
        }
        
        const sessionRef = db.collection('register_sessions').doc(sessionId);
        const sessionSnap = await sessionRef.get();
        if (!sessionSnap.exists || sessionSnap.data()?.status !== 'open') {
             throw new HttpsError('not-found', 'Open session not found.');
        }
        
        const session = sessionSnap.data()!;
        const overShort = countedCash - session.expectedCash;

        await sessionRef.update({
            status: 'closed',
            closedAt: admin.firestore.FieldValue.serverTimestamp(),
            closedBy: { uid, name: token.name || 'Unknown' },
            countedCash,
            overShort,
        });

        return { ok: true, overShort };
    }

    throw new HttpsError('invalid-argument', 'Invalid action specified.');
});


export const postCashMovement = onCall({ cors: true }, async (req) => {
    const { uid, token } = req.auth!;
    requireRole(req, ['admin', 'manager']);
    
    const { sessionId, type, amount, reason } = req.data;

    if (!sessionId || !type || typeof amount !== 'number' || !reason) {
        throw new HttpsError('invalid-argument', 'Missing required fields.');
    }
    if (type !== 'payin' && type !== 'payout') {
        throw new HttpsError('invalid-argument', 'Invalid movement type.');
    }

    const sessionRef = db.collection('register_sessions').doc(sessionId);
    const movementRef = sessionRef.collection('cash_movements').doc();

    const movementAmount = type === 'payin' ? amount : -amount;

    await db.runTransaction(async (tx) => {
        const sessionSnap = await tx.get(sessionRef);
        if (!sessionSnap.exists || sessionSnap.data()?.status !== 'open') {
            throw new HttpsError('not-found', 'Open session not found.');
        }

        const currentExpected = sessionSnap.data()!.expectedCash || 0;
        const newExpected = currentExpected + movementAmount;

        tx.update(sessionRef, { expectedCash: newExpected });

        tx.set(movementRef, {
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            by: { uid, name: token.name || 'Unknown' },
            type,
            amount: movementAmount,
            reason,
        });
    });

    return { ok: true };
});

    