/**
 * @fileoverview Cloud Functions for product and category management.
 */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {db, requireRole} from "./utils";

/**
 * Helper to normalize money strings (e.g., "123.45") into integer cents.
 * @param {string | number} s The string or number to convert.
 * @return {number} The value in cents.
 */
function centsFromZarString(s: string | number): number {
  const n = Number(String(s).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n)) {
    throw new HttpsError("invalid-argument", "Invalid price format");
  }
  return Math.round(n * 100);
}

/**
 * Calculates the price excluding VAT from a VAT-inclusive price.
 * @param {number} incCents The price in cents, including VAT.
 * @param {number} taxRate The tax rate (e.g., 0.15 for 15%).
 * @return {number} The price in cents, excluding VAT.
 */
function toExCents(incCents: number, taxRate: number): number {
  return Math.round(incCents / (1 + taxRate));
}

/**
 * Finds a category by its lowercase name or creates it if it doesn't exist.
 * @param {string | null | undefined} name The category name.
 * @return {Promise<{id: string | null, name: string | null}>} The category ID.
 */
async function getOrCreateCategoryByName(name?: string | null) {
  if (!name) return {id: null as string | null, name: null as string | null};
  const nameClean = name.trim();
  if (!nameClean) return {id: null, name: null};
  const nameLower = nameClean.toLowerCase();

  const q = await db
    .collection("categories")
    .where("nameLower", "==", nameLower)
    .limit(1)
    .get();

  if (!q.empty) {
    const d = q.docs[0];
    return {
      id: d.id,
      name: (d.get("name") as string) ?? nameClean,
    };
  }

  const ref = db.collection("categories").doc();
  await ref.set({name: nameClean, nameLower, sort: 0});
  return {id: ref.id, name: nameClean};
}


/** Interface for the upsert product core function payload. */
interface UpsertInput {
  id?: string;
  name: string;
  sku: string;
  barcode?: string | null;
  categoryName?: string | null;
  trackStock?: boolean;
  priceInc: number | string;
  costInc?: string | number | null;
  taxRate?: number;
}

/**
 * Core logic to create or update a product, shared by single and bulk actions.
 * @param {UpsertInput} input The product data.
 * @return {Promise<{ok: true, id: string}>} The result of the operation.
 */
async function upsertProductCore(input: UpsertInput) {
  const {
    id, name, sku, barcode = null, categoryName = null, trackStock = true,
    priceInc, costInc = "", taxRate = 0.15,
  } = input;

  if (typeof name !== "string" || !name.trim()) {
    throw new HttpsError("invalid-argument", "Product name is required.");
  }
  if (typeof sku !== "string" || !sku.trim()) {
    throw new HttpsError("invalid-argument", "Product SKU is required.");
  }

  const skuUpper = sku.trim().toUpperCase();
  const incCents = centsFromZarString(priceInc);
  const exCents = toExCents(incCents, taxRate);
  const costIncCents = (costInc === null || costInc === "") ?
    null : centsFromZarString(costInc);

  const {id: categoryId, name: catName} =
    await getOrCreateCategoryByName(categoryName);

  const conflicts = await db.collection("products")
    .where("skuUpper", "==", skuUpper).get();
  if (!conflicts.empty && conflicts.docs.some((d) => d.id !== id)) {
    throw new HttpsError("already-exists", `SKU already exists: ${skuUpper}`);
  }

  const data = {
    name: name.trim(), nameLower: name.trim().toLowerCase(),
    sku: sku.trim(), skuUpper, barcode: barcode ? String(barcode) : null,
    categoryId, categoryName: catName, trackStock: !!trackStock,
    price: {currency: "ZAR", taxRate, incCents, exCents}, costIncCents,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const productId = id || db.collection("products").doc().id;
  const productRef = db.collection("products").doc(productId);
  const doc = await productRef.get();
  if (!doc.exists) {
    await productRef.set({
      ...data, createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    await productRef.update(data);
  }
  return {ok: true, id: productId};
}

/** Callable to upsert a single product. */
export const adminUpsertProduct = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin", "manager"]);
  return upsertProductCore(req.data as UpsertInput);
});

/** Callable to delete a single product. */
export const adminDeleteProduct = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin"]);
  const {id} = req.data as {id?: string};
  if (!id) throw new HttpsError("invalid-argument", "Product ID is required.");
  await db.collection("products").doc(id).delete();
  return {ok: true};
});

/** Callable to export all products to a CSV string. */
export const adminExportProducts = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin", "manager"]);
  const snap = await db.collection("products").orderBy("nameLower").get();
  const rows: string[] = [
    "id,name,sku,barcode,category,trackStock,priceIncZAR,costIncZAR,taxRate",
  ];
  for (const doc of snap.docs) {
    const p = doc.data();
    const priceInc = (p.price?.incCents ?? 0) / 100;
    const cost = p.costIncCents === null || p.costIncCents === undefined ?
      "" : (Number(p.costIncCents) / 100).toFixed(2);
    const esc = (s: string|null|undefined) =>
      `"${String(s??"").replace(/"/g, "\"\"")}"`;
    rows.push([
      doc.id, esc(p.name), p.sku??"", p.barcode??"", esc(p.categoryName),
      String(!!p.trackStock), priceInc.toFixed(2), cost,
      String(p.price?.taxRate ?? 0.15),
    ].join(","));
  }
  return {ok: true, csv: rows.join("\n")};
});

/** Callable to bulk import products from a CSV string. */
export const adminBulkImportProducts = onCall({cors: true}, async (req) => {
  requireRole(req, ["admin", "manager"]);
  const csv: string = (req.data as {csv?: string})?.csv || "";
  if (!csv) throw new HttpsError("invalid-argument", "CSV data is required.");

  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return {ok: true, imported: 0};

  const [header, ...rows] = lines;
  const head = header.split(",").map((s) => s.trim().toLowerCase());
  const idx = (k: string) => head.indexOf(k);

  const iName = idx("name");
  const iSku = idx("sku");
  const iInc = idx("priceinczar");
  if (iName<0 || iSku<0 || iInc<0) {
    throw new HttpsError("invalid-argument", "CSV needs name,sku,priceIncZAR");
  }

  let imported = 0;
  for (const row of rows) {
    if (!row.trim()) continue;
    const p = row.split(",").map((s) => s.trim());
    const input: UpsertInput = {
      name: p[iName], sku: p[iSku], priceInc: p[iInc],
      barcode: p[idx("barcode")] || null,
      categoryName: p[idx("category")] || null,
      trackStock: /^true$/i.test(p[idx("trackstock")] || "true"),
      costInc: p[idx("costinczar")] || "",
      taxRate: Number(p[idx("taxrate")] || 0.15),
    };
    if (!input.name || !input.sku || !input.priceInc) continue;
    await upsertProductCore(input);
    imported++;
  }
  return {ok: true, imported};
});
