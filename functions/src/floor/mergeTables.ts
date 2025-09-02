
import {onCall} from "firebase-functions/v2/https";
import {getFirestore} from "firebase-admin/firestore";

interface Payload {
  primaryTableId: string;
  secondaryTableId: string;
}

export const mergeTables = onCall<Payload>(async (req)=>{
  const ctx = req.auth;
  if (!ctx) throw new Error("UNAUTH");

  const role = (ctx.token as {role?: string})?.role;
  const allowed = ["admin", "manager", "cashier", "waiter"];
  if (!allowed.includes(role ?? "")) throw new Error("FORBIDDEN");

  const {primaryTableId, secondaryTableId} = req.data;
  const db = getFirestore();
  const pRef = db.collection("table_state").doc(primaryTableId);
  const sRef = db.collection("table_state").doc(secondaryTableId);
  await db.runTransaction(async (tx)=>{
    const [p, s] = await Promise.all([tx.get(pRef), tx.get(sRef)]);
    if (!p.exists || !s.exists) throw new Error("TABLE_NOT_FOUND");

    const pOrder = p.get("orderId");
    const sOrder = s.get("orderId");
    if (!pOrder && !sOrder) throw new Error("NO_ORDERS");

    const primaryOrderId = pOrder || sOrder;
    const secondaryOrderId = pOrder ? sOrder : null;
    if (secondaryOrderId) {
      const oP = await tx.get(db.collection("orders").doc(primaryOrderId));
      const oS = await tx.get(db.collection("orders").doc(secondaryOrderId));
      const pLines = oP.data()?.lines || [];
      const sLines = oS.data()?.lines || [];
      const lines = [...pLines, ...sLines];
      const pTotal = oP.data()?.totalCents || 0;
      const sTotal = oS.data()?.totalCents || 0;
      const totals = pTotal + sTotal;
      tx.update(db.collection("orders").doc(primaryOrderId),
        {lines, totalCents: totals, updatedAt: new Date().toISOString()});
      tx.update(db.collection("orders").doc(secondaryOrderId),
        {status: "merged", updatedAt: new Date().toISOString()});
    }
    tx.update(pRef, {
      status: "occupied", mergedIntoId: null,
      updatedAt: new Date().toISOString(),
    });
    tx.update(sRef, {
      status: "merged", mergedIntoId: primaryTableId, orderId: null,
      updatedAt: new Date().toISOString(),
    });
  });
  return {ok: true};
});
