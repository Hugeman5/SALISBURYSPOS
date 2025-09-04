
'use server';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue, FieldPath } from './utils.js';
import { requireRole } from './roles.js';

export const cashierCreateOrder = onCall({ cors: true, region: 'us-central1' }, async (req) => {
    requireRole(req, ['admin', 'manager', 'cashier', 'waiter']);
    const { note, tableId } = req.data;
    const ref = db.collection('orders').doc();
    const now = FieldValue.serverTimestamp();
    await ref.set({
        id: ref.id,
        status: 'open',
        note: note || null,
        tableId: tableId || null,
        lines: [],
        payments: [],
        totals: { subTotalEx: 0, vat: 0, totalInc: 0 },
        createdAt: now,
        updatedAt: now,
        createdBy: req.auth?.uid,
    });
    return { orderId: ref.id };
});

export const cashierSetItems = onCall({ cors: true, region: 'us-central1' }, async (req) => {
    requireRole(req, ['admin', 'manager', 'cashier', 'waiter']);
    const { orderId, lines } = req.data;
    if (!orderId || !Array.isArray(lines)) throw new HttpsError('invalid-argument', 'Missing orderId or lines.');
    
    const orderRef = db.collection('orders').doc(orderId);
    // In a real app, you'd fetch item details to get prices, rather than trusting the client.
    // For now, we'll trust the client's price for simplicity.
    const totalInc = lines.reduce((sum, line) => sum + (line.priceCents * line.qty), 0);
    const subTotalEx = Math.round(totalInc / 1.15);
    const vat = totalInc - subTotalEx;

    await orderRef.update({
        lines,
        totals: { totalInc, subTotalEx, vat },
        updatedAt: FieldValue.serverTimestamp(),
    });
    return { ok: true };
});

export const cashierTakePayment = onCall({ cors: true, region: 'us-central1' }, async (req) => {
    requireRole(req, ['admin', 'manager', 'cashier']);
    const { orderId, payment } = req.data;
    if (!orderId || !payment) throw new HttpsError('invalid-argument', 'Missing orderId or payment.');

    await db.collection('orders').doc(orderId).update({
        payments: FieldValue.arrayUnion(payment),
        updatedAt: FieldValue.serverTimestamp(),
    });
    return { ok: true };
});

export const cashierCloseOrder = onCall({ cors: true, region: 'us-central1' }, async (req) => {
    requireRole(req, ['admin', 'manager', 'cashier']);
    const { orderId, payment } = req.data;
    if (!orderId) throw new HttpsError('invalid-argument', 'Missing orderId.');

    const orderRef = db.collection('orders').doc(orderId);
    if (payment) {
        await orderRef.update({
            payments: FieldValue.arrayUnion(payment),
        });
    }
    await orderRef.update({
        status: 'paid',
        updatedAt: FieldValue.serverTimestamp(),
    });
    return { ok: true };
});

export const cashierRefundItems = onCall({ cors: true, region: 'us-central1' }, async (req) => {
    requireRole(req, ['admin', 'manager', 'cashier']);
    // This is a complex operation involving creating credit notes, etc.
    // Stub for now.
    return { ok: true, message: 'Refunds not fully implemented.' };
});

export const splitCheck = onCall({ cors: true, region: 'us-central1' }, async (req) => {
    requireRole(req, ['admin', 'manager', 'cashier', 'waiter']);
    return { ok: true, message: 'Not implemented' };
});

export const mergeChecks = onCall({ cors: true, region: 'us-central1' }, async (req) => {
    requireRole(req, ['admin', 'manager', 'cashier', 'waiter']);
    return { ok: true, message: 'Not implemented' };
});

export const transferItems = onCall({ cors: true, region: 'us-central1' }, async (req) => {
    requireRole(req, ['admin', 'manager', 'cashier', 'waiter']);
    return { ok: true, message: 'Not implemented' };
});

export const printChecks = onCall({ cors: true, region: 'us-central1' }, async (req) => {
    requireRole(req, ['admin', 'manager', 'cashier', 'waiter']);
    const { orderId } = req.data;
    if (!orderId) throw new HttpsError('invalid-argument', 'orderId required');
    await db.collection('print_jobs').add({
        type: 'receipt',
        orderId,
        createdAt: FieldValue.serverTimestamp(),
        status: 'pending'
    });
    return { ok: true };
});

export const openTableTab = onCall({ cors: true, region: 'us-central1' }, async (req) => {
    requireRole(req, ['admin', 'manager', 'cashier', 'waiter']);
    const { tableId, locationId } = req.data;
    if (!tableId) throw new HttpsError('invalid-argument', 'tableId required');
    
    const orderRes = await cashierCreateOrder(req);
    
    await db.collection('table_state').doc(tableId).set({
        id: tableId,
        locationId,
        status: 'occupied',
        orderId: orderRes.orderId,
        serverUserId: req.auth?.uid,
        since: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    
    return { ok: true, orderId: orderRes.orderId };
});

export const closeTableTab = onCall({ cors: true, region: 'us-central1' }, async (req) => {
    requireRole(req, ['admin', 'manager', 'cashier', 'waiter']);
    const { tableId } = req.data;
    if (!tableId) throw new HttpsError('invalid-argument', 'tableId required');
    await db.collection('table_state').doc(tableId).update({
        status: 'open',
        orderId: null,
        serverUserId: null,
        since: null,
        updatedAt: FieldValue.serverTimestamp(),
    });
    return { ok: true };
});

export const moveTabToTable = onCall({ cors: true, region: 'us-central1' }, async (req) => {
    requireRole(req, ['admin', 'manager', 'cashier', 'waiter']);
    return { ok: true, message: 'Not implemented' };
});

export const mergeTables = onCall({ cors: true, region: 'us-central1' }, async (req) => {
    requireRole(req, ['admin', 'manager', 'cashier', 'waiter']);
    return { ok: true, message: 'Not implemented' };
});
