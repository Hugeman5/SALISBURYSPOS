
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { app } from '@/lib/firebase';
import {
  getFirestore, collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import ProductFormDrawer from '@/components/admin/products/ProductFormDrawer';
import { Product } from '@/types';
import { fmtZAR } from '@/lib/utils';
import { getPriceCents } from '@/lib/utils';

export default function ProductsPage(){
  const db = getFirestore(app);
  const fns = getFunctions(app);
  const importFn = httpsCallable(fns,'adminImportProductsCsv');
  const exportFn = httpsCallable(fns,'adminExportProductsCsv');

  const fileRef = useRef<HTMLInputElement>(null);
  const [items,setItems]=useState<Product[]>([]);
  const [qTxt,setQTxt]=useState('');
  const [showDrawer,setShowDrawer]=useState(false);
  const [editing,setEditing]=useState<Product|null>(null);

  useEffect(()=>{
    const unsub = onSnapshot(query(collection(db,'items'), orderBy('name','asc')), s => {
      setItems(s.docs.map(d=> ({ id:d.id, ...(d.data() as any) })));
    });
    return ()=>unsub();
  },[db]);

  const filtered = useMemo(()=>{
    const q=qTxt.trim().toLowerCase();
    if(!q) return items;
    return items.filter(i => (i.name||'').toLowerCase().includes(q) || (i.sku||'').toLowerCase().includes(q) || ((i as any).plu||'').toLowerCase().includes(q));
  },[items,qTxt]);

  async function toggleActive(p:Product){
    if(!p.id) return;
    await updateDoc(doc(db,'items',p.id), { active: !p.active, updatedAt: serverTimestamp() });
  }

  async function onImportCsv(e: React.ChangeEvent<HTMLInputElement>){
    const f = e.target.files?.[0]; if(!f) return;
    const text = await f.text();
    await importFn({ csv: text });
    alert('Import queued / applied.');
    e.target.value='';
  }

  async function onExportCsv(){
    const r:any = await exportFn({});
    const blob = new Blob([r.data.csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=r.data.filename||'products.csv'; a.click();
  }

  function openNew(){ setEditing({ name:'', active:true } as Product); setShowDrawer(true); }
  function openEdit(p:Product){ setEditing(p); setShowDrawer(true); }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Products</h1>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onImportCsv}/>
          <button onClick={()=>fileRef.current?.click()} className="px-3 py-2 rounded border bg-white">Import CSV</button>
          <button onClick={onExportCsv} className="px-3 py-2 rounded border bg-white">Export CSV</button>
          <button onClick={openNew} className="px-3 py-2 rounded bg-black text-white">New Product</button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input value={qTxt} onChange={e=>setQTxt(e.target.value)} placeholder="Search by name, SKU, PLU" className="border rounded p-2 w-full"/>
      </div>

      <div className="rounded-2xl border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 text-slate-700">
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">SKU</th>
              <th className="text-left p-2">PLU</th>
              <th className="text-right p-2">Price</th>
              <th className="text-right p-2">Cost</th>
              <th className="text-left p-2">Category</th>
              <th className="text-center p-2">Active</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map(p=> (
              <tr key={p.id} className="hover:bg-neutral-50">
                <td className="p-2 font-medium">{p.name}</td>
                <td className="p-2">{p.sku||''}</td>
                <td className="p-2">{(p as any).plu||''}</td>
                <td className="p-2 text-right">{fmtZAR(getPriceCents(p))}</td>
                <td className="p-2 text-right">{p.costIncCents? new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(p.costIncCents/100): '-'}</td>
                <td className="p-2">{p.categoryId||'-'}</td>
                <td className="p-2 text-center">
                  <button onClick={()=>toggleActive(p)} className={`px-2 py-1 rounded border ${p.active? 'bg-emerald-600 text-white':'bg-white'}`}>{p.active?'On':'Off'}</button>
                </td>
                <td className="p-2 text-right"><button onClick={()=>openEdit(p)} className="px-2 py-1 rounded border">Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showDrawer && (
        <ProductFormDrawer
          product={
            editing
              ? {
                  ...editing,
                  priceCents: editing.priceCents ?? undefined,
                  costIncCents: editing.costIncCents ?? undefined,
                  vatRate: editing.vatRate ?? undefined,
                }
              : null
          }
          onClose={()=>setShowDrawer(false)}
          onSaved={()=>setShowDrawer(false)}
        />
      )}
    </div>
  );
}
