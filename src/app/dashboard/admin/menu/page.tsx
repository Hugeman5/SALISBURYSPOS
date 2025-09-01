
'use client';
import { useEffect, useMemo, useState } from 'react';
import { app } from '@/lib/firebase';
import { getFirestore, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

export default function MenuBuilder(){
  const db = getFirestore(app);
  const fnUpsert = httpsCallable(getFunctions(app), 'adminUpsertMenu');
  const fnExport = httpsCallable(getFunctions(app), 'adminExportMenuCsv');
  const [cats, setCats] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState('');

  async function load(){
    const [c,i] = await Promise.all([
      getDocs(query(collection(db,'menu_categories'), orderBy('order','asc'))),
      getDocs(collection(db,'menu_items')),
    ]);
    setCats(c.docs.map(d=>({ id:d.id, ...d.data()})));
    setItems(i.docs.map(d=>({ id:d.id, ...d.data()})));
  }
  useEffect(()=>{ load(); },[]);

  async function saveCategory(cat:any){
    await fnUpsert({ entity:'category', data:cat });
    await load();
  }
  async function saveItem(it:any){
    it.priceCents = Math.round((Number(it.price) || 0) * 100);
    await fnUpsert({ entity:'item', data:it });
    await load();
  }
  async function exportCsv(){
    const r:any = await fnExport({});
    const blob = new Blob([r.data.csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=r.data.filename; a.click();
  }

  const filtered = useMemo(()=> items.filter(x=> (x.name||'').toLowerCase().includes(filter.toLowerCase())), [items,filter]);

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Menu Builder</h1>
        <div className="flex gap-2">
          <input placeholder="Filter items" value={filter} onChange={e=>setFilter(e.target.value)} className="border p-2 rounded"/>
          <button onClick={exportCsv} className="px-3 py-2 rounded bg-black text-white">Export CSV</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 border rounded p-3">
          <h2 className="font-semibold mb-2">Categories</h2>
          <ul className="space-y-2">
            {cats.map(c=> (
              <li key={c.id} className="flex items-center gap-2">
                <input className="border p-1 rounded flex-1" defaultValue={c.name} onBlur={e=>saveCategory({ ...c, name:e.target.value })}/>
                <input type="number" className="w-16 border p-1 rounded" defaultValue={c.order} onBlur={e=>saveCategory({ ...c, order:Number(e.target.value) })}/>
                <label className="text-xs flex items-center gap-1"><input type="checkbox" defaultChecked={c.active} onChange={e=>saveCategory({ ...c, active:e.target.checked })}/> active</label>
              </li>
            ))}
          </ul>
          <button onClick={()=>saveCategory({ name:'New Category', order: (cats.at(-1)?.order||0)+1, active:true })} className="mt-3 px-3 py-2 rounded border">+ Add Category</button>
        </div>

        <div className="md:col-span-2 border rounded p-3">
          <h2 className="font-semibold mb-2">Items</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-1 pr-2">Name</th>
                <th className="py-1 pr-2">Category</th>
                <th className="py-1 pr-2">Price</th>
                <th className="py-1 pr-2">PLU</th>
                <th className="py-1 pr-2">Active</th>
                <th className="py-1 pr-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(x=> (
                <tr key={x.id} className="border-b">
                  <td className="py-1 pr-2"><input className="border p-1 rounded w-full" defaultValue={x.name} onBlur={e=>saveItem({ ...x, name:e.target.value })}/></td>
                  <td className="py-1 pr-2">
                    <select defaultValue={x.categoryId} className="border p-1 rounded" onChange={e=>saveItem({ ...x, categoryId:e.target.value })}>
                      {cats.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td className="py-1 pr-2"><input className="border p-1 rounded w-24" defaultValue={(x.priceCents/100).toFixed(2)} onBlur={e=>saveItem({ ...x, price: e.target.value })}/></td>
                  <td className="py-1 pr-2"><input className="border p-1 rounded w-24" defaultValue={x.plu||''} onBlur={e=>saveItem({ ...x, plu: e.target.value })}/></td>
                  <td className="py-1 pr-2"><input type="checkbox" defaultChecked={x.active} onChange={e=>saveItem({ ...x, active: e.target.checked })}/></td>
                  <td className="py-1 pr-2 text-right">
                    <button className="px-2 py-1 text-xs rounded border" onClick={()=>saveItem({ name:'New Item', categoryId: cats[0]?.id, price: '0.00', active:true })}>+ Add</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
