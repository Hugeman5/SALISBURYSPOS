/**
 * @fileoverview Cloud Functions for generating daily sales reports (Z-Reports).
 */

import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import {Timestamp} from "firebase-admin/firestore";
import {db, requireRole, FieldValue} from "./utils.js";

type Req<T = any> = CallableRequest<T>;

interface OrderPayment {
    type: string;
    amount: number;
}

interface OrderData {
    status: string;
    totals?: {
        totalInc?: number;
        vat?: number;
        subTotalEx?: number;
    };
    discounts?: {
        total?: number;
    };
    isReturn?: boolean;
    payments?: OrderPayment[];
}

/**
 * Creates a time window for a given date in the Africa/Johannesburg timezone.
 * @param {string} [dateStr] - The date in 'YYYY-MM-DD' format.
 * @return {{startMs: number, endMs: number, key: string}} The time window.
 */
function saDayWindow(dateStr?: string) {
  let y: number; let m: number; let d: number;

  if (dateStr) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (!match) {
      throw new HttpsError("invalid-argument", "Date must be YYYY-MM-DD");
    }
    [y, m, d] = match.slice(1).map(Number);
  } else {
    const f = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Johannesburg",
      year: "numeric", month: "2-digit", day: "2-digit",
    });
    const parts = f.formatToParts(new Date());
    const p = (t: string) => Number(parts.find((pt) => pt.type === t)?.value);
    y = p("year"); m = p("month"); d = p("day");
    const mStr = String(m).padStart(2, "0");
    const dStr = String(d).padStart(2, "0");
    dateStr = `${y}-${mStr}-${dStr}`;
  }

  const SA_OFFSET_MS = 2 * 60 * 60 * 1000;
  const startMs = Date.UTC(y, m - 1, d) - SA_OFFSET_MS;
  const endMs = Date.UTC(y, m - 1, d + 1) - SA_OFFSET_MS;
  return {startMs, endMs, key: dateStr};
}

/**
 * Aggregates sales data for a given day to generate a Z-Report.
 * This is idempotent; running it multiple times for the same day will
 * overwrite the previous report with updated data.
 */
export const adminCloseDay = onCall({ cors: true }, async (req: Req<{date?: string, startMs?: number, endMs?: number}>) => {
  requireRole(req, ["admin", "manager"]);
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Auth is required.");

  const {date, startMs: startOverride, endMs: endOverride} = req.data;
  const window = saDayWindow(date);
  const startMs = startOverride ?? window.startMs;
  const endMs = endOverride ?? window.endMs;

  const snap = await db.collection("orders")
    .where("createdAt", ">=", Timestamp.fromMillis(startMs))
    .where("createdAt", "<", Timestamp.fromMillis(endMs))
    .get();

  const totals = {
    countPaid: 0, gross: 0, vat: 0, net: 0, cash: 0, card: 0,
    other: 0, discounts: 0, returns: 0, sampleSize: snap.size,
  };

  snap.forEach((doc: any) => {
    const d = doc.data() as OrderData;
    if (d.status !== "paid") return;
    const gross = Number(d.totals?.totalInc || 0);
    totals.countPaid++;
    totals.gross += gross;
    totals.vat += Number(d.totals?.vat || 0);
    totals.net += Number(d.totals?.subTotalEx || 0);
    totals.discounts += Number(d.discounts?.total || 0);
    if (d.isReturn) totals.returns += gross;

    (d.payments || []).forEach((p: OrderPayment) => {
      if (p.type === "cash") totals.cash += p.amount;
      else if (p.type === "card") totals.card += p.amount;
      else totals.other += p.amount;
    });
  });

  // Round all monetary values to the nearest cent
  Object.keys(totals).forEach((k) => {
    const key = k as keyof typeof totals;
    if (key !== "countPaid" && key !== "sampleSize") {
      totals[key] = Math.round(totals[key]);
    }
  });

  await db.collection("z_closures").doc(window.key).set({
    key: window.key, range: {startMs, endMs}, totals, vatRate: 0.15,
    currency: "ZAR", closedAt: FieldValue.serverTimestamp(),
    closedByUid: uid,
  }, {merge: true});

  return {ok: true, key: window.key, totals};
});


/**
 * Exports a previously generated Z-Report to a CSV string.
 */
export const adminExportZCsv = onCall({ cors: true }, async (req: Req<{date: string}>) => {
  requireRole(req, ["admin", "manager"]);
  const {date} = req.data;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpsError("invalid-argument", "Date 'YYYY-MM-DD' is required.");
  }
  const doc = await db.collection("z_closures").doc(date).get();
  if (!doc.exists) {
    throw new HttpsError("not-found", "No report for that date.");
  }

  const d = doc.data() || {};
  const t = d.totals || {};
  const header = [
    "date", "countPaid", "gross_cents", "vat_cents", "net_cents",
    "cash_cents", "card_cents", "other_cents", "discounts_cents",
    "returns_cents",
  ];
  const row = [
    date, t.countPaid, t.gross, t.vat, t.net, t.cash, t.card, t.other,
    t.discounts, t.returns,
  ].map((v) => v ?? 0);

  const csv = [header.join(","), row.join(",")].join("\n");
  return {ok: true, filename: `z_${date}.csv`, csv};
});
