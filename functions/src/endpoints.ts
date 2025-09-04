import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { db, Timestamp, FieldValue } from "./utils";
import { requireRole, ADMIN_ROLES, STAFF_ROLES } from "./roles";

type Req<T=any> = CallableRequest<T>;
const cfg = { region: "us-central1", cors: true } as const;

// Helpers
function newId(col: string) { return db.collection(col).doc().id; }
function nowTs() { return Timestamp.now(); }

// ---------------- Admin: Products / Inventory ----------------
export const adminBulkImportProducts = onCall(cfg, async (req: Req<{csv:string}>) => {
  requireRole(req, ADMIN_ROLES);
  // TODO: parse & upsert products
  logger.info("adminBulkImportProducts queued");
  return { ok: true };
});

export const adminUpsertProduct = onCall(cfg, async (req: Req<{id?:string, product:any}>) => {
  requireRole(req, ADMIN_ROLES);
  const id = req.data?.id ?? newId("items");
  await db.collection("items").doc(id).set({
    ...(req.data?.product||{}),
    id, updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { id };
});

export const adminDeleteProduct = onCall(cfg, async (req: Req<{id:string}>) => {
  requireRole(req, ADMIN_ROLES);
  const id = req.data?.id; if (!id) throw new HttpsError("invalid-argument","id required");
  await db.collection("items").doc(id).delete();
  return { ok: true };
});

export const adminPostStockMovement = onCall(cfg, async (req: Req<{productId:string, delta:number, note?:string}>) => {
  requireRole(req, ADMIN_ROLES);
  const { productId, delta=0, note="" } = req.data||{};
  if (!productId) throw new HttpsError("invalid-argument","productId required");
  const id = newId("stock_movements");
  await db.collection("stock_movements").doc(id).set({
    id, productId, delta, note, createdAt: nowTs(), updatedAt: nowTs()
  });
  return { id };
});

export const adminExportProducts = onCall(cfg, async (req: Req) => {
  requireRole(req, ADMIN_ROLES);
  const snap = await db.collection("items").orderBy("name").get();
  const header = ["id","name","sku","plu","barcode","categoryId","priceCents","active"];
  const csv = [header.join(",")]
    .concat(snap.docs.map(d=>{
      const r:any=d.data(); return header.map(h=> JSON.stringify(r[h]??"").replace(/^"|"$/g,"")).join(",");
    })).join("\n");
  return { filename:`products-${Date.now()}.csv`, csv };
});

// ---------------- Admin: Menu ----------------
export const adminUpsertMenu = onCall(cfg, async (req: Req<{menu:any}>) => {
  requireRole(req, ADMIN_ROLES);
  const id = req.data?.menu?.id ?? newId("menus");
  await db.collection("menus").doc(id).set({ ...req.data?.menu, id, updatedAt: nowTs(), createdAt: nowTs() }, { merge: true });
  return { id };
});

export const adminUpsertMenuEntities = onCall(cfg, async (req: Req<{ screens?:any[], buttons?:any[] }>) => {
  requireRole(req, ADMIN_ROLES);
  // TODO: batch write screens/buttons
  return { ok: true };
});

export const adminSetMenuAvailability = onCall(cfg, async (req: Req<{rules:any[]}>) => {
  requireRole(req, ADMIN_ROLES);
  // TODO: replace menu_availability docs
  return { ok: true };
});

export const adminImportMenuCsv = onCall(cfg, async (req: Req<{csv:string}>) => {
  requireRole(req, ADMIN_ROLES);
  // TODO: parse and create screens/buttons/items
  return { ok: true };
});

export const adminExportMenuCsv = onCall(cfg, async (req: Req) => {
  requireRole(req, ADMIN_ROLES);
  return { filename:`menu-${Date.now()}.csv`, csv: "type,id,parentId,name,order\n" };
});

export const adminUpsertPriceRules = onCall(cfg, async (req: Req<{rules:any[]}>) => {
  requireRole(req, ADMIN_ROLES);
  // TODO: write price_rules
  return { ok: true };
});

// ---------------- Admin: Floor / Tables ----------------
export const adminUpsertFloorPlan = onCall(cfg, async (req: Req<{ plan: any }>) => {
  requireRole(req, ADMIN_ROLES);
  const id = req.data?.plan?.id ?? newId("floor_plans");
  await db.collection("floor_plans").doc(id).set({ ...req.data?.plan, id, updatedAt: nowTs(), createdAt: nowTs() }, { merge:true });
  return { id };
});

export const adminDisableTables = onCall(cfg, async (req: Req<{ tableIds: string[], disabled: boolean }>) => {
  requireRole(req, ADMIN_ROLES);
  // TODO: patch floor_plans or table_state accordingly
  return { ok:true };
});

// ---------------- Admin: Users ----------------
export const adminUpsertUser = onCall(cfg, async (req: Req<{ uid?:string, email?:string, displayName?:string, role?:string, pin?:string }>) => {
  requireRole(req, ADMIN_ROLES);
  // TODO: create/update user + custom claims
  return { ok:true };
});

export const adminDeleteUser = onCall(cfg, async (req: Req<{ uid:string }>) => {
  requireRole(req, ADMIN_ROLES);
  // TODO: delete user, cleanup
  return { ok:true };
});

export const adminSetUserPin = onCall(cfg, async (req: Req<{ uid:string, pin:string }>) => {
  requireRole(req, ADMIN_ROLES);
  // TODO: set hashed PIN in user_secrets
  return { ok:true };
});

// ---------------- Admin: Reports / Exports ----------------
export const adminCloseDay = onCall(cfg, async (req: Req<{ date?: string }>) => {
  requireRole(req, ADMIN_ROLES);
  const zId = "Z-" + Date.now();
  await db.collection("z_closures").doc(zId).set({ id:zId, date:req.data?.date ?? new Date().toISOString().slice(0,10), createdAt: nowTs(), updatedAt: nowTs() });
  return { zId };
});

export const adminExportZCsv = onCall(cfg, async (req: Req) => {
  requireRole(req, ADMIN_ROLES);
  return { filename:`z-closure-${Date.now()}.csv`, csv: "metric,value\nsales,0\n" };
});

export const adminExportTimeCsv = onCall(cfg, async (req: Req) => {
  requireRole(req, ADMIN_ROLES);
  return { filename:`time-${Date.now()}.csv`, csv: "employee,clockIn,clockOut\n" };
});

export const adminExportOrders = onCall(cfg, async (req: Req) => {
  requireRole(req, ADMIN_ROLES);
  return { filename:`orders-${Date.now()}.csv`, csv: "orderId,total\n" };
});

export const adminExportLedger = onCall(cfg, async (req: Req) => {
  requireRole(req, ADMIN_ROLES);
  return { filename:`ledger-${Date.now()}.csv`, csv: "date,account,debit,credit\n" };
});

export const getSalesSummary = onCall(cfg, async (req: Req<{ from?:string; to?:string }>) => {
  requireRole(req, ADMIN_ROLES);
  return { totalCents: 0, orders: 0, refunds: 0 };
});

// ---------------- POS: Orders & Payments ----------------
export const cashierCreateOrder = onCall(cfg, async (req: Req<{ note?: string; tableId?: string }>) => {
  requireRole(req, STAFF_ROLES);
  const id = newId("orders");
  await db.collection("orders").doc(id).set({
    id, status: "open", note: req.data?.note ?? "", tableId: req.data?.tableId ?? null,
    createdAt: nowTs(), updatedAt: nowTs()
  });
  return { orderId: id };
});

export const cashierSetItems = onCall(cfg, async (req: Req<{ orderId: string; lines: { itemId:string; qty:number; priceCents:number }[] }>) => {
  requireRole(req, STAFF_ROLES);
  // TODO: write order lines subcollection
  return { ok:true };
});

export const cashierTakePayment = onCall(cfg, async (req: Req<{ orderId: string; payment: { method:string; amountCents:number } }>) => {
  requireRole(req, STAFF_ROLES);
  // TODO: record payment
  return { ok:true };
});

export const cashierCloseOrder = onCall(cfg, async (req: Req<{ orderId: string; payment?: { method:string; amountCents:number } }>) => {
  requireRole(req, STAFF_ROLES);
  // TODO: finalize order; set status=closed
  return { ok:true };
});

export const cashierRefundItems = onCall(cfg, async (req: Req<{ orderId: string; itemIds: string[] }>) => {
  requireRole(req, STAFF_ROLES);
  // TODO: create negative lines / credit note
  return { ok:true };
});

export const splitCheck = onCall(cfg, async (req: Req<{ orderId:string, splits:any }>) => {
  requireRole(req, STAFF_ROLES);
  return { ok:true };
});

export const mergeChecks = onCall(cfg, async (req: Req<{ orderIds:string[] }>) => {
  requireRole(req, STAFF_ROLES);
  return { ok:true };
});

export const transferItems = onCall(cfg, async (req: Req<{ fromOrderId:string; toOrderId:string; itemIds:string[] }>) => {
  requireRole(req, STAFF_ROLES);
  return { ok:true };
});

export const printChecks = onCall(cfg, async (req: Req<{ orderId:string }>) => {
  requireRole(req, STAFF_ROLES);
  // TODO: enqueue print_jobs
  return { ok:true };
});

// ---------------- POS: Tables / Floor ----------------
export const openTableTab = onCall(cfg, async (req: Req<{ tableId:string; locationId?:string }>) => {
  requireRole(req, STAFF_ROLES);
  // TODO: create order, set table_state occupied
  return { ok:true };
});

export const closeTableTab = onCall(cfg, async (req: Req<{ tableId:string }>) => {
  requireRole(req, STAFF_ROLES);
  // TODO: mark table_state open
  return { ok:true };
});

export const moveTabToTable = onCall(cfg, async (req: Req<{ fromTableId:string; toTableId:string }>) => {
  requireRole(req, STAFF_ROLES);
  return { ok:true };
});

export const mergeTables = onCall(cfg, async (req: Req<{ sourceTableIds:string[]; targetTableId:string }>) => {
  requireRole(req, STAFF_ROLES);
  return { ok:true };
});

// ---------------- Cash / Register ----------------
export const manageRegisterSession = onCall(cfg, async (req: Req<{ action:'open'|'close'|'status'; floatCents?:number }>) => {
  requireRole(req, STAFF_ROLES);
  return { ok:true, status:"open" };
});

export const postCashMovement = onCall(cfg, async (req: Req<{ type:'in'|'out', amountCents:number, reason?:string }>) => {
  requireRole(req, STAFF_ROLES);
  const id = newId("cash_movements");
  await db.collection("cash_movements").doc(id).set({
    id, type:req.data?.type, amountCents:req.data?.amountCents ?? 0, reason:req.data?.reason ?? "",
    status: "pending", createdAt: nowTs(), updatedAt: nowTs()
  });
  return { id, status: "pending" };
});

// ---------------- Time clock ----------------
export const clockIn = onCall(cfg, async (req: Req<{ pin:string }>) => {
  requireRole(req, STAFF_ROLES);
  return { ok:true, ts: Date.now() };
});

export const clockOut = onCall(cfg, async (req: Req<{ pin:string }>) => {
  requireRole(req, STAFF_ROLES);
  return { ok:true, ts: Date.now() };
});

// ---------------- Storage ----------------
export const getSignedUploadUrl = onCall(cfg, async (req: Req) => {
  requireRole(req, ADMIN_ROLES);
  // TODO: sign a GCS resumable upload URL
  return { uploadUrl: null };
});
