/**
 * @fileoverview Cloud Functions for inventory and stock management.
 */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {format} from "date-fns";
import {db, requireRole} from "./utils";

/** Defines the types of stock movements allowed in the ledger. */
type MovementType = "receive" | "sale" | "refund" | "wastage" |
                    "adjust" | "set";

/**
 * Posts a stock movement to the inventory ledger and updates the product's
 * stock-on-hand count in a single transaction. Supports idempotency.
 */
export const adminPostStockMovement = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin", "manager"]);
  const uid = req.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const actorName = req.auth?.token?.name || req.auth?.token?.email || uid;
  const data = req.data;

  // --- Validation ---
  if (!data.productId) {
    throw new HttpsError("invalid-argument", "productId is required.");
  }
  const validTypes: MovementType[] = [
    "receive", "sale", "refund", "wastage", "adjust", "set",
  ];
  if (!validTypes.includes(data.type)) {
    throw new HttpsError("invalid-argument", "Invalid movement type.");
  }
  if (typeof data.qty !== "number" || !Number.isInteger(data.qty) ||
      data.qty < 0) {
    const msg = "qty must be a non-negative integer.";
    throw new HttpsError("invalid-argument", msg);
  }

  // --- Idempotency Check ---
  if (data.clientTxnId) {
    const dupSnap = await db.collection("inventory_ledger")
      .where("clientTxnId", "==", data.clientTxnId)
      .where("productId", "==", data.productId)
      .limit(1).get();
    if (!dupSnap.empty) {
      return {ok: true, ...dupSnap.docs[0].data(), duplicate: true};
    }
  }

  const productRef = db.collection("products").doc(data.productId);
  const ledgerRef = db.collection("inventory_ledger").doc();

  // --- Transaction ---
  const {before, after, delta} = await db.runTransaction(async (tx) => {
    const snap = await tx.get(productRef);
    if (!snap.exists) throw new HttpsError("not-found", "Product not found.");
    const product = snap.data() || {};
    if (!product.trackStock) {
      const msg = "Product does not track stock.";
      throw new HttpsError("failed-precondition", msg);
    }

    const before = Number(product.stockOnHand || 0);
    let delta = 0;
    let after = before;
    const qty = data.qty;

    switch (data.type) {
    case "receive": case "refund": delta = qty; break;
    case "sale": case "wastage": delta = -qty; break;
    case "adjust": delta = qty * (data.adjustSign === -1 ? -1 : 1); break;
    case "set": after = qty; delta = after - before; break;
    }
    if (data.type !== "set") after = before + delta;
    if (after < 0) {
      throw new HttpsError("failed-precondition", "Stock cannot go negative.");
    }

    tx.set(ledgerRef, {
      productId: data.productId, productName: product.name || "",
      productSku: product.sku || "", type: data.type, qty, delta,
      before, after, note: data.note || null, userId: uid, userName: actorName,
      ts: admin.firestore.FieldValue.serverTimestamp(),
      clientTxnId: data.clientTxnId,
    });
    tx.update(productRef, {
      stockOnHand: after,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return {before, after, delta};
  });

  return {ok: true, before, after, delta, ledgerId: ledgerRef.id};
});

/**
 * Exports the inventory ledger to a CSV file, with optional filters.
 */
export const adminExportLedger = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin", "manager"]);
  const data = req.data;
  const {productId, type, fromTs, toTs} = data;
  const rangeFrom = fromTs ? new Date(fromTs) : undefined;
  const rangeTo = toTs ? new Date(toTs) : undefined;
  let q = db.collection("inventory_ledger").orderBy("ts", "desc");

  // To avoid needing a composite index, we only filter on one field + ts
  const willFilterTypeInMemory = !!(productId && type);
  if (productId) q = q.where("productId", "==", productId);
  else if (type) q = q.where("type", "==", type);
  if (rangeFrom) q = q.where("ts", ">=", rangeFrom);
  if (rangeTo) q = q.where("ts", "<", rangeTo);

  const snap = await q.limit(50000).get();
  const rows = [
    "ts,productId,productSku,productName,type,qty,delta,before,after," +
    "userId,userName,note,clientTxnId",
  ];

  for (const doc of snap.docs) {
    const v = doc.data();
    if (willFilterTypeInMemory && v.type !== type) continue;
    const tsDate = v.ts?.toDate?.();
    const tsStr = tsDate ? format(tsDate, "yyyy-MM-dd'T'HH:mm:ssXXX") : "";
    const esc = (s: string|null|undefined) =>
      `"${String(s??"").replace(/"/g, "\"\"")}"`;
    rows.push([
      tsStr, v.productId, v.productSku || "", esc(v.productName), v.type,
      v.qty, v.delta, v.before, v.after, v.userId, esc(v.userName),
      esc(v.note), v.clientTxnId || "",
    ].join(","));
  }

  const csv = rows.join("\n");
  const dataBase64 = Buffer.from(csv).toString("base64");
  return {
    filename: `inventory-ledger-${format(new Date(), "yyyyMMdd-HHmm")}.csv`,
    mime: "text/csv", dataBase64,
  };
});
