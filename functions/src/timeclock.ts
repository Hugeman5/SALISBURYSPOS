
/**
 * @fileoverview Cloud Functions for employee time clock management.
 */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import {Timestamp} from "firebase-admin/firestore";
import {db, requireRole, Role, STAFF_ROLES} from "./utils";

/**
 * Generates a 'YYYY-MM-DD' key for a given millisecond timestamp in the
 * Africa/Johannesburg timezone.
 * @param {number} ms Millisecond timestamp.
 * @return {string} The date key.
 */
function saDayKey(ms: number): string {
  const d = new Date(ms);
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  return f.format(d);
}

/**
 * Finds the most recent open time clock session for a user.
 * @param {string} uid The user ID.
 * @return {Promise<{id: string, data: any} | null>} The session doc or null.
 */
async function getLatestOpen(uid: string) {
  const snap = await db.collection("time_clock")
    .where("uid", "==", uid)
    .where("outAt", "==", null)
    .orderBy("inAt", "desc")
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return {id: doc.id, data: doc.data()};
}

/**
 * Clocks a user in, creating a new session document.
 * It's idempotent; if the user is already clocked in, it returns success.
 */
export const clockIn = onCall({cors: true}, async (req) => {
  const role: Role = requireRole(req, STAFF_ROLES);
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Auth is required.");

  const now = Timestamp.now();
  const open = await getLatestOpen(uid);
  if (open) {
    return {ok: true, already: true, punchId: open.id};
  }

  const userSnap = await db.collection("users").doc(uid).get();
  const userData = userSnap.exists ? userSnap.data() : {};
  if (!userData || !userData.active) {
    throw new HttpsError("failed-precondition", "User account is not active.");
  }

  const userName = userData?.name || "";
  const hourlyRateCents = userData?.hourlyRateCents || 0;

  const docRef = db.collection("time_clock").doc();
  await docRef.set({
    uid, userName, role, inAt: now, outAt: null, durationSec: null,
    hourlyRateCentsAtClockIn: hourlyRateCents, costCents: null,
    dateKey: saDayKey(now.toMillis()), createdAt: now, updatedAt: now,
  });

  return {ok: true, punchId: docRef.id};
});

/**
 * Clocks a user out, updating their latest open session with an end time
 * and calculated duration and cost.
 */
export const clockOut = onCall({cors: true}, async (req) => {
  requireRole(req, STAFF_ROLES);
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Auth is required.");

  const open = await getLatestOpen(uid);
  if (!open) {
    return {ok: false, error: "No open shift to clock out."};
  }

  const outAt = Timestamp.now();
  const inAt = open.data.inAt as Timestamp;
  const durationSec = Math.max(0,
    Math.round((outAt.toMillis() - inAt.toMillis()) / 1000));
  const hourlyRate = open.data.hourlyRateCentsAtClockIn || 0;
  const costCents = Math.round((durationSec / 3600) * hourlyRate);

  await db.collection("time_clock").doc(open.id).update({
    outAt, durationSec, costCents, updatedAt: outAt,
  });

  return {ok: true, punchId: open.id, durationSec, costCents};
});

/**
 * Exports time clock sessions within a date range to a CSV string.
 */
export const adminExportTimeCsv = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin", "manager"]);
  const {startMs, endMs} = req.data as {startMs?: number, endMs?: number};
  if (!startMs || !endMs || endMs <= startMs) {
    const msg = "Valid startMs and endMs are required.";
    throw new HttpsError("invalid-argument", msg);
  }

  const snap = await db.collection("time_clock")
    .where("inAt", ">=", Timestamp.fromMillis(startMs))
    .where("inAt", "<", Timestamp.fromMillis(endMs))
    .get();

  interface Row {
    uid: string; userName: string; inAt: number; outAt: number | null;
    durationSec: number; costCents: number;
  }
  const rows: Row[] = [];
  const byUser: Record<string, { totalSecs: number; totalCost: number; }> = {};

  snap.forEach((doc) => {
    const s = doc.data();
    const inMs = (s.inAt as Timestamp).toMillis();
    const outMs = s.outAt ? (s.outAt as Timestamp).toMillis() : null;
    const dur = s.durationSec ?? (outMs ?
      Math.max(0, (outMs-inMs)/1000) : 0);
    rows.push({
      uid: s.uid, userName: s.userName || "", inAt: inMs, outAt: outMs,
      durationSec: dur, costCents: s.costCents || 0,
    });
    if (!byUser[s.uid]) byUser[s.uid] = {totalSecs: 0, totalCost: 0};
    byUser[s.uid].totalSecs += dur;
    byUser[s.uid].totalCost += s.costCents || 0;
  });

  const header = [
    "uid", "userName", "inAtISO", "outAtISO", "durationHours", "costZAR",
  ];
  const det = rows.map((r) => [
    r.uid, `"${r.userName}"`, new Date(r.inAt).toISOString(),
    r.outAt ? new Date(r.outAt).toISOString() : "",
    (r.durationSec / 3600).toFixed(2), (r.costCents / 100).toFixed(2),
  ].join(","));

  const sumHeader = ["uid", "totalHours", "totalCostZAR"];
  const sum = Object.entries(byUser).map(([uid, t]) => [
    uid, (t.totalSecs/3600).toFixed(2), (t.totalCost/100).toFixed(2),
  ].join(","));

  const csv = ["# DETAIL", header.join(","), ...det, "",
    "# SUMMARY", sumHeader.join(","), ...sum].join("\n");
  const fname = `time_${saDayKey(startMs)}_${saDayKey(endMs - 1)}.csv`;
  return {ok: true, filename: fname, csv};
});
