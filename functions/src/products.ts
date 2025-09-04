
import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { db, FieldValue } from './utils.js';

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

type Req<T=any> = CallableRequest<T>;

export const adminImportProductsCsv = onCall({ cors: true }, async (req: Req<{ csv: string }>) => {
  const role = (req.auth as any)?.token?.role;
  if (!role || !['admin','manager'].includes(role)) throw new HttpsError('permission-denied','Only manager/admin');
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

    // Upsert by SKU if present, else by name
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

    // Commit in chunks of 400 writes
    if (upserts % 400 === 0){ await batch.commit(); logger.info('Committed 400 product writes'); }
  }

  if (upserts % 400 !== 0){ await batch.commit(); }
  return { ok:true, upserts };
});

export const adminExportProductsCsv = onCall({ cors: true }, async (req: Req) => {
  const role = (req.auth as any)?.token?.role;
  if (!role || !['admin','manager'].includes(role)) throw new HttpsError('permission-denied','Only manager/admin');
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
