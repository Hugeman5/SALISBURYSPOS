import { onCall } from "firebase-functions/v2/https";
import { ADMIN_ROLES } from "./roles.js";
import { logger } from "firebase-functions";
import { db, requireRole } from "./utils.js";
import { parse } from 'csv-parse/sync';

/**
 * Create/update a single product
 */
export const adminUpsertProduct = onCall({ cors: true, region: 'us-central1' }, async (req) => {
  requireRole(req, ADMIN_ROLES);

  const { product } = req.data;
  if (!product) throw new Error("Missing product data");

  const { id, ...rest } = product;
  const ref = id ? db.collection('items').doc(id) : db.collection('items').doc();
  const write = await ref.set({ ...rest, updatedAt: new Date().toISOString() }, { merge: true });

  logger.info(`Upserted product ${ref.id}`, { id: ref.id, write });
  return { ok: true, id: ref.id };
});

/**
 * Import a batch of products from a CSV file.
 * CSV must have headers: name, sku, plu, category, price, tax, imageUrl, active, tags
 */
export const adminImportProductsCsv = onCall({ cors: true, region: 'us-central1', memory: '1GiB' }, async (req) => {
  requireRole(req, ADMIN_ROLES);
  const { csv } = req.data;
  if (!csv) throw new Error("Missing CSV data");

  const records:any[] = parse(csv, { columns: true, skip_empty_lines: true });
  const batch = db.batch();

  logger.info(`Starting batch import of ${records.length} products`);

  for (const record of records) {
    const { id, ...rest } = record;
    const ref = id ? db.collection('items').doc(id) : db.collection('items').doc();
    batch.set(ref, { 
      ...rest,
      priceCents: Math.round(parseFloat(record.price) * 100),
      taxRate: parseFloat(record.tax) || undefined,
      active: record.active?.toLowerCase() === 'true',
      tags: record.tags?.split(',').map((t:string) => t.trim()) || [],
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }
  await batch.commit();

  logger.info(`Batch import of ${records.length} products complete`);
  return { ok: true };
});
