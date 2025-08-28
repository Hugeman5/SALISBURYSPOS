
import {onCall} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {format} from "date-fns";

type Role = "admin" | "manager" | "cashier" | "waiter" | "kitchen";

function requireRole(context: any, allowed: Role[]) {
  const role = context?.auth?.token?.role as Role | undefined;
  if (!role || !allowed.includes(role)) throw new Error("PERMISSION_DENIED");
  return role;
}

const db = admin.firestore();

type MovementType = "receive" | "sale" | "refund" | "wastage" | "adjust" | "set";

export const adminPostStockMovement = onCall({cors: true}, async (req) => {
  const role = requireRole(req, ["admin", "manager"]);
  const userId = req.auth!.uid;

  const {
    productId, type, qty, note = null,
    clientTxnId = null, adjustSign = 1,
  } = req.data || {};

  if (!productId || typeof productId !== "string") throw new Error("productId required");
  if (!type || !["receive", "sale", "refund", "wastage", "adjust", "set"].includes(type)) {
    throw new Error("Invalid movement type");
  }
  if (typeof qty !== "number" || !Number.isInteger(qty) || qty < 0) {
    throw new Error("qty must be a non-negative integer");
  }

  // Idempotency check
  if (clientTxnId) {
    const q = await db.collection("inventory_ledger")
      .where("clientTxnId", "==", clientTxnId)
      .where("productId", "==", productId)
      .limit(1).get();
    if (!q.empty) {
      const existing = q.docs[0].data();
      return {ok: true, ...existing, duplicate: true};
    }
  }

  const productRef = db.collection("products").doc(productId);
  const ledgerRef = db.collection("inventory_ledger").doc();

  const {after, before, delta, ledgerId} = await db.runTransaction(async (tx) => {
    const pSnap = await tx.get(productRef);
    if (!pSnap.exists) throw new Error("Product not found");
    const product = pSnap.data()!;

    if (!product.trackStock) throw new Error("Product does not track stock");

    const before = product.stockOnHand || 0;
    let delta = 0;
    let after = 0;

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
    case "adjust":
      delta = qty * (adjustSign === -1 ? -1 : 1);
      after = before + delta;
      break;
    case "set":
      after = qty;
      delta = after - before;
      break;
    }

    if (after < 0) throw new Error("Stock cannot be negative");

    const ledgerEntry = {
      productId,
      productSku: product.sku,
      productName: product.name,
      type,
      qty,
      delta,
      before,
      after,
      note,
      userId,
      userName: req.auth?.token.name,
      ts: admin.firestore.FieldValue.serverTimestamp(),
      clientTxnId,
    };

    tx.set(ledgerRef, ledgerEntry);
    tx.update(productRef, {stockOnHand: after, updatedAt: admin.firestore.FieldValue.serverTimestamp()});

    return {after, before, delta, ledgerId: ledgerRef.id};
  });

  return {ok: true, after, before, delta, ledgerId};
});


export const adminExportLedger = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin", "manager"]);
  const {productId, type, fromTs, toTs} = req.data || {};

  let q = db.collection("inventory_ledger").orderBy("ts", "desc");

  if (productId) q = q.where("productId", "==", productId);
  if (type) q = q.where("type", "==", type);
  if (fromTs) q = q.where("ts", ">=", new Date(fromTs));
  if (toTs) q = q.where("ts", "<", new Date(toTs));

  const snap = await q.limit(50000).get();

  const rows = [
    "ts,productId,productSku,productName,type,qty,delta,before,after,userId,userName,note,clientTxnId",
  ];

  for (const d of snap.docs) {
    const v = d.data();
    const ts = v.ts?.toDate ? format(v.ts.toDate(), "yyyy-MM-dd'T'HH:mm:ssXXX") : "";
    rows.push([
      ts,
      v.productId,
      v.productSku || "",
      `"${(v.productName || "").replace(/"/g, "\"\"")}"`,
      v.type,
      v.qty,
      v.delta,
      v.before,
      v.after,
      v.userId,
      `"${(v.userName || "").replace(/"/g, "\"\"")}"`,
      `"${(v.note || "").replace(/"/g, "\"\"")}"`,
      v.clientTxnId || "",
    ].join(","));
  }
  const csv = rows.join("\n");
  const dataBase64 = Buffer.from(csv).toString("base64");
  return {
    filename: `inventory-ledger-${format(new Date(), "yyyyMMdd-HHmm")}.csv`,
    mime: "text/csv",
    dataBase64,
  };
});
