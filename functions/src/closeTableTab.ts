
import {onCall} from "firebase-functions/v2/https";
import {getFirestore} from "firebase-admin/firestore";

interface Payload {
  tableId: string;
}

export const closeTableTab = onCall<Payload>(async (req)=>{
  const ctx = req.auth;
  if (!ctx) throw new Error("UNAUTH");
  const role = (ctx.token as {role?: string})?.role;
  const allowed = ["admin", "manager", "cashier", "waiter"];
  if (!allowed.includes(role ?? "")) throw new Error("FORBIDDEN");

  const {tableId} = req.data;
  const db = getFirestore();
  const tRef = db.collection("table_state").doc(tableId);
  await db.runTransaction(async (tx)=>{
    const t = await tx.get(tRef);
    if (!t.exists) throw new Error("NOT_FOUND");
    const orderId = t.get("orderId");
    if (orderId) {
      const orderRef = db.collection("orders").doc(orderId);
      tx.update(orderRef, {
        status: "closed",
        updatedAt: new Date().toISOString(),
      });
    }
    tx.update(tRef, {
      status: "dirty",
      orderId: null,
      covers: 0,
      updatedAt: new Date().toISOString(),
    });
  });
  return {ok: true};
});
