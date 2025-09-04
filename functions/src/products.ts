'use server';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { db, FieldValue } from './utils.js';
import { requireRole } from './roles.js';

function parseCsvSimple(text: string): Record<string,string>[] {
  // Minimal CSV parser supporting quoted values and commas. Assumes \n line breaks.
  const lines = text.replace(/\r/g,'').split('\n').filter(l=>l.trim().length>0);
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const cols = splitCsvLine(line);
    const row: Record<string,string> = {};
    headers.forEach((h,i)=> row[h.trim()] = (cols[i] ?? '').trim());
    return row;
  });
}
function splitCsvLine(line:string): string[] {
  const out: string[] = []; let cur=''; let inQ=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){
      if(inQ && line[i+1]==='"'){ cur+='"'; i++; }
      else inQ = !inQ;
    } else if(ch===',' && !inQ){ out.push(cur); cur=''; }
    else cur+=ch;
  }
  out.push(cur); return out;
}

export const adminImportProductsCsv = onCall({ cors: true, region: 'us-central1' }, async (req) => {
  requireRole(req, ['admin', 'manager']);
  const csv = req.data?.csv; if (!csv) throw new HttpsError('invalid-argument','csv required');

  const rows = parseCsvSimple(csv);
  const batch = db.batch();
  const now = FieldValue.serverTimestamp();
  let upserts = 0;

  for (const r of rows){
    const name = r.name || r.Name || '';
    if (!name) continue;
    const sku = r.sku || r.SKU || '';
    const priceCents = Number(r.priceCents ?? r.price_cents ?? r.price ?? 0) | 0;
    const costCents = r.costCents ? Number(r.costCents) | 0 : undefined;
    const categoryId = r.categoryId || '';
    const active = (r.active ?? 'true').toString().toLowerCase() !== 'false';

    let ref = db.collection('items').doc();
    if (sku){
      const m = await db.collection('items').where('sku','==', sku).limit(1).get();
      ref = m.docs[0]?.ref ?? ref;
    } else {
      const m = await db.collection('items').where('name','==', name).limit(1).get();
      ref = m.docs[0]?.ref ?? ref;
    }

    batch.set(ref, {
      name, sku,
      plu: r.plu || r.PLU || '',
      barcode: r.barcode || '',
      categoryId: categoryId || null,
      priceCents, costCents,
      vatRate: r.vatRate ? Number(r.vatRate) : 15,
      unit: r.unit || 'ea',
      active,
      updatedAt: now,
      createdAt: now
    }, { merge: true });
    upserts++;

    if (upserts % 400 === 0){ 
      await batch.commit(); 
      logger.info('Committed 400 product writes');
    }
  }

  if (upserts % 400 !== 0){ await batch.commit(); }
  return { ok:true, upserts };
});

export const adminExportProductsCsv = onCall({ cors: true, region: 'us-central1' }, async (req) => {
  requireRole(req, ['admin', 'manager']);
  const snap = await db.collection('items').orderBy('name','asc').get();
  const rows = snap.docs.map(d=> ({ id:d.id, ...(d.data() as any) }));
  const header = ['id','name','sku','plu','barcode','categoryId','priceCents','costCents','vatRate','unit','active'];
  const csv = [header.join(',')]
    .concat(rows.map(r => header.map(h => serializeCsvValue(r[h])).join(',')))
    .join('\n');
  return { filename: `products-${Date.now()}.csv`, csv };
});

function serializeCsvValue(v:any){
  if (v==null) return '';
  const s=String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"'+s.replace(/"/g,'""')+'"';
  return s;
}

export const adminUpsertProduct = onCall({ cors: true, region: 'us-central1' }, async(req) => {
    requireRole(req, ['admin', 'manager']);
    const { id, product } = req.data;
    if (!product || !product.name) {
        throw new HttpsError('invalid-argument', 'Product data is required.');
    }
    const ref = id ? db.collection('items').doc(id) : db.collection('items').doc();
    const payload = {
        ...product,
        id: ref.id,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: product.createdAt || FieldValue.serverTimestamp(),
    };
    await ref.set(payload, { merge: true });
    return { ok: true, id: ref.id };
});

export const adminDeleteProduct = onCall({ cors: true, region: 'us-central1' }, async(req) => {
    requireRole(req, ['admin', 'manager']);
    const { id } = req.data;
    if (!id) {
        throw new HttpsError('invalid-argument', 'Product ID is required.');
    }
    await db.collection('items').doc(id).delete();
    return { ok: true };
});

export const adminPostStockMovement = onCall({ cors: true, region: 'us-central1' }, async(req) => {
    requireRole(req, ['admin', 'manager']);
    const { productId, delta, note } = req.data;
    if (!productId || typeof delta !== 'number') {
        throw new HttpsError('invalid-argument', 'ProductId and a numeric delta are required.');
    }
    
    const productRef = db.collection('items').doc(productId);
    const movementRef = db.collection('stock_movements').doc();
    const now = FieldValue.serverTimestamp();
    const uid = req.auth?.uid;

    await db.runTransaction(async (transaction) => {
        const productDoc = await transaction.get(productRef);
        if (!productDoc.exists) {
            throw new HttpsError('not-found', 'Product not found.');
        }
        const currentStock = productDoc.data()?.stockOnHand || 0;
        const newStock = currentStock + delta;

        transaction.update(productRef, { 
            stockOnHand: newStock,
            updatedAt: now,
        });
        
        transaction.set(movementRef, {
            productId,
            delta,
            note: note || null,
            before: currentStock,
            after: newStock,
            createdAt: now,
            updatedAt: now,
            userId: uid,
        });
    });

    return { ok: true, newStock };
});
