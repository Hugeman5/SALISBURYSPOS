import { onCall } from 'firebase-functions/v2/https';


let paymentTotals: Record<string, number> = {};
let grossSales = 0, netSales = 0, discounts = 0, returns = 0, tax = 0;
let cashExpected = 0, cashCounted = 0, cashMovementTotal = 0;
const sessionIds: string[] = [];
const sessionRows: any[] = [];


for (const doc of sessionsSnap.docs) {
const s = doc.data() as any; sessionIds.push(doc.id);
if (s.status !== 'closed') throw new Error(`SESSION_OPEN:${doc.id}`);


if (s.totals?.payments) {
for (const [m, cents] of Object.entries(s.totals.payments)) {
paymentTotals[m] = (paymentTotals[m] || 0) + Number(cents);
}
}
grossSales += s.totals?.grossSalesCents || 0;
netSales += s.totals?.netSalesCents || 0;
discounts += s.totals?.discountsCents || 0;
returns += s.totals?.returnsCents || 0;
tax += s.totals?.taxCents || 0;


const cm = s.cashMovementsCents || 0;
cashMovementTotal += cm;


cashExpected += (s.totals?.payments?.cash || 0) - (s.returnsCents || 0) + (s.openingFloatCents || 0) + cm;
cashCounted += s.closingFloatCents || 0;


sessionRows.push({ id: doc.id, cashMovementsCents: cm, openingFloatCents: s.openingFloatCents||0, closingFloatCents: s.closingFloatCents||0 });
}


const overShort = cashCounted - cashExpected;
const zid = `z_${date}_${locationId}`;
const zRef = db.collection('z_closures').doc(zid);
const now = Timestamp.now().toDate().toISOString();


await db.runTransaction(async (tx) => {
const zCur = await tx.get(zRef);
if (zCur.exists) { tx.update(zRef, { notes: notes || zCur.get('notes') }); return; }
tx.set(zRef, {
id: zid, date, locationId, registerSessionIds: sessionIds, paymentTotals,
grossSalesCents: grossSales, netSalesCents: netSales, discountsCents: discounts, returnsCents: returns, taxCents: tax,
cashExpectedCents: cashExpected, cashCountedCents: cashCounted, cashOverShortCents: overShort,
generatedByUserId: ctx.uid, generatedAt: now, notes: notes || null,
} as any);
});


logger.info('Z-closure created', { zid, locationId, date });
return { ok: true, id: zid, paymentTotals, grossSales, netSales, discounts, returns, tax, cashExpected, cashCounted, overShort, cashMovementTotalCents: cashMovementTotal, sessions: sessionRows };