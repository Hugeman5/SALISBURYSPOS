
import {onCall} from "firebase-functions/v2/https";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

interface CloseDayPayload {
  locationId: string;
  date: string;
  notes?: string;
}

interface RegisterSession {
  status: string;
  totals?: {
    payments: Record<string, number>;
    grossSalesCents?: number;
    netSalesCents?: number;
    discountsCents?: number;
    returnsCents?: number;
    taxCents?: number;
  };
  openingFloatCents?: number;
  closingFloatCents?: number;
  cashMovementsCents?: number;
}

export const adminCloseDay = onCall<CloseDayPayload>(async (req) => {
  const ctx = req.auth;
  if (!ctx) {
    throw new Error("UNAUTH");
  }
  const role = (ctx.token as {role?: string})?.role;
  if (!["admin", "manager"].includes(role ?? "")) {
    throw new Error("FORBIDDEN");
  }
  const {locationId, date, notes} = req.data;
  if (!locationId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("BAD_REQUEST");
  }

  const db = getFirestore();
  const dayStart = new Date(date + "T00:00:00.000Z");
  const dayEnd = new Date(date + "T23:59:59.999Z");

  const sessionsSnap = await db.collection("register_sessions")
    .where("locationId", "==", locationId)
    .where("openedAt", ">=", dayStart.toISOString())
    .where("openedAt", "<=", dayEnd.toISOString())
    .get();

  if (sessionsSnap.empty) {
    throw new Error("NO_SESSIONS");
  }

  const paymentTotals: Record<string, number> = {};
  let grossSales = 0; let netSales = 0; let discounts = 0; let returns = 0;
  let tax = 0; let cashExpected = 0; let cashCounted = 0;
  let cashMovementTotal = 0;
  const sessionIds: string[] = [];
  const sessionRows: object[] = [];

  for (const doc of sessionsSnap.docs) {
    const s = doc.data() as RegisterSession;
    sessionIds.push(doc.id);
    if (s.status !== "closed") {
      throw new Error(`SESSION_OPEN:${doc.id}`);
    }

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

    const expected = (s.totals?.payments?.cash || 0) - (s.returnsCents || 0) +
                   (s.openingFloatCents || 0) + cm;
    cashExpected += expected;
    cashCounted += s.closingFloatCents || 0;

    sessionRows.push({
      id: doc.id,
      cashMovementsCents: cm,
      openingFloatCents: s.openingFloatCents || 0,
      closingFloatCents: s.closingFloatCents || 0,
    });
  }

  const overShort = cashCounted - cashExpected;
  const zid = `z_${date}_${locationId}`;
  const zRef = db.collection("z_closures").doc(zid);
  const now = Timestamp.now().toDate().toISOString();

  await db.runTransaction(async (tx) => {
    const zCur = await tx.get(zRef);
    if (zCur.exists) {
      tx.update(zRef, {notes: notes || zCur.get("notes")});
      return;
    }
    tx.set(zRef, {
      id: zid, date, locationId, registerSessionIds: sessionIds, paymentTotals,
      grossSalesCents: grossSales, netSalesCents: netSales,
      discountsCents: discounts, returnsCents: returns, taxCents: tax,
      cashExpectedCents: cashExpected, cashCountedCents: cashCounted,
      cashOverShortCents: overShort,
      generatedByUserId: ctx.uid, generatedAt: now, notes: notes || null,
    });
  });

  logger.info("Z-closure created", {zid, locationId, date});
  return {
    ok: true, id: zid, paymentTotals, grossSales, netSales, discounts,
    returns, tax, cashExpected, cashCounted, overShort,
    cashMovementTotalCents: cashMovementTotal, sessions: sessionRows,
  };
});
