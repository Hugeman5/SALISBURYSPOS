import { onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

type Role = "admin" | "manager" | "cashier" | "waiter" | "kitchen";

function requireRole(context: any, allowed: Role[]) {
  const role = context?.auth?.token?.role as Role | undefined;
  if (!role || !allowed.includes(role)) throw new Error("PERMISSION_DENIED");
  return role;
}

const db = admin.firestore();

function centsFromZarString(s: string): number {
  // accepts "123", "123.4", "123.45" -> cents
  const n = Number(String(s).replace(/[^\d.]/g, ""));
  if (!isFinite(n)) throw new Error("Invalid price");
  return Math.round(n * 100);
}

function toExCents(incCents: number, taxRate: number): number {
  return Math.round(incCents / (1 + taxRate));
}

async function getOrCreateCategoryByName(name?: string | null) {
  if (!name) return { id: null as string | null, name: null as string | null };
  const nameClean = name.trim();
  if (!nameClean) return { id: null, name: null };
  const nameLower = nameClean.toLowerCase();
  
  const q = await db.collection("categories")
    .where("nameLower", "==", nameLower)
    .limit(1).get();
    
  if (!q.empty) {
    const d = q.docs[0];
    return { id: d.id, name: d.get("name") as string, nameLower };
  }
  
  const ref = db.collection("categories").doc();
  await ref.set({ name: nameClean, nameLower, sort: 0 });
  return { id: ref.id, name: nameClean, nameLower };
}

export const adminUpsertProduct = onCall({ cors: true }, async (req) => {
  requireRole(req, ["admin", "manager"]);

  const {
    id, name, sku, barcode = null, categoryName = null,
    trackStock = true, priceInc, costInc = "", taxRate = 0.15
  } = req.data || {};

  if (typeof name !== "string" || !name.trim()) throw new Error("name required");
  if (typeof sku !== "string" || !sku.trim()) throw new Error("sku required");

  const skuUpper = sku.trim().toUpperCase();
  const incCents = typeof priceInc === "number"
    ? Math.round(priceInc) // already cents?
    : centsFromZarString(String(priceInc));
  const exCents = toExCents(incCents, Number(taxRate ?? 0.15));
  const costIncCents = costInc ? centsFromZarString(String(costInc)) : null;

  const { id: categoryId, name: categoryResolved } = await getOrCreateCategoryByName(categoryName);

  // Uniqueness: skuUpper must be unique
  const conflicts = await db.collection("products")
    .where("skuUpper", "==", skuUpper).get();
  if (!conflicts.empty) {
    const conflict = conflicts.docs.find(d => d.id !== id);
    if (conflict) throw new Error(`SKU already exists: ${skuUpper}`);
  }

  const data = {
    name: name.trim(),
    nameLower: name.trim().toLowerCase(),
    sku: sku.trim(),
    skuUpper,
    barcode: barcode ? String(barcode) : null,
    categoryId,
    categoryName: categoryResolved,
    trackStock: !!trackStock,
    price: {
      currency: "ZAR",
      taxRate: Number(taxRate ?? 0.15),
      incCents,
      exCents,
    },
    costIncCents,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (id) {
    await db.collection("products").doc(id).set(data, { merge: true });
    return { ok: true, id };
  } else {
    const ref = db.collection("products").doc();
    await ref.set({ ...data, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return { ok: true, id: ref.id };
  }
});

export const adminDeleteProduct = onCall({ cors: true }, async (req) => {
  requireRole(req, ["admin"]);
  const { id } = req.data || {};
  if (!id) throw new Error("id required");
  await db.collection("products").doc(id).delete();
  return { ok: true };
});

export const adminExportProducts = onCall({ cors: true }, async (req) => {
  requireRole(req, ["admin", "manager"]);
  const snap = await db.collection("products").orderBy("nameLower").get();
  const rows: string[] = [
    "id,name,sku,barcode,category,trackStock,priceIncZAR,costIncZAR,taxRate"
  ];
  for (const d of snap.docs) {
    const v = d.data() as any;
    const inc = (v.price?.incCents ?? 0) / 100;
    const cost = (v.costIncCents ?? 0) / 100;
    rows.push([
      d.id,
      `"${(v.name ?? "").replace(/"/g, '""')}"`,
      v.sku ?? "",
      v.barcode ?? "",
      `"${(v.categoryName ?? "").replace(/"/g, '""')}"`,
      String(!!v.trackStock),
      inc.toFixed(2),
      cost ? cost.toFixed(2) : "",
      String(v.price?.taxRate ?? 0.15),
    ].join(","));
  }
  return { ok: true, csv: rows.join("\n") };
});

export const adminBulkImportProducts = onCall({ cors: true }, async (req) => {
  requireRole(req, ["admin", "manager"]);
  const csv: string = req.data?.csv;
  if (!csv || typeof csv !== "string") throw new Error("CSV required");

  const lines = csv.trim().split(/\r?\n/);
  const [header, ...rows] = lines;
  const head = header.split(",").map(s => s.trim().toLowerCase());
  const col = (k: string) => head.indexOf(k);

  const iName = col("name");
  const iSku = col("sku");
  const iBarcode = col("barcode");
  const iCategory = col("category");
  const iTrack = col("trackstock");
  const iInc = col("priceinczar");
  const iCost = col("costinczar");
  const iTax = col("taxrate");

  if (iName < 0 || iSku < 0 || iInc < 0) {
    throw new Error("CSV must include at least: name,sku,priceIncZAR");
  }

  let imported = 0;
  const batch = db.batch();

  for (const r of rows) {
    if (!r.trim()) continue;
    // Poor man's CSV parsing, assumes no commas in values
    const p = r.split(",").map(s => s.trim());
    const name = p[iName];
    const sku = p[iSku];
    const barcode = iBarcode >= 0 ? (p[iBarcode] || null) : null;
    const categoryName = iCategory >= 0 ? (p[iCategory] || null) : null;
    const trackStock = iTrack >= 0 ? /^true$/i.test(p[iTrack] || "true") : true;
    const priceInc = p[iInc];
    const costInc = iCost >= 0 ? p[iCost] : "";
    const taxRate = iTax >= 0 && p[iTax] ? Number(p[iTax]) : 0.15;
    
    if (!name || !sku || !priceInc) continue;

    // This is not perfectly transactional at scale, but ok for this app.
    // A better approach would be a multi-step import job.
    await adminUpsertProduct.run({
      auth: (req as any).auth, // forward auth context
      data: { name, sku, barcode, categoryName, trackStock, priceInc, costInc, taxRate }
    } as any);

    imported++;
  }

  return { ok: true, imported };
});
