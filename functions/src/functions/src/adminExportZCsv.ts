import {onCall as onCallZ} from "firebase-functions/v2/https";
import {getFirestore as getDbZ} from "firebase-admin/firestore";


export const adminExportZCsv = onCallZ<{ startDate: string; endDate: string; locationId?: string }>(async (req) => {
  const ctx = req.auth; if (!ctx) throw new Error("UNAUTH");
  const role = (ctx.token as any)?.role; if (!["admin", "manager"].includes(role)) throw new Error("FORBIDDEN");
  const {startDate, endDate, locationId} = req.data || {} as any;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) throw new Error("BAD_DATES");


  const db = getDbZ();
  let q: FirebaseFirestore.Query = db.collection("z_closures").where("date", ">=", startDate).where("date", "<=", endDate);
  if (locationId) q = q.where("locationId", "==", locationId);
  const snap = await q.get();
  if (snap.empty) return {ok: true, filename: `z_${startDate}_${endDate}.csv`, csv: "date,locationId\n"};


  const payKeys = new Set<string>(); const rows: any[] = [];
  for (const d of snap.docs) {
    const z:any = d.data(); Object.keys(z.paymentTotals||{}).forEach((k)=>payKeys.add(k)); rows.push(z);
  }
  const payCols = Array.from(payKeys).sort();
  const headers = ["date", "locationId", "grossSales", "netSales", "discounts", "returns", "tax", "cashExpected", "cashCounted", "cashOverShort", ...payCols.map((k)=>`pay_${k}`)];
  const toR = (n:number)=> (Math.round(n)/100).toFixed(2);
  const csv = [headers.join(",")].concat(rows.map((z) => [z.date, z.locationId, toR(z.grossSalesCents||0), toR(z.netSalesCents||0), toR(z.discountsCents||0), toR(z.returnsCents||0), toR(z.taxCents||0), toR(z.cashExpectedCents||0), toR(z.cashCountedCents||0), toR(z.cashOverShortCents||0), ...payCols.map((k)=>toR((z.paymentTotals||{})[k]||0))].map((v)=>String(v).replace(/,/g, " ")).join(","))).join("\n");
  return {ok: true, filename: `z_${startDate}_${endDate}.csv`, csv};
});
