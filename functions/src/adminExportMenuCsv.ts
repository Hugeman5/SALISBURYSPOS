import { onCall as onCallMenuCsv } from 'firebase-functions/v2/https';
import { getFirestore as getDbMenuCsv } from 'firebase-admin/firestore';


export const adminExportMenuCsv = onCallMenuCsv(async (req)=>{
const ctx = req.auth; if (!ctx) throw new Error('UNAUTH');
const role = (ctx.token as any)?.role; if (!['admin','manager'].includes(role)) throw new Error('FORBIDDEN');
const db = getDbMenuCsv();
const [cats, items] = await Promise.all([db.collection('menu_categories').get(), db.collection('menu_items').get()]);
const byCat: Record<string,string> = {}; cats.docs.forEach(d=> byCat[d.id] = (d.data() as any).name);
const header = ['category','item','sku','plu','price','active'];
const rows = items.docs.map(d=>{ const x:any = d.data(); return [byCat[x.categoryId]||'', x.name, x.sku||'', x.plu||'', (x.priceCents/100).toFixed(2), x.active?'1':'0'].join(','); });
return { ok:true, filename:'menu.csv', csv: header.join(',')+'\n'+rows.join('\n') };
});