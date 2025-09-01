import { onCall } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';

interface CloseDayPayload { locationId: string; date: string; notes?: string }

export const adminCloseDay = onCall<CloseDayPayload>(async (req) => {
  const ctx = req.auth; if (!ctx) throw new Error('UNAUTHENTICATED');
  const role = (ctx.token as any)?.role; if (!['admin','manager'].includes(role)) throw new Error('PERMISSION_DENIED');
  const { locationId, date, notes } = req.data || {};
  if (!locationId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('BAD_REQUEST');

  const db = getFirestore();
  const dayStart = new Date(date + 'T00:00:00.000Z');
  const dayEnd = new Date(date + 'T23:59:59.999Z');

  // fetch sessions for the day
  const sessionsSnap = await db.collection('register_sessions')
    .where('locationId', '==', locationId)
    .where('openedAt', '>=', dayStart.toISOString())
    .where('openedAt', '<=', dayEnd.toISOString())
    .get();

  if (sessionsSnap.empty) throw new Error('NO_SESSIONS');

  let paymentTotals: Record<string, number> = {};
  let grossSales = 0, netSales = 0, discounts = 0, returns = 0, tax = 0;
  let cashExpected = 0, cashCounted = 0;
  const sessionIds: string[] = [];

  for (const doc of sessionsSnap.docs) {
    const s = doc.data(); sessionIds.push(doc.id);
    if (s.status !== 'closed') throw new Error(`SESSION_OPEN:${doc.id}`);

    // sum per-session totals
    if (s.totals?.payments) {
      for (const [m, cents] of Object.entries(s.totals.payments)) {
        paymentTotals[m] = (paymentTotals[m] || 0) + (cents as number);
      }
    }
    grossSales += s.totals?.grossSalesCents || 0;
    netSales   += s.totals?.netSalesCents || 0;
    discounts  += s.totals?.discountsCents || 0;
    returns    += s.totals?.returnsCents || 0;
    tax        += s.totals?.taxCents || 0;

    cashExpected += (s.totals?.payments?.cash || 0) - (s.returnsCents || 0) + (s.openingFloatCents || 0) + (s.cashMovementsCents || 0);
    cashCounted  += s.closingFloatCents || 0;
  }

  const overShort = cashCounted - cashExpected;
  const zid = `z_${date}_${locationId}`;
  const zRef = db.collection('z_closures').doc(zid);
  const now = Timestamp.now().toDate().toISOString();

  await db.runTransaction(async (tx) => {
    const zCur = await tx.get(zRef);
    if (zCur.exists) {
      // idempotent: update notes only
      tx.update(zRef, { notes: notes || zCur.get('notes') });
      return;
    }
    tx.set(zRef, {
      id: zid,
      date,
      locationId,
      registerSessionIds: sessionIds,
      paymentTotals,
      grossSalesCents: grossSales,
      netSalesCents: netSales,
      discountsCents: discounts,
      returnsCents: returns,
      taxCents: tax,
      cashExpectedCents: cashExpected,
      cashCountedCents: cashCounted,
      cashOverShortCents: overShort,
      generatedByUserId: ctx.uid,
      generatedAt: now,
      notes: notes || null,
    } as any);
  });

  logger.info('Z-closure created', { zid, locationId, date });
  return { ok: true, id: zid, paymentTotals, grossSales, netSales, discounts, returns, tax, cashExpected, cashCounted, overShort };
});
