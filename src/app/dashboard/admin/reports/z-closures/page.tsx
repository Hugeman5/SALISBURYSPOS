
'use client';
import { useEffect, useState } from 'react';
import { app } from '@/lib/firebase';
import { getFirestore, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

export default function ZClosuresPage(){
  const db = getFirestore(app);
  const [startDate, setStartDate] = useState(new Date(Date.now()-7*864e5).toISOString().slice(0,10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0,10));
  const [locationId, setLocationId] = useState('');
  const [rows, setRows] = useState<any[]>([]);

  async function load(){
    let q1 = query(collection(db, 'z_closures'), where('date','>=',startDate), where('date','<=',endDate));
    if (locationId) q1 = query(q1, where('locationId','==',locationId));
    // Firestore requires indexes for multiple where clauses — add suggested index if needed
    // We order client-side to keep it simple
    const snap = await getDocs(q1);
    const data = snap.docs.map(d=>({ id:d.id, ...d.data()})).sort((a:any,b:any)=> (a.date+b.locationId).localeCompare(b.date+b.locationId));
    setRows(data);
  }

  async function exportCsv(){
    const fn = httpsCallable(getFunctions(app), 'adminExportZCsv');
    const r:any = await fn({ startDate, endDate, locationId: locationId || undefined });
    const blob = new Blob([r.data.csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = r.data.filename; a.click();
  }

  useEffect(()=>{ load(); },[]);

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-semibold mb-4">Z-closures</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <label>Start
          <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="border p-2 rounded w-full"/>
        </label>
        <label>End
          <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="border p-2 rounded w-full"/>
        </label>
        <label>Location
          <input value={locationId} onChange={e=>setLocationId(e.target.value)} className="border p-2 rounded w-full" placeholder="optional"/>
        </label>
        <div className="flex items-end gap-2">
          <button onClick={load} className="px-3 py-2 rounded bg-gray-900 text-white">Load</button>
          <button onClick={exportCsv} className="px-3 py-2 rounded bg-black text-white">Export CSV</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Location</th>
              <th className="py-2 pr-4">Gross</th>
              <th className="py-2 pr-4">Net</th>
              <th className="py-2 pr-4">Discounts</th>
              <th className="py-2 pr-4">Returns</th>
              <th className="py-2 pr-4">Tax</th>
              <th className="py-2 pr-4">Expected Cash</th>
              <th className="py-2 pr-4">Counted</th>
              <th className="py-2 pr-4">Over/Short</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b hover:bg-gray-50">
                <td className="py-1 pr-4">{r.date}</td>
                <td className="py-1 pr-4">{r.locationId}</td>
                <td className="py-1 pr-4">R{((r.grossSalesCents||0)/100).toFixed(2)}</td>
                <td className="py-1 pr-4">R{((r.netSalesCents||0)/100).toFixed(2)}</td>
                <td className="py-1 pr-4">R{((r.discountsCents||0)/100).toFixed(2)}</td>
                <td className="py-1 pr-4">R{((r.returnsCents||0)/100).toFixed(2)}</td>
                <td className="py-1 pr-4">R{((r.taxCents||0)/100).toFixed(2)}</td>
                <td className="py-1 pr-4">R{((r.cashExpectedCents||0)/100).toFixed(2)}</td>
                <td className="py-1 pr-4">R{((r.cashCountedCents||0)/100).toFixed(2)}</td>
                <td className="py-1 pr-4">R{((r.cashOverShortCents||0)/100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
