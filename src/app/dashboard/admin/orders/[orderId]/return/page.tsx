
'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';

export default function ReturnOrder(){
  const { orderId } = useParams() as { orderId: string };
  const [order, setOrder] = useState<any>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [method, setMethod] = useState<'cash'|'card'|'store_credit'>('cash');
  const db = getFirestore(app);
  const fn = httpsCallable(getFunctions(app), 'cashierRefundItems');

  useEffect(()=>{
    if (!orderId) return;
    (async()=>{
      const snap = await getDoc(doc(db, 'orders', String(orderId)));
      setOrder(snap.data());
      setLines((snap.data()?.items||[]).map((l:any)=>({ productId:l.productId, name:l.name, priceInc:l.priceInc, qty:0, reason:'customer_change', note:'' })));
    })();
  },[orderId, db]);

  async function submit(){
    const chosen = lines.filter(l=>l.qty>0);
    if (chosen.length===0) return alert('Choose at least one line.');
    const r:any = await fn({ orderId, lines: chosen, method });
    if (r.data?.ok) alert('Refund processed');
  }

  if (!order) return <div className="p-6">Loading…</div>;
  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-4">Return / Refund</h1>
      <div className="mb-4">
        <p className="text-sm text-gray-600">Order: {orderId}</p>
      </div>
      <div className="space-y-4">
        {order.items?.map((l:any, idx:number)=> (
          <div key={l.productId} className="border rounded p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{l.qty}× {l.name}</p>
                <p className="text-sm text-gray-500">{(l.priceInc/100).toFixed(2)}</p>
              </div>
              <input type="number" min={0} max={l.qty} value={lines[idx]?.qty||0}
                onChange={e=>{ const c=[...lines]; c[idx]={...c[idx], qty: Number(e.target.value)}; setLines(c); }}
                className="w-24 border p-2 rounded"/>
            </div>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
              <select value={lines[idx]?.reason}
                onChange={e=>{ const c=[...lines]; c[idx]={...c[idx], reason: e.target.value}; setLines(c); }}
                className="border p-2 rounded">
                <option value="customer_change">Customer changed mind</option>
                <option value="quality">Quality issue</option>
                <option value="wrong_item">Wrong item</option>
                <option value="void_error">Void / error</option>
                <option value="other">Other</option>
              </select>
              <input placeholder="Note (optional)" className="border p-2 rounded"
                value={lines[idx]?.note||''}
                onChange={e=>{ const c=[...lines]; c[idx]={...c[idx], note: e.target.value}; setLines(c); }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <select value={method} onChange={e=>setMethod(e.target.value as any)} className="border p-2 rounded">
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="store_credit">Store credit</option>
        </select>
        <button onClick={submit} className="px-4 py-2 rounded bg-black text-white">Process Refund</button>
      </div>
    </div>
  );
}
