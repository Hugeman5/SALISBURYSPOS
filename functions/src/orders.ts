/**
 * @fileoverview Cloud Functions for order management and processing.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { z } from "zod";
import { db, requireRole } from "./utils";

const VAT_RATE = 0.15;

/**
 * Splits a VAT-inclusive price in cents into its exclusive and VAT parts.
 * @param inclCents - The total price including VAT, in cents.
 * @returns The price excluding VAT and the VAT amount.
 */
function splitVat(inclCents: number) {
  const excl = Math.round(inclCents / (1 + VAT_RATE));
  const vat = inclCents - excl;
  return { excl, vat };
}

// --- Zod Schemas for Input Validation ---
const createOrderSchema = z.object({ note: z.string().optional() });
const setItemsSchema = z.object({
  orderId: z.string(),
  items: z.array(
    z.object({ productId: z.string(), qty: z.number().int().gt(0) })
  ).min(1),
});
const takePaymentSchema = z.object({
  orderId: z.string(),
  type: z.enum(["cash", "card"]),
  amount: z.number().int().gt(0),
});
const closeOrderSchema = z.object({ orderId: z.string() });

const refundItemsSchema = z.object({
  originalOrderId: z.string(),
  items: z.array(
    z.object({
      productId: z.string(),
      qty: z.number().int().gt(0),
      priceInc: z.number().int(),
      name: z.string(),
    })
  ).min(1),
  method: z.enum(["cash", "card"]),
  reason: z.string().optional(),
});


/**
 * Fetches product details for a list of product IDs.
 * @param ids - An array of product IDs.
 * @returns A map of product data.
 */
async function getProductsByIds(ids: string[]) {
  if (ids.length === 0) return new Map();
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 30) {
    chunks.push(ids.slice(i, i + 30));
  }
  const results = await Promise.all(
    chunks.map((c) => db.collection("products")
      .where(admin.firestore.FieldPath.documentId(), "in", c).get())
  );
  const out = new Map<string, FirebaseFirestore.DocumentData>();
  for (const snap of results) {
    for (const doc of snap.docs) out.set(doc.id, doc.data());
  }
  return out;
}

/** Creates a new order with a status of "open". */
export const cashierCreateOrder = onCall({ cors: true }, async (req) => {
  requireRole(req, ["admin", "manager", "cashier"]);
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Auth is required.");
  const actor = {
    uid,
    name: req.auth?.token?.name || req.auth?.token?.email || "Unknown",
  };
  const { note } = createOrderSchema.parse(req.data);

  const orderRef = db.collection("orders").doc();
  await orderRef.set({
    status: "open", createdBy: actor.uid, cashierName: actor.name, items: [],
    totals: { subTotalEx: 0, vat: 0, totalInc: 0 }, payments: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    currency: "ZAR", vatRate: VAT_RATE, note: note ?? null,
  });
  return { ok: true, orderId: orderRef.id };
});

