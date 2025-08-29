
import { onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { db, requireRole } from "./utils";

/** SA day key of a millis timestamp */
function saDayKey(ms: number): string {
  const iso = new Date(ms).toLocaleString("en-US", { timeZone: "Africa/Johannesburg" });
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Fetch latest punch for uid (order by inAt desc, limit 1) */
async function getLatestOpen(uid: string) {
  const snap = await db.collection("time_clock")
    .where("uid", "==", uid)
    .orderBy("inAt", "desc")
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  const data = doc.data() as any;
  if (!data.outAt) return { id: doc.id, data };
  return null;
}

/** Any signed-in staff may clock in/out */
const STAFF_ROLES = ["admin","manager","cashier","waiter","kitchen"];

export const clockIn = onCall({cors: true}, async (req) => {
  const role = requireRole(req, STAFF_ROLES);
  const uid = req.auth!.uid;
  const now = Timestamp.now();
  const nowMs = now.toMillis();

  // Guard: already clocked in?
  const open = await getLatestOpen(uid);
  if (open) {
    return { ok: true, already: true, punchId: open.id };
  }

  // Pull a friendly display name/role if you persist them in users/{uid}
  let userName = "";
  try {
    const u = await db.collection("users").doc(uid).get();
    userName = (u.exists ? (u.data() as any)?.name : "") || "";
  } catch {}

  const docRef = await db.collection("time_clock").add({
    uid,
    userName,
    role,
    inAt: now,
    outAt: null,
    durationSec: null,
    dateKey: saDayKey(nowMs),
    createdAt: now,
    updatedAt: now,
  });

  return { ok: true, punchId: docRef.id };
});

export const clockOut = onCall({cors: true}, async (req) => {
  requireRole(req, STAFF_ROLES);
  const uid = req.auth!.uid;

  const open = await getLatestOpen(uid);
  if (!open) {
    return { ok: false, error: "No open shift to clock out." };
  }

  const outAt = Timestamp.now();
  const inAt: Timestamp = open.data.inAt;
  const durationSec = Math.max(0, Math.round((outAt.toMillis() - inAt.toMillis()) / 1000));

  await db.collection("time_clock").doc(open.id).set({
    outAt,
    durationSec,
    updatedAt: outAt,
  }, { merge: true });

  return { ok: true, punchId: open.id, durationSec };
});

/** Admin/Manager CSV export by date range (SA) grouped by uid */
export const adminExportTimeCsv = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin","manager"]);

  const startMs = Number(req.data?.startMs);
  const endMs = Number(req.data?.endMs);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    throw new Error("Provide startMs and endMs (millis, SA window).");
  }
  const startTs = Timestamp.fromMillis(startMs);
  const endTs = Timestamp.fromMillis(endMs);

  // Pull punches that intersect window: inAt >= start && inAt < end
  const snap = await db.collection("time_clock")
    .where("inAt", ">=", startTs)
    .where("inAt", "<", endTs)
    .get();

  type Row = { uid: string; userName: string; inAt: number; outAt: number|null; durationSec: number|null; };
  const rows: Row[] = [];
  const byUser: Record<string, number> = {};

  snap.forEach((d) => {
    const x: any = d.data();
    const inMs = (x.inAt as Timestamp).toMillis();
    const outMs = x.outAt ? (x.outAt as Timestamp).toMillis() : null;
    const dur = typeof x.durationSec === "number" ? x.durationSec : (outMs ? Math.max(0, Math.round((outMs - inMs)/1000)) : 0);
    rows.push({
      uid: x.uid,
      userName: x.userName || "",
      inAt: inMs,
      outAt: outMs,
      durationSec: dur,
    });
    byUser[x.uid] = (byUser[x.uid] || 0) + (dur || 0);
  });

  // Detailed CSV (per punch) + summary block
  const header = ["uid","userName","inAtISO","outAtISO","durationHours"];
  const det = rows.map(r => ([
    r.uid,
    r.userName,
    new Date(r.inAt).toISOString(),
    r.outAt ? new Date(r.outAt).toISOString() : "",
    ( (r.durationSec||0) / 3600 ).toFixed(2),
  ].join(",")));

  const summaryHeader = ["uid","totalHours"];
  const sum = Object.entries(byUser).map(([uid, secs]) => ([uid, (secs/3600).toFixed(2)].join(",")));

  const csv = [
    "# DETAIL",
    header.join(","),
    ...det,
    "",
    "# SUMMARY",
    summaryHeader.join(","),
    ...sum,
  ].join("\n");

  const fname = `time_${saDayKey(startMs)}_${saDayKey(endMs-1)}.csv`;
  return { ok: true, filename: fname, csv };
});
