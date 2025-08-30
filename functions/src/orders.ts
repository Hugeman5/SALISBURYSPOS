/**
 * @fileoverview Cloud Functions for order management and processing.
 */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {z} from "zod";
import {db, requireRole} from "./utils";

const VAT_RATE = 0.15;

/**
 * Splits a VAT-inclusive price in cents into its exclusive and VAT parts.
 * @param {number} inclCents - The total price including VAT, in cents.
 * @return {{excl: number, vat: number}} The price excluding VAT and the VAT amount.
 */
function splitVat(inclCents: number) {
  const excl = Math.round(inclCents / (1 + VAT_RATE));
  const vat = inclCents - excl;
  return {excl, vat};
}

// --- Zod Schemas for Input Validation ---
const createOrderSchema = z.object({note: z.string().optional()});
const setItemsSchema = z.object({
  orderId: z.string(),
  items: z.array(
    z.object({productId: z.string(), qty: z.number().int().gt(0)})
  ).min(1),
});
const takePaymentSchema = z.object({
  orderId: z.string(),
  type: z.enum(["cash", "card"]),
  amount: z.number().int().gt(0),
});
const closeOrderSchema = z.object({orderId: z.string()});

/**
 * Fetches product details for a list of product IDs.
 * @param {string[]} ids - An array of product IDs.
 * @return {Promise<Map<string, FirebaseFirestore.DocumentData>>} A map of data.
 */
async function getProductsByIds(ids: string[]) {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
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
export const cashierCreateOrder = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin", "manager", "cashier"]);
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Auth is required.");
  const cashierName = req.auth?.token?.name || req.auth?.token?.email || "Unknown";
  const {note} = createOrderSchema.parse(req.data);

  const orderRef = db.collection("orders").doc();
  await orderRef.set({
    status: "open", createdBy: uid, cashierName, items: [],
    totals: {subTotalEx: 0, vat: 0, totalInc: 0}, payments: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    currency: "ZAR", vatRate: VAT_RATE, note: note ?? null,
  });
  return {ok: true, orderId: orderRef.id};
});

/** Sets or replaces the items in an order, recalculating totals. */
export const cashierSetItems = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin", "manager", "cashier"]);
  const {orderId, items: cartItems} = setItemsSchema.parse(req.data);
  const productIds = [...new Set(cartItems.map((i) => i.productId))];
  const productsById = await getProductsByIds(productIds);

  let subEx=0; let vat=0; let inc=0;
  const orderItems = cartItems.map((ci) => {
    const p = productsById.get(ci.productId);
    if (!p) {
      throw new HttpsError("not-found", `Product ${ci.productId} not found`);
    }
    const priceInc = Number(p.price?.incCents);
    const vatRate = Number(p.price?.taxRate ?? VAT_RATE);
    if (!Number.isFinite(priceInc) || priceInc<0) {
      const msg = `Invalid price for ${ci.productId}`;
      throw new HttpsError("failed-precondition", msg);
    }
    const lineInc = priceInc * ci.qty;
    const {excl: lineEx, vat: lineVat} = splitVat(lineInc);
    subEx += lineEx; vat += lineVat; inc += lineInc;
    return {
      productId: ci.productId, name: String(p.name??""), qty: ci.qty,
      priceEx: splitVat(priceInc).excl, vatRate, lineTotalEx: lineEx,
      vatAmount: lineVat, lineTotalInc: lineInc,
    };
  });

  await db.collection("orders").doc(orderId).update({
    items: orderItems, totals: {subTotalEx: subEx, vat, totalInc: inc},
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return {ok: true, totals: {subTotalEx: subEx, vat, totalInc: inc}};
});

/** Adds a payment record to an order. */
export const cashierTakePayment = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin", "manager", "cashier"]);
  const {orderId, type, amount} = takePaymentSchema.parse(req.data);
  const payment = {
    type, amount, ts: admin.firestore.FieldValue.serverTimestamp(),
  };
  await db.collection("orders").doc(orderId)
    .update({payments: admin.firestore.FieldValue.arrayUnion(payment)});
  return {ok: true};
});

/** Closes an order, validates payment, and creates inventory movements. */
export const cashierCloseOrder = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin", "manager", "cashier"]);
  const {orderId} = closeOrderSchema.parse(req.data);
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Auth is required.");

  const orderRef = db.collection("orders").doc(orderId);
  const ledgerCol = db.collection("inventory_ledger");

  await db.runTransaction(async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) throw new HttpsError("not-found", "Order not found");
    const order = orderSnap.data() || {};
    if (order.status === "paid") return; // Idempotent

    const items = Array.isArray(order.items) ? order.items : [];
    const payments = Array.isArray(order.payments) ? order.payments : [];
    const totals = order.totals || {totalInc: 0};
    const totalPaid = payments.reduce((s, p) => s + Number(p?.amount || 0), 0);
    if (totalPaid < Number(totals.totalInc || 0)) {
      throw new HttpsError("failed-precondition", "Insufficient payment");
    }

    for (const item of items) {
      const pRef = db.collection("products").doc(item.productId);
      const pSnap = await tx.get(pRef);
      const p = pSnap.data();
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
        userName: req.auth?.token?.name || req.auth?.token?.email || uid,
        ts: admin.firestore.FieldValue.serverTimestamp(),
      });
      tx.update(pRef, {
        stockOnHand: after,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    tx.update(orderRef, {
      status: "paid", closedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  return {ok: true};
});
