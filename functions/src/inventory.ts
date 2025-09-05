/**
 * @fileoverview Cloud Functions for inventory and stock management.
 */
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import {format} from "date-fns";
import {db, requireRole, FieldValue} from "./utils.js";

type Req<T = any> = CallableRequest<T>;

/** Defines the types of stock movements allowed in the ledger. */
type MovementType = "receive" | "sale" | "refund" | "wastage" |
                    "adjust" | "set";

/**
 * Posts a stock movement to the inventory ledger and updates the product's
 * stock-on-hand count in a single transaction. Supports idempotency.
 */
export const adminPostStockMovement = onCall({ cors: true }, async (req: Req<{
  productId: string, 
  type: MovementType, 
  qty: number, 
  clientTxnId?: string, 
  adjustSign?: number, 
  note?: string
}>) => {
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
  const {before, after, delta} = await db.runTransaction(async (tx: any) => {
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
      ts: FieldValue.serverTimestamp(),
      clientTxnId: data.clientTxnId,
    });
    tx.update(productRef, {
      stockOnHand: after,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return {before, after, delta};
  });

  return {ok: true, before, after, delta, ledgerId: ledgerRef.id};
});
