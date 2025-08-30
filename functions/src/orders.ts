import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { z } from "zod";
import { format } from "date-fns";

// ---------- Admin init (idempotent) ----------
if (!admin.apps.length) admin.initializeApp();
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

// ---------- Money / VAT (all amounts in cents) ----------
const VAT_RATE = 0.15;
// Split a VAT-inclusive cent amount into excl+vat (integer math, rounded to cents)
function splitVat(inclCents: number) {
  const excl = Math.round(inclCents / (1 + VAT_RATE));
  const vat = inclCents - excl;
  return { excl, vat };
}

// ---------- Zod Schemas ----------
const createOrderSchema = z.object({ note: z.string().optional() });
const setItemsSchema = z.object({
  orderId: z.string(),
  items: z.array(z.object({ productId: z.string(), qty: z.number().int().gt(0) })).min(1),
});
const takePaymentSchema = z.object({
  orderId: z.string(),
  type: z.enum(["cash", "card"]),
  amount: z.number().int().gt(0),
});
const closeOrderSchema = z.object({ orderId: z.string() });
const salesSummarySchema = z.object({
  fromISO: z.string().datetime(),
  toISO: z.string().datetime(),
});

// ---------- Utils ----------
async function getProductsByIds(ids: string[]) {
  // Firestore "in" supports up to 10 values. Chunk it.
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));

  const results = await Promise.all(
    chunks.map((c) =>
      db
        .collection("products")
        .where(admin.firestore.FieldPath.documentId(), "in", c)
        .get()
    )
  );

  const out = new Map<string, FirebaseFirestore.DocumentData>();
  for (const snap of results) {
    for (const doc of snap.docs) out.set(doc.id, doc.data());
  }
  return out;
}

// ===================================================================
// Create order (open)
// ===================================================================
export const cashierCreateOrder = onCall({ cors: true }, async (req) => {
  requireRole(req, ["admin", "manager", "cashier"]);
  const cashierId = req.auth!.uid;
  const cashierName =
    (req.auth!.token as any)?.name ||
    (req.auth!.token as any)?.email ||
    "Unknown";

  const { note } = createOrderSchema.parse(req.data);

  const orderRef = db.collection("orders").doc();
  await orderRef.set({
    status: "open",
    createdBy: cashierId,
    cashierName,
    items: [],
    totals: { subTotalEx: 0, vat: 0, totalInc: 0 },
    payments: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    currency: "ZAR",
    vatRate: VAT_RATE,
    note: note ?? null,
  });

  return { ok: true, orderId: orderRef.id };
});

