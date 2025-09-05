import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { db, FieldValue, requireRole } from "./utils.js";
import { STAFF_ROLES } from "./roles.js";

type Req<T = any> = CallableRequest<T>;
const cfg = { cors: true, region: "us-central1" } as const;

// ---- Internal helper: create an order and return its id ----
async function createOrderInternal(opts: {
  note?: string | null;
  tableId?: string | null;
  uid?: string | null;
}): Promise<string> {
  const ref = db.collection("orders").doc();
  const now = FieldValue.serverTimestamp();
  await ref.set({
    id: ref.id,
    status: "open",
    note: opts.note ?? null,
    tableId: opts.tableId ?? null,
    lines: [],
    payments: [],
    totals: { subTotalEx: 0, vat: 0, totalInc: 0 },
    createdAt: now,
    updatedAt: now,
    createdBy: opts.uid ?? null,
  });
  return ref.id;
}

// ---------------- Orders ----------------

export const cashierCreateOrder = onCall(cfg, async (req: Req<{ note?: string; tableId?: string }>) => {
  requireRole(req, STAFF_ROLES);
  const { note = null, tableId = null } = req.data ?? {};
  const orderId = await createOrderInternal({ note, tableId, uid: req.auth?.uid ?? null });
  return { orderId };
});

export const cashierSetItems = onCall(
  cfg,
  async (req: Req<{ orderId: string; lines: { itemId: string; qty: number; priceCents: number }[] }>) => {
    requireRole(req, STAFF_ROLES);
    const { orderId, lines } = req.data ?? {};
    if (!orderId || !Array.isArray(lines)) {
      throw new HttpsError("invalid-argument", "Missing orderId or lines.");
    }

    // NOTE: Trusting client prices here (keep it simple for now).
    const totalInc = lines.reduce((sum, l) => sum + (l.priceCents || 0) * (l.qty || 0), 0);
    const subTotalEx = Math.round(totalInc / 1.15);
    const vat = totalInc - subTotalEx;

    await db.collection("orders").doc(orderId).update({
      lines,
      totals: { totalInc, subTotalEx, vat },
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { ok: true };
  }
);

export const cashierTakePayment = onCall(cfg, async (req: Req<{ orderId: string; payment: { method: string; amountCents: number } }>) => {
  requireRole(req, STAFF_ROLES);
  const { orderId, payment } = req.data ?? ({} as any);
  if (!orderId || !payment) throw new HttpsError("invalid-argument", "Missing orderId or payment.");

  await db.collection("orders").doc(orderId).update({
    payments: FieldValue.arrayUnion(payment),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { ok: true };
});

export const cashierCloseOrder = onCall(cfg, async (req: Req<{ orderId: string; payment?: { method: string; amountCents: number } }>) => {
  requireRole(req, STAFF_ROLES);
  const { orderId, payment } = req.data ?? ({} as any);
  if (!orderId) throw new HttpsError("invalid-argument", "Missing orderId.");

  const ref = db.collection("orders").doc(orderId);
  if (payment) {
    await ref.update({ payments: FieldValue.arrayUnion(payment) });
  }
  await ref.update({ status: "paid", updatedAt: FieldValue.serverTimestamp() });

  return { ok: true };
});

export const cashierRefundItems = onCall(cfg, async (req: Req<{ orderId: string; itemIds: string[] }>) => {
  requireRole(req, STAFF_ROLES);
  // TODO: implement proper credit note/store credit
  return { ok: true, message: "Refunds not fully implemented." };
});

// ---------------- Printing ----------------

export const printChecks = onCall(cfg, async (req: Req<{ orderId: string }>) => {
  requireRole(req, STAFF_ROLES);
  const { orderId } = req.data ?? ({} as any);
  if (!orderId) throw new HttpsError("invalid-argument", "orderId required");
  await db.collection("print_jobs").add({
    type: "receipt",
    orderId,
    createdAt: FieldValue.serverTimestamp(),
    status: "pending",
  });
  return { ok: true };
});

// ---------------- Tables / Floor ----------------

export const openTableTab = onCall(cfg, async (req: Req<{ tableId: string; locationId?: string }>) => {
  requireRole(req, STAFF_ROLES);
  const { tableId, locationId = null } = req.data ?? ({} as any);
  if (!tableId) throw new HttpsError("invalid-argument", "tableId required");

  const orderId = await createOrderInternal({
    note: `Table ${tableId}`,
    tableId,
    uid: req.auth?.uid ?? null,
  });

  await db
    .collection("table_state")
    .doc(tableId)
    .set(
      {
        id: tableId,
        locationId,
        status: "occupied",
        orderId,
        serverUserId: req.auth?.uid ?? null,
        since: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  return { ok: true, orderId };
});

export const closeTableTab = onCall(cfg, async (req: Req<{ tableId: string }>) => {
  requireRole(req, STAFF_ROLES);
  const { tableId } = req.data ?? ({} as any);
  if (!tableId) throw new HttpsError("invalid-argument", "tableId required");

  await db.collection("table_state").doc(tableId).update({
    status: "open",
    orderId: null,
    serverUserId: null,
    since: null,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { ok: true };
});

export const moveTabToTable = onCall(cfg, async (_req: Req<{ fromTableId: string; toTableId: string }>) => {
  requireRole(_req, STAFF_ROLES);
  return { ok: true, message: "Not implemented" };
});

export const splitCheck = onCall(cfg, async (_req: Req<{ orderId: string; splits: any }>) => {
  requireRole(_req, STAFF_ROLES);
  return { ok: true, message: "Not implemented" };
});

export const mergeChecks = onCall(cfg, async (_req: Req<{ orderIds: string[] }>) => {
  requireRole(_req, STAFF_ROLES);
  return { ok: true, message: "Not implemented" };
});

export const transferItems = onCall(cfg, async (_req: Req<{ fromOrderId: string; toOrderId: string; itemIds: string[] }>) => {
  requireRole(_req, STAFF_ROLES);
  return { ok: true, message: "Not implemented" };
});
