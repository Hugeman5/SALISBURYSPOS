import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue, Timestamp } from './utils.js';
import { requireRole, ADMIN_ROLES } from './roles.js';

// Helper to get SA start/end of day
function getSaDayWindow(dateStr?: string) {
    const d = dateStr ? new Date(dateStr) : new Date();
    const tz = 'Africa/Johannesburg';
    const start = new Date(d.toLocaleDateString('en-CA', { timeZone: tz }));
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start: Timestamp.fromDate(start), end: Timestamp.fromDate(end) };
}

export const adminCloseDay = onCall({ cors: true, region: 'us-central1' }, async (req) => {
    requireRole(req, ADMIN_ROLES);
    const { date } = req.data; // date as 'YYYY-MM-DD'
    const { start, end } = getSaDayWindow(date);

    const ordersSnap = await db.collection('orders')
        .where('createdAt', '>=', start)
        .where('createdAt', '<', end)
        .where('status', '==', 'paid')
        .get();

    let gross = 0;
    let net = 0;
    let tax = 0;
    
    ordersSnap.docs.forEach(doc => {
        const order = doc.data();
        gross += order.totals.totalInc || 0;
        net += order.totals.subTotalEx || 0;
        tax += order.totals.vat || 0;
    });

    const reportId = date || new Date().toISOString().split('T')[0];
    const reportRef = db.collection('z_closures').doc(reportId);
    
    await reportRef.set({
        id: reportId,
        gross, net, tax,
        ordersCount: ordersSnap.size,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    
    return { ok: true, zId: reportId };
});

const exportCsv = (filename: string, data: any[]) => {
    if (data.length === 0) return { filename, csv: '' };
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).join(','));
    const csv = [headers, ...rows].join('\n');
    return { filename, csv };
}

export const adminExportZCsv = onCall({ cors: true, region: 'us-central1' }, async (req) => {
    requireRole(req, ADMIN_ROLES);
    const snap = await db.collection('z_closures').orderBy('createdAt', 'desc').get();
    const data = snap.docs.map(d => ({id: d.id, ...d.data()}));
    return exportCsv(`z-closures-${Date.now()}.csv`, data);
});

export const adminExportTimeCsv = onCall({ cors: true, region: 'us-central1' }, async (req) => {
    requireRole(req, ADMIN_ROLES);
    const snap = await db.collection('time_clock').orderBy('inAt', 'desc').get();
    const data = snap.docs.map(d => d.data());
    return exportCsv(`timeclock-${Date.now()}.csv`, data);
});

export const adminExportOrders = onCall({ cors: true, region: 'us-central1' }, async (req) => {
    requireRole(req, ADMIN_ROLES);
    const snap = await db.collection('orders').orderBy('createdAt', 'desc').limit(1000).get();
    const data = snap.docs.map(d => ({id: d.id, ...d.data()}));
    return exportCsv(`orders-${Date.now()}.csv`, data);
});

export const adminExportLedger = onCall({ cors: true, region: 'us-central1' }, async (req) => {
    requireRole(req, ADMIN_ROLES);
    const snap = await db.collection('stock_movements').orderBy('createdAt', 'desc').limit(1000).get();
    const data = snap.docs.map(d => d.data());
    return exportCsv(`ledger-${Date.now()}.csv`, data);
});

export const getSalesSummary = onCall({ cors: true, region: 'us-central1' }, async (req) => {
    requireRole(req, ADMIN_ROLES);
    const { from, to } = req.data;
    let q = db.collection('orders').where('status', '==', 'paid');
    if (from) q = q.where('createdAt', '>=', Timestamp.fromDate(new Date(from)));
    if (to) q = q.where('createdAt', '<=', Timestamp.fromDate(new Date(to)));
    
    const snap = await q.get();
    const totalCents = snap.docs.reduce((sum, doc) => sum + doc.data().totals.totalInc, 0);
    
    return { totalCents, orders: snap.size, refunds: 0 };
});