// ===================================================================
// Set/replace items (recalculate totals from product.price.incCents)
// ===================================================================
export const cashierSetItems = onCall({ cors: true }, async (req) => {
  requireRole(req, ["admin", "manager", "cashier"]);
  const { orderId, items: cartItems } = setItemsSchema.parse(req.data);

  // Load products in chunks of 10
  const productIds = [...new Set(cartItems.map((i) => i.productId))];
  const productsById = await getProductsByIds(productIds);

  let subEx = 0,
    vat = 0,
    inc = 0;

  const orderItems = cartItems.map((ci) => {
    const product = productsById.get(ci.productId);
    if (!product) throw new HttpsError("not-found", `Product ${ci.productId} not found`);
    const priceInc = Number(product?.price?.incCents);
    const vatRate = Number(product?.price?.taxRate ?? VAT_RATE);
    if (!Number.isFinite(priceInc) || priceInc < 0) {
      throw new HttpsError("failed-precondition", `Invalid price for ${ci.productId}`);
    }

    const lineInc = priceInc * ci.qty;
    const { excl: lineEx, vat: lineVat } = splitVat(lineInc);

    subEx += lineEx;
    vat += lineVat;
    inc += lineInc;

    return {
      productId: ci.productId,
      name: String(product.name ?? ""),
      qty: ci.qty,
      priceEx: splitVat(priceInc).excl,
      vatRate,
      lineTotalEx: lineEx,
      vatAmount: lineVat,
      lineTotalInc: lineInc,
    };
  });

  await db.collection("orders").doc(orderId).update({
    items: orderItems,
    totals: { subTotalEx: subEx, vat, totalInc: inc },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true, totals: { subTotalEx: subEx, vat, totalInc: inc } };
});

// ===================================================================
// Take a payment (cash/card) – appends to payments[]
// ===================================================================
export const cashierTakePayment = onCall({ cors: true }, async (req) => {
  requireRole(req, ["admin", "manager", "cashier"]);
  const { orderId, type, amount } = takePaymentSchema.parse(req.data);

  const payment = {
    type,
    amount,
    ts: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db
    .collection("orders")
    .doc(orderId)
    .update({ payments: admin.firestore.FieldValue.arrayUnion(payment) });

  return { ok: true };
});

// ===================================================================
// Close order (ensure paid, write inventory movements, mark paid)
// ===================================================================
export const cashierCloseOrder = onCall({ cors: true }, async (req) => {
  requireRole(req, ["admin", "manager", "cashier"]);
  const { orderId } = closeOrderSchema.parse(req.data);

  const orderRef = db.collection("orders").doc(orderId);
  const productCol = db.collection("products");
  const ledgerCol = db.collection("inventory_ledger");

  // Do consistency work in a transaction to reduce race conditions
  await db.runTransaction(async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) throw new HttpsError("not-found", "Order not found");
    const order = orderSnap.data() as any;

    if (order.status === "paid") return; // idempotent

    const items: any[] = Array.isArray(order.items) ? order.items : [];
    const payments: any[] = Array.isArray(order.payments) ? order.payments : [];
    const totals = order.totals || { totalInc: 0 };

    const totalPaid = payments.reduce((s, p) => s + Number(p?.amount || 0), 0);
    if (totalPaid < Number(totals.totalInc || 0)) {
      throw new HttpsError("failed-precondition", "Insufficient payment");
    }

    // For each item: reduce stock and write ledger
    for (const item of items) {
      const pRef = productCol.doc(item.productId);
      const pSnap = await tx.get(pRef);
      const product = pSnap.data();
      if (!product || !product.trackStock) continue;

      const before = Number(product.stockOnHand || 0);
      const delta = -Number(item.qty || 0);
      const after = before + delta;

      // Allow oversell but record it (optional: throw instead)
      // if (after < 0) throw new HttpsError("failed-precondition", "Stock would go negative");

      const ledgerRef = ledgerCol.doc();
      tx.set(ledgerRef, {
        productId: item.productId,
        productSku: product.sku || "",
        productName: product.name || "",
        type: "sale",
        qty: item.qty,
        delta,
        before,
        after,
        note: `Order ${orderId}`,
        clientTxnId: `sale:${orderId}:${item.productId}`,
        userId: req.auth!.uid,
        userName:
          (req.auth!.token as any)?.name ||
          (req.auth!.token as any)?.email ||
          req.auth!.uid,
        ts: admin.firestore.FieldValue.serverTimestamp(),
      });

      tx.update(pRef, { stockOnHand: after, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }

    tx.update(orderRef, {
      status: "paid",
      closedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return { ok: true };
});

// ===================================================================
// Sales summary (paid orders within a range)
// ===================================================================
export const getSalesSummary = onCall({ cors: true }, async (req) => {
  requireRole(req, ["admin", "manager", "cashier"]);
  const { fromISO, toISO } = salesSummarySchema.parse(req.data);

  // Requires composite index: (status ASC, closedAt DESC)
  let q = db
    .collection("orders")
    .where("status", "==", "paid")
    .where("closedAt", ">=", new Date(fromISO))
    .where("closedAt", "<=", new Date(toISO))
    .orderBy("closedAt", "desc");

  const snap = await q.get();
  if (snap.empty) {
    return {
      ordersCount: 0,
      grossTotalIncl: 0,
      subTotalExcl: 0,
      vatTotal: 0,
      paymentsByMethod: { cash: 0, card: 0 },
      avgOrderValue: 0,
    };
  }

  let grossTotalIncl = 0;
  let subTotalExcl = 0;
  let vatTotal = 0;
  const paymentsByMethod = { cash: 0, card: 0 };

  snap.forEach((d) => {
    const o = d.data() as any;
    grossTotalIncl += Number(o?.totals?.totalInc || 0);
    subTotalExcl += Number(o?.totals?.subTotalEx || 0);
    vatTotal += Number(o?.totals?.vat || 0);
    for (const p of o?.payments || []) {
      if (p?.type === "cash") paymentsByMethod.cash += Number(p?.amount || 0);
      if (p?.type === "card") paymentsByMethod.card += Number(p?.amount || 0);
    }
  });

  return {
    ordersCount: snap.size,
    grossTotalIncl,
    subTotalExcl,
    vatTotal,
    paymentsByMethod,
    avgOrderValue: snap.size > 0 ? grossTotalIncl / snap.size : 0,
  };
});

// ===================================================================
// Admin export of paid orders to CSV (within date range)
// ===================================================================
export const adminExportOrders = onCall({ cors: true }, async (req) => {
  requireRole(req, ["admin", "manager"]);
  const { fromISO, toISO } = salesSummarySchema.parse(req.data);

  // Same composite index as above.
  const q = db
    .collection("orders")
    .where("status", "==", "paid")
    .where("closedAt", ">=", new Date(fromISO))
    .where("closedAt", "<=", new Date(toISO))
    .orderBy("closedAt", "desc");

  const snap = await q.get();

  const rows: string[] = [
    "orderId,createdAt,status,cashierName,subTotalExcl,vatTotal,totalIncl,paymentsTotal,changeDue",
  ];

  for (const d of snap.docs) {
    const o = d.data() as any;
    const createdAtISO = o?.createdAt?.toDate?.() ? o.createdAt.toDate().toISOString() : "";
    const subEx = Number(o?.totals?.subTotalEx || 0);
    const vat = Number(o?.totals?.vat || 0);
    const inc = Number(o?.totals?.totalInc || 0);
    const paymentsTotal = (o?.payments || []).reduce((s: number, p: any) => s + Number(p?.amount || 0), 0);
    const changeDue = Math.max(0, paymentsTotal - inc);

    const esc = (s: string | null | undefined) => `"${String(s ?? "").replace(/"/g, '""')}"`;

    rows.push(
      [
        d.id,
        createdAtISO,
        o?.status || "",
        esc(o?.cashierName),
        (subEx / 100).toFixed(2),
        (vat / 100).toFixed(2),
        (inc / 100).toFixed(2),
        (paymentsTotal / 100).toFixed(2),
        (changeDue / 100).toFixed(2),
      ].join(",")
    );
  }

  const csv = rows.join("\n");
  const dataBase64 = Buffer.from(csv).toString("base64");
  const dateStr = format(new Date(fromISO), "yyyy-MM-dd");

  return {
    filename: `orders-export-${dateStr}.csv`,
    mime: "text/csv",
    dataBase64,
  };
});
