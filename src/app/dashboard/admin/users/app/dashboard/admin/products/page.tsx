
'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type Product = { name: string; price: number; categoryId?: string; active?: boolean };

export default function ProductsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('0');

  async function load() {
    const snap = await getDocs(collection(db, 'products'));
    setRows(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
  }

  useEffect(() => { load(); }, []);

  async function add() {
    if (!name.trim()) return;
    await addDoc(collection(db, 'products'), {
      name, price: Number(price), active: true
    } as Product);
    setName(''); setPrice('0'); await load();
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Products</h1>
      <div className="flex gap-2">
        <input className="border px-2 py-1 rounded" placeholder="Name" value={name} onChange={e=>setName(e.target.value)} />
        <input className="border px-2 py-1 rounded" placeholder="Price" value={price} onChange={e=>setPrice(e.target.value)} />
        <button className="px-3 py-1 rounded bg-primary text-white" onClick={add}>Add</button>
      </div>
      <ul className="list-disc pl-6">
        {rows.map(p => (
          <li key={p.id}>{p.name} — {p.price.toFixed?.(2) ?? p.price}</li>
        ))}
      </ul>
    </div>
  );
}
