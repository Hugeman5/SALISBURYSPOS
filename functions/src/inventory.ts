import {onCall, HttpsError, type CallableRequest} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {format} from "date-fns";

// ---------- Admin initialization (safe across hot reloads) ----------
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// ---------- Auth helpers ----------
type Role = "admin" | "manager" | "cashier" | "waiter" | "kitchen";

function requireRole(req: CallableRequest, allowed: Role[]) {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign-in required.");
  const role = (req.auth.token as any)?.role as Role | undefined;
  if (!role || !allowed.includes(role)) {
    throw new HttpsError("permission-denied", "Insufficient permissions.");
  }
  return role;
}

// ---------- Inventory types ----------
type MovementType = "receive" | "sale" | "refund" | "wastage" | "adjust" | "set";

// ===================================================================
// Post a stock movement (receive/sale/refund/wastage/adjust/set)
// ===================================================================
export const adminPostStockMovement = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin", "manager"]);

  const uid = req.auth!.uid;
  const actorName =
    (req.auth!.token as any)?.name ||
    (req.auth!.token as any)?.email ||
    uid;

  const {
    productId,
    type,
    qty,
    note = null,
    clientTxnId = null,
    adjustSign = 1,
  } = (req.data ?? {}) as {
    productId?: string;
    type?: MovementType | string;
    qty?: number;
    note?: string | null;
    clientTxnId?: string | null;
    adjustSign?: number;
  };

  // ---- Validation ----
  if (!productId || typeof productId !== "string") {
    throw new HttpsError("invalid-argument", "productId required (string).");
  }
  const validTypes: MovementType[] = ["receive", "sale", "refund", "wastage", "adjust", "set"];
  if (!type || !validTypes.includes(type as MovementType)) {
    throw new HttpsError("invalid-argument", "Invalid movement type.");
  }
  if (typeof qty !== "number" || !Number.isInteger(qty) || qty < 0) {
    throw new HttpsError("invalid-argument", "qty must be a non-negative integer.");
  }

  // ---- Idempotency: same clientTxnId + productId => return existing ----
  if (clientTxnId) {
    const dupQ = await db
      .collection("inventory_ledger")
      .where("clientTxnId", "==", clientTxnId)
      .where("productId", "==", productId)
      .limit(1)
      .get();
    if (!dupQ.empty) {
      const existing = dupQ.docs[0].data();
      return {ok: true, ...existing, duplicate: true};
    }
  }

  const productRef = db.collection("products").doc(productId);
  const ledgerRef = db.collection("inventory_ledger").doc();

  // ---- Transaction: compute delta/after, update product, write ledger ----
  const {before, after, delta} = await db.runTransaction(async (tx) => {
    const snap = await tx.get(productRef);
    if (!snap.exists) throw new HttpsError("not-found", "Product not found.");
    const product = snap.data()!;

    if (!product.trackStock) {
      throw new HttpsError("failed-precondition", "Product does not track stock.");
    }

    const before = Number(product.stockOnHand || 0);
    let delta = 0;
    let after = before;

    switch (type as MovementType) {
    case "receive":
    case "refund":
      delta = qty;
      after = before + delta;
      break;
    case "sale":
    case "wastage":
      delta = -qty;
      after = before + delta;
      break;
    case "adjust": {
      const s = adjustSign === -1 ? -1 : 1;
      delta = qty * s;
      after = before + delta;
      break;
    }
    case "set":
      after = qty;
      delta = after - before;
      break;
    }

    if (after < 0) {
      throw new HttpsError("failed-precondition", "Stock cannot be negative.");
    }

    const ledgerEntry = {
      productId,
      productSku: product.sku || "",
      productName: product.name || "",
      type,
      qty,
      delta,
      before,
      after,
      note,
      userId: uid,
      userName: actorName,
      ts: admin.firestore.FieldValue.serverTimestamp(),
      clientTxnId,
    };

    tx.set(ledgerRef, ledgerEntry);
    tx.update(productRef, {
      stockOnHand: after,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {before, after, delta};
  });

  return {ok: true, before, after, delta, ledgerId: ledgerRef.id};
});

// ===================================================================
// Export inventory ledger to CSV (optionally filtered by product/type/ts)
// Smart querying to avoid unnecessary composite index requirements.
// ===================================================================
export const adminExportLedger = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin", "manager"]);

  const {productId, type, fromTs, toTs} = (req.data ?? {}) as {
    productId?: string;
    type?: MovementType | string;
    fromTs?: string | number | Date;
    toTs?: string | number | Date;
  };

  // Build a base query and avoid forcing "productId + type + ts" all together.
  // If BOTH productId and type are provided, we’ll query by productId + ts and filter type in-memory.
  const rangeFrom = fromTs ? new Date(fromTs) : undefined;
  const rangeTo = toTs ? new Date(toTs) : undefined;

  const baseCol = db.collection("inventory_ledger");

  let q:
    | FirebaseFirestore.Query<FirebaseFirestore.DocumentData>
    | FirebaseFirestore.CollectionReference<FirebaseFirestore.DocumentData> = baseCol;

  // If both are provided, prefer productId + ts (usually the more selective),
  // then filter by `type` after fetch to avoid requiring a triple composite index.
  const willFilterTypeInMemory = Boolean(productId && type);

  if (productId) q = q.where("productId", "==", productId);
  else if (type) q = q.where("type", "==", type as MovementType);

  // Order by ts desc and add range if provided (this requires a simple composite index for whichever equality is used).
  q = q.orderBy("ts", "desc");
  if (rangeFrom) q = q.where("ts", ">=", rangeFrom);
  if (rangeTo) q = q.where("ts", "<", rangeTo);

  // Cap to something large but bounded
  const snap = await q.limit(50000).get();

  const rows: string[] = [
    "ts,productId,productSku,productName,type,qty,delta,before,after,userId,userName,note,clientTxnId",
  ];

  for (const d of snap.docs) {
    const v = d.data() as any;

    if (willFilterTypeInMemory && v.type !== type) continue;

    const tsStr =
      v.ts?.toDate?.() ? format(v.ts.toDate(), "yyyy-MM-dd'T'HH:mm:ssXXX") : "";

    // Basic CSV escaping for strings
    const esc = (s: string | null | undefined) =>
      `"${String(s ?? "").replace(/"/g, "\"\"")}"`;

    rows.push(
      [
        tsStr,
        v.productId,
        v.productSku || "",
        esc(v.productName),
        v.type,
        v.qty,
        v.delta,
        v.before,
        v.after,
        v.userId,
        esc(v.userName),
        esc(v.note),
        v.clientTxnId || "",
      ].join(",")
    );
  }

  const csv = rows.join("\n");
  const dataBase64 = Buffer.from(csv).toString("base64");

  return {
    filename: `inventory-ledger-${format(new Date(), "yyyyMMdd-HHmm")}.csv`,
    mime: "text/csv",
    dataBase64,
  };
});
