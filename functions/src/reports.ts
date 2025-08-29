
import {onCall} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {Timestamp} from "firebase-admin/firestore";
import {db, requireRole} from "./utils";

/**
 * Utility: SA day window (Africa/Johannesburg) for a given date string 'YYYY-MM-DD'
 * If startMs/endMs provided by client, those win.
 */
function saDayWindow(dateStr?: string): { startMs: number; endMs: number; key: string } {
  if (!dateStr) {
    // Default: today in SA time
    const saNowStr = new Date().toLocaleString("en-US", {timeZone: "Africa/Johannesburg"});
    const saNow = new Date(saNowStr);
    const y = saNow.getFullYear();
    const m = saNow.getMonth();
    const d = saNow.getDate();
    const start = new Date(saNow); start.setHours(0, 0, 0, 0);
    const end = new Date(saNow); end.setHours(24, 0, 0, 0);
    const key = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return {startMs: start.getTime(), endMs: end.getTime(), key};
  }
  // Specific date in SA
  const saMidnightStr = new Date(`${dateStr}T00:00:00`).toLocaleString("en-US", {timeZone: "Africa/Johannesburg"});
  const start = new Date(saMidnightStr);
  const end = new Date(saMidnightStr); end.setHours(24, 0, 0, 0);
  return {startMs: start.getTime(), endMs: end.getTime(), key: dateStr};
}

/**
 * Close the day (Z-Report): aggregates paid orders by SA day and writes z_closures/{YYYY-MM-DD}
 * Request data:
 *  - date?: string 'YYYY-MM-DD' in SA timezone (optional)
 *  - startMs?: number, endMs?: number (optional explicit range)
 */
export const adminCloseDay = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin", "manager"]);

  const dateStr = typeof req.data?.date === "string" ? req.data.date : undefined;
  const window = saDayWindow(dateStr);
  const startMs = typeof req.data?.startMs === "number" ? req.data.startMs : window.startMs;
  const endMs = typeof req.data?.endMs === "number" ? req.data.endMs : window.endMs;
  const key = window.key;

  const startTs = Timestamp.fromMillis(startMs);
  const endTs = Timestamp.fromMillis(endMs);

  // Query orders in the window (range only on 'ts' to avoid composite index requirements)
  const snap = await db.collection("orders")
    .where("createdAt", ">=", startTs)
    .where("createdAt", "<", endTs)
    .get();

  const totals = {
    countPaid: 0,
    gross: 0,
    vat: 0,
    net: 0,
    cash: 0,
    card: 0,
    other: 0,
    discounts: 0,
    returns: 0,
    sampleSize: snap.size,
  };

  // Robust field reading (works with a few possible shapes)
  snap.forEach((doc) => {
    const d: any = doc.data();
    const status = d.status || d.state || "unknown";
    if (status !== "paid") return;

    const amounts = d.totals || d.amounts || d;
    const gross = Number(amounts.gross ?? amounts.totalGross ?? amounts.totalInc ?? 0) || 0;
    const vat = Number(amounts.vat ?? amounts.tax ?? 0) || 0;
    const net = Number(amounts.net ?? (gross - vat)) || 0;

    totals.countPaid += 1;
    totals.gross += gross;
    totals.vat += vat;
    totals.net += net;

    // payments: array or single
    const payments = Array.isArray(d.payments) ? d.payments : d.payment ? [d.payment] : [];
    if (payments.length === 0) {
      totals.other += gross;
    } else {
      for (const p of payments) {
        const method = (p.method || p.type || "other").toLowerCase();
        const amt = Number(p.amount ?? 0) || 0;
        if (method.includes("cash")) totals.cash += amt;
        else if (method.includes("card") || method.includes("pos")) totals.card += amt;
        else totals.other += amt;
      }
    }

    // optional
    const disc = Number(d.discounts?.total ?? d.discount ?? 0) || 0;
    totals.discounts += disc;
    if (d.isReturn || d.type === "return") {
      totals.returns += gross;
    }
  });

  // Round to cents
  for (const k of ["gross", "vat", "net", "cash", "card", "other", "discounts", "returns"] as const) {
    // @ts-ignore
    totals[k] = Math.round(totals[k]);
  }

  const docRef = db.collection("z_closures").doc(key);
  await docRef.set({
    key,
    range: {startMs, endMs},
    totals,
    vatRate: 0.15,
    currency: "ZAR",
    closedAt: admin.firestore.FieldValue.serverTimestamp(),
    closedByUid: req.auth?.uid || null,
  }, {merge: true});

  return {ok: true, key, totals};
});

/**
 * Export Z-Report as CSV. Reads z_closures/{dateKey}.
 * Request data:
 *  - date: 'YYYY-MM-DD' (required if you don't pass start/end)
 */
export const adminExportZCsv = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin", "manager"]);
  const date = String(req.data?.date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("date (YYYY-MM-DD) is required");
  }
  const doc = await db.collection("z_closures").doc(date).get();
  if (!doc.exists) return {ok: false, error: "No Z-Report for that date."};
  const d: any = doc.data();

  // Very small CSV (one row of totals + header)
  const lines = [
    ["date", "countPaid", "gross_cents", "vat_cents", "net_cents", "cash_cents", "card_cents", "other_cents", "discounts_cents", "returns_cents", "currency", "vatRate"],
    [
      date,
      d.totals?.countPaid ?? 0,
      d.totals?.gross ?? 0,
      d.totals?.vat ?? 0,
      d.totals?.net ?? 0,
      d.totals?.cash ?? 0,
      d.totals?.card ?? 0,
      d.totals?.other ?? 0,
      d.totals?.discounts ?? 0,
      d.totals?.returns ?? 0,
      d.currency ?? "ZAR",
      d.vatRate ?? 0.15,
    ],
  ];
  const csv = lines.map((r) => r.map((x) => String(x)).join(",")).join("\n");
  return {ok: true, filename: `z_${date}.csv`, csv};
});
