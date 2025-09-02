
import {onCall} from "firebase-functions/v2/https";
import {getFirestore} from "firebase-admin/firestore";

interface Payload {
  locationId?: string;
  start: string;
  end: string;
}

export const adminExportTimeCsv = onCall<Payload>(async (req) => {
  const ctx = req.auth;
  if (!ctx) throw new Error("UNAUTH");

  const role = (ctx.token as {role?: string})?.role;
  if (!["admin", "manager"].includes(role ?? "")) throw new Error("FORBIDDEN");

  const {locationId, start, end} = req.data;
  if (!start || !end) throw new Error("BAD_REQUEST");

  const db = getFirestore();
  let q: FirebaseFirestore.Query = db.collection("time_clock")
    .where("inAt", ">=", start)
    .where("inAt", "<=", end);
  if (locationId) {
    q = q.where("locationId", "==", locationId);
  }
  const snap = await q.get();

  const rows: any[] = [];
  const byUser: Record<string, number> = {};
  for (const doc of snap.docs) {
    const t: any = doc.data();
    const outAt = t.outAt || t.inAt;
    const timeDiff = new Date(outAt).getTime() - new Date(t.inAt).getTime();
    const minutes = Math.max(0, Math.round(timeDiff / 60000));
    const hours = (minutes/60).toFixed(2);
    const rate = (t.hourlyRateCents || 0)/100;
    const pay = +(rate * (minutes/60)).toFixed(2);
    rows.push({
      userId: t.userId,
      locationId: t.locationId||"",
      inAt: t.inAt,
      outAt: t.outAt||"",
      minutes,
      hours,
      hourlyRate: rate.toFixed(2),
      pay: pay.toFixed(2),
    });
    byUser[t.userId] = (byUser[t.userId] || 0) + pay;
  }
  const header = ["userId", "locationId", "inAt", "outAt", "minutes",
    "hours", "hourlyRate", "pay"];
  const csv = [header.join(",")]
    .concat(rows.map((r) => header.map((h) =>
      String(r[h]).replace(/,/g, " ")).join(",")))
    .join("\n");
  const totals = Object.entries(byUser)
    .map(([userId, pay]) => ({userId, pay: +(+pay).toFixed(2)}));

  return {ok: true, filename: `timesheets_${start}_${end}.csv`, csv, totals};
});