/** Sets or replaces the items in an order, recalculating totals. */
export const cashierSetItems = onCall({ cors: true }, async (req) => {
  requireRole(req, ["admin", "manager", "cashier"]);
  const { orderId, items: cartItems } = setItemsSchema.parse(req.data);
  const productIds = [...new Set(cartItems.map((i) => i.productId))];
  const productsById = await getProductsByIds(productIds);

  let subEx = 0; let vat = 0; let inc = 0;
  const orderItems = cartItems.map((ci) => {
    const p = productsById.get(ci.productId);
    if (!p) {
      throw new HttpsError("not-found", `Product ${ci.productId} not found`);
    }
    const priceInc = Number(p.price?.incCents);
    const vatRate = Number(p.price?.taxRate ?? VAT_RATE);
    if (!Number.isFinite(priceInc) || priceInc < 0) {
      const msg = `Invalid price for ${ci.productId}`;
      throw new HttpsError("failed-precondition", msg);
    }
    const lineInc = priceInc * ci.qty;
    const { excl: lineEx, vat: lineVat } = splitVat(lineInc);
    subEx += lineEx; vat += lineVat; inc += lineInc;
    return {
      productId: ci.productId, name: String(p.name ?? ""), qty: ci.qty,
      priceEx: splitVat(priceInc).excl, vatRate, lineTotalEx: lineEx,
      vatAmount: lineVat, lineTotalInc: lineInc, priceInc: priceInc,
    };
  });

  await db.collection("orders").doc(orderId).update({
    items: orderItems, totals: { subTotalEx: subEx, vat, totalInc: inc },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { ok: true, totals: { subTotalEx: subEx, vat, totalInc: inc } };
});

/** Adds a payment record to an order. */
export const cashierTakePayment = onCall({ cors: true }, async (req) => {
  requireRole(req, ["admin", "manager", "cashier"]);
  const { orderId, type, amount } = takePaymentSchema.parse(req.data);
  const payment = {
    type, amount, ts: admin.firestore.FieldValue.serverTimestamp(),
  };
  await db.collection("orders").doc(orderId)
    .update({ payments: admin.firestore.FieldValue.arrayUnion(payment) });
  return { ok: true };
});

/** Closes an order, validates payment, and creates inventory movements. */
export const cashierCloseOrder = onCall({ cors: true }, async (req) => {
  requireRole(req, ["admin", "manager", "cashier"]);
  const { orderId } = closeOrderSchema.parse(req.data);
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Auth is required.");
  const actorName = req.auth?.token?.name || req.auth?.token?.email || uid;

  const orderRef = db.collection("orders").doc(orderId);
  const ledgerCol = db.collection("inventory_ledger");

  await db.runTransaction(async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) throw new HttpsError("not-found", "Order not found");
    const order = orderSnap.data() || {};
    if (order.status === "paid") return; // Idempotent

    const items = Array.isArray(order.items) ? order.items : [];
    const payments = Array.isArray(order.payments) ? order.payments : [];
    const totals = order.totals || { totalInc: 0 };
    const totalPaid = payments.reduce((s, p) => s + Number(p?.amount || 0), 0);
    if (totalPaid < Number(totals.totalInc || 0)) {
      throw new HttpsError("failed-precondition", "Insufficient payment");
    }

    // This part should be batched for efficiency
    const productIds = items.map((item) => item.productId);
    const productsById = await getProductsByIds(productIds);

    for (const item of items) {
      const p = productsById.get(item.productId);
      if (!p || !p.trackStock) continue;

      const before = Number(p.stockOnHand || 0);
      const delta = -Number(item.qty || 0);
      const after = before + delta;

      const ledgerRef = ledgerCol.doc();
      tx.set(ledgerRef, {
        productId: item.productId, productSku: p.sku || "",
        productName: p.name || "", type: "sale", qty: item.qty, delta,
        before, after, note: `Order ${orderId}`,
        clientTxnId: `sale:${orderId}:${item.productId}`, userId: uid,
        userName: actorName,
        ts: admin.firestore.FieldValue.serverTimestamp(),
      });
      tx.update(db.collection("products").doc(item.productId), {
        stockOnHand: after,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    tx.update(orderRef, {
      status: "paid", closedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  return { ok: true };
});

/** Processes an itemized refund for a paid order. */
export const cashierRefundItems = onCall({ cors: true }, async (req) => {
    requireRole(req, ["admin", "manager", "cashier"]);
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Auth is required.");
    const actor = {
      uid,
      name: req.auth?.token?.name || req.auth?.token?.email || uid,
    };
  
    const { originalOrderId, items, method, reason } =
      refundItemsSchema.parse(req.data);
  
    const totalRefundAmount = items.reduce((sum, item) =>
      sum + (item.priceInc * item.qty), 0);
  
    const orderRef = db.collection("orders").doc(originalOrderId);
    const refundRef = orderRef.collection("refunds").doc();
  
    await db.runTransaction(async (tx) => {
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists) {
        throw new HttpsError("not-found", "Original order not found.");
      }
      if (orderSnap.data()?.status !== "paid") {
        throw new HttpsError(
          "failed-precondition", "Can only refund paid orders."
        );
      }
  
      // Handle inventory update
      for (const item of items) {
        const productRef = db.collection("products").doc(item.productId);
        const productSnap = await tx.get(productRef);
        const product = productSnap.data();
  
        if (product?.trackStock) {
          const before = Number(product.stockOnHand || 0);
          const delta = Number(item.qty);
          const after = before + delta;
          const ledgerRef = db.collection("inventory_ledger").doc();
  
          tx.set(ledgerRef, {
            productId: item.productId,
            productName: product.name || "",
            productSku: product.sku || "",
            type: "refund",
            qty: item.qty,
            delta,
            before,
            after,
            note: `Refund for order ${originalOrderId}`,
            userId: actor.uid,
            userName: actor.name,
            ts: admin.firestore.FieldValue.serverTimestamp(),
            clientTxnId: `refund:${refundRef.id}:${item.productId}`,
          });
          tx.update(productRef, { stockOnHand: after });
        }
      }
  
      // Handle cash payout if necessary
      if (method === "cash") {
        const openSessionSnap = await db.collection("register_sessions")
          .where("status", "==", "open")
          .limit(1)
          .get();
        if (openSessionSnap.empty) {
          throw new HttpsError(
            "failed-precondition", "No open register session for cash refund."
          );
        }
        const sessionRef = openSessionSnap.docs[0].ref;
        const session = openSessionSnap.docs[0].data();
        const movementRef = sessionRef.collection("cash_movements").doc();
        const delta = -totalRefundAmount;
  
        tx.update(sessionRef, {
          expectedCash: admin.firestore.FieldValue.increment(delta),
        });
        tx.set(movementRef, {
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          by: actor,
          type: "payout",
          amount: delta,
          reason: `Refund: Order ${originalOrderId.slice(0, 8)}`,
        });
      }
  
      // Create the refund document
      tx.set(refundRef, {
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: actor,
        originalOrderId,
        items,
        method,
        reason: reason ?? null,
        totalRefundAmount,
      });
    });
  
    return {
      ok: true,
      refundId: refundRef.id,
      totalInc: totalRefundAmount,
    };
  });
