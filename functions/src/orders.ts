import {onCall} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {format} from "date-fns";
import {z} from "zod";

type Role = "admin" | "manager" | "cashier" | "waiter" | "kitchen";

function requireRole(context: any, allowed: Role[]) {
  const role = context?.auth?.token?.role as Role | undefined;
  if (!role || !allowed.includes(role)) throw new Error("PERMISSION_DENIED");
  return role;
}

const db = admin.firestore();
const VAT_RATE = 0.15;

const splitVat = (incl: number) => {
  const excl = Math.round(incl / (1 + VAT_RATE));
  const vat = incl - excl;
  return {excl, vat};
};

// Zod schemas for validation
const createOrderSchema = z.object({
  note: z.string().optional(),
});
export const cashierCreateOrder = onCall({cors: true}, async (req) => {
  const role = requireRole(req, ["admin", "manager", "cashier"]);
  const cashierId = req.auth!.uid;
  const cashierName = req.auth!.token.name || "Unknown";
  const {note} = createOrderSchema.parse(req.data);

  const orderRef = db.collection("orders").doc();
  await orderRef.set({
    status: "open",
    createdBy: cashierId,
    cashierName,
    items: [],
    totals: {
      subTotalEx: 0,
      vat: 0,
      totalInc: 0,
    },
    payments: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    currency: "ZAR",
    vatRate: VAT_RATE,
    note: note || null,
  });

  return {orderId: orderRef.id};
});

const setItemsSchema = z.object({
  orderId: z.string(),
  items: z.array(z.object({
    productId: z.string(),
    qty: z.number().int().gt(0),
  })),
});
export const cashierSetItems = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin", "manager", "cashier"]);
  const {orderId, items: cartItems} = setItemsSchema.parse(req.data);
  const orderRef = db.collection("orders").doc(orderId);

  const productIds = [...new Set(cartItems.map((item) => item.productId))];
  const productSnapshots = await db.collection("products").where(admin.firestore.FieldPath.documentId(), "in", productIds).get();
  const productsById = new Map(productSnapshots.docs.map((doc) => [doc.id, doc.data()]));

  let totalSubTotalEx = 0;
  let totalVat = 0;
  let totalInc = 0;

  const orderItems = cartItems.map((cartItem) => {
    const product = productsById.get(cartItem.productId);
    if (!product) throw new Error(`Product ${cartItem.productId} not found`);

    const priceInc = product.price.incCents;
    const vatRate = product.price.taxRate;

    const lineTotalInc = priceInc * cartItem.qty;
    const {excl: lineSubExcl, vat: lineVat} = splitVat(lineTotalInc);

    totalSubTotalEx += lineSubExcl;
    totalVat += lineVat;
    totalInc += lineTotalInc;

    return {
      productId: cartItem.productId,
      name: product.name,
      qty: cartItem.qty,
      priceEx: splitVat(priceInc).excl,
      vatRate,
      lineTotalEx: lineSubExcl,
      vatAmount: lineVat,
      lineTotalInc,
    };
  });

  await orderRef.update({
    items: orderItems,
    totals: {
      subTotalEx: totalSubTotalEx,
      vat: totalVat,
      totalInc,
    },
  });

  return {
    ok: true,
    totals: {
      subTotalEx: totalSubTotalEx,
      vat: totalVat,
      totalInc,
    },
  };
});

const takePaymentSchema = z.object({
  orderId: z.string(),
  type: z.enum(["cash", "card"]),
  amount: z.number().int().gt(0),
});
export const cashierTakePayment = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin", "manager", "cashier"]);
  const {orderId, type, amount} = takePaymentSchema.parse(req.data);
  const orderRef = db.collection("orders").doc(orderId);

  const payment = {
    type,
    amount,
    ts: admin.firestore.FieldValue.serverTimestamp(),
  };

  await orderRef.update({
    payments: admin.firestore.FieldValue.arrayUnion(payment),
  });
  return {ok: true};
});

const closeOrderSchema = z.object({orderId: z.string()});
export const cashierCloseOrder = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin", "manager", "cashier"]);
  const {orderId} = closeOrderSchema.parse(req.data);
  const orderRef = db.collection("orders").doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) throw new Error("Order not found");
  const order = orderSnap.data()!;

  const totalPaid = order.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
  if (totalPaid < order.totals.totalInc) {
    throw new Error("Insufficient payment");
  }

  const stockMovements = order.items.map((item: any) => ({
    productId: item.productId,
    type: "sale",
    qty: item.qty,
    note: `Order ${orderId}`,
    clientTxnId: `sale:${orderId}:${item.productId}`,
  }));

  const ledgerCol = db.collection("inventory_ledger");
  const productCol = db.collection("products");
  const batch = db.batch();

  for (const movement of stockMovements) {
    const pSnap = await productCol.doc(movement.productId).get();
    const product = pSnap.data();
    if (!product || !product.trackStock) continue;

    const before = product.stockOnHand || 0;
    const delta = -movement.qty;
    const after = before + delta;

    if (after < 0) {
      // Allow overselling but log it. A better system might block this.
      console.warn(`Overselling product ${movement.productId}. Stock is now ${after}`);
    }

    const ledgerRef = ledgerCol.doc();
    batch.set(ledgerRef, {
      ...movement,
      delta,
      before,
      after,
      userId: req.auth!.uid,
      userName: req.auth!.token.name,
      ts: admin.firestore.FieldValue.serverTimestamp(),
    });
    batch.update(pSnap.ref, {stockOnHand: after});
  }

  batch.update(orderRef, {
    status: "paid",
    closedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return {ok: true};
});
