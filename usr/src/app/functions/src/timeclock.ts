
import {onCall} from "firebase-functions/v2/https";
import {Timestamp} from "firebase-admin/firestore";
import {db, requireRole, Role, STAFF_ROLES} from "./utils";

/** SA day key of a millis timestamp */
function saDayKey(ms: number): string {
  const iso = new Date(ms).toLocaleString("en-US", {timeZone: "Africa/Johannesburg"});
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Fetch latest punch for uid (order by inAt desc, limit 1) */
async function getLatestOpen(uid: string) {
  const snap = await db.collection(`time_clock/${uid}/sessions`)
    .where("outAt", "==", null)
    .orderBy("inAt", "desc")
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  const data = doc.data() as any;
  return {id: doc.id, data};
}

export const clockIn = onCall({cors: true}, async (req) => {
  const role: Role = requireRole(req, STAFF_ROLES);
  const uid = req.auth!.uid;
  const now = Timestamp.now();
  const nowMs = now.toMillis();

  // Guard: already clocked in?
  const open = await getLatestOpen(uid);
  if (open) {
    return {ok: true, already: true, punchId: open.id};
  }

  // Pull user details for name and hourly rate
  let userName = "";
  let hourlyRateCents = 0;
  try {
    const userSnap = await db.collection("users").doc(uid).get();
    if (userSnap.exists) {
      const userData = userSnap.data() as any;
      userName = userData.name || "";
      hourlyRateCents = userData.hourlyRateCents || 0;
    }
  } catch (e) {
    console.error(`Failed to fetch user ${uid} for clock-in:`, e);
  }

  const docRef = db.collection(`time_clock/${uid}/sessions`).doc();
  await docRef.set({
    uid,
    userName,
    role,
    inAt: now,
    outAt: null,
    durationSec: null,
    hourlyRateCentsAtClockIn: hourlyRateCents,
    costCents: null,
    dateKey: saDayKey(nowMs),
    createdAt: now,
    updatedAt: now,
  });

  return {ok: true, punchId: docRef.id};
});

export const clockOut = onCall({cors: true}, async (req) => {
  requireRole(req, STAFF_ROLES);
  const uid = req.auth!.uid;

  const open = await getLatestOpen(uid);
  if (!open) {
    return {ok: false, error: "No open shift to clock out."};
  }

  const outAt = Timestamp.now();
  const inAt: Timestamp = open.data.inAt;
  const durationSec = Math.max(0, Math.round((outAt.toMillis() - inAt.toMillis()) / 1000));

  const hourlyRate = open.data.hourlyRateCentsAtClockIn || 0;
  const costCents = Math.round((durationSec / 3600) * hourlyRate);

  await db.collection(`time_clock/${uid}/sessions`).doc(open.id).set({
    outAt,
    durationSec,
    costCents,
    updatedAt: outAt,
  }, {merge: true});

  return {ok: true, punchId: open.id, durationSec, costCents};
});

/** Admin/Manager CSV export by date range (SA) grouped by uid */
export const adminExportTimeCsv = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin", "manager"]);

  const startMs = Number(req.data?.startMs);
  const endMs = Number(req.data?.endMs);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    throw new Error("Provide startMs and endMs (millis, SA window).");
  }

  // Note: This is a collection group query. It requires an index.
  // The index can be created in the Firebase Console.
  // Collection ID: sessions, Fields: inAt (ASC), inAt (ASC)
  const snap = await db.collectionGroup("sessions")
    .where("inAt", ">=", Timestamp.fromMillis(startMs))
    .where("inAt", "<", Timestamp.fromMillis(endMs))
    .get();

  type Row = { uid: string; userName: string; inAt: number; outAt: number|null; durationSec: number|null; costCents: number|null; };
  const rows: Row[] = [];
  const byUser: Record<string, { totalSecs: number, totalCost: number }> = {};

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
      costCents: x.costCents || 0,
    });

    if (!byUser[x.uid]) byUser[x.uid] = {totalSecs: 0, totalCost: 0};
    byUser[x.uid]!.totalSecs += dur || 0;
    byUser[x.uid]!.totalCost += x.costCents || 0;
  });

  // Detailed CSV (per punch)
  const header = ["uid", "userName", "inAtISO", "outAtISO", "durationHours", "costZAR"];
  const det = rows.map((r) => ([
    r.uid,
    `"${r.userName}"`,
    new Date(r.inAt).toISOString(),
    r.outAt ? new Date(r.outAt).toISOString() : "",
    ( (r.durationSec||0) / 3600 ).toFixed(2),
    ( (r.costCents||0) / 100).toFixed(2),
  ].join(",")));

  // Summary CSV
  const summaryHeader = ["uid", "totalHours", "totalCostZAR"];
  const sum = Object.entries(byUser).map(([uid, totals]) => ([
    uid,
    (totals.totalSecs/3600).toFixed(2),
    (totals.totalCost/100).toFixed(2),
  ].join(",")));

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
  return {ok: true, filename: fname, csv};
});
