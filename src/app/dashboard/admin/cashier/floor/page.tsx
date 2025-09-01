
'use client';
import { useEffect, useState } from 'react';
import { app } from '@/lib/firebase';
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

export default function FloorLive(){
  const db = getFirestore(app);
  const openTab = httpsCallable(getFunctions(app), 'openTableTab');
  const moveTab = httpsCallable(getFunctions(app), 'moveTabToTable');
  const closeTab = httpsCallable(getFunctions(app), 'closeTableTab');
  const [plan, setPlan] = useState<any>(null);
  const [state, setState] = useState<Record<string, any>>({});

  useEffect(()=>{
    (async()=>{
      const pSnap = await getDocs(query(collection(db,'floor_plans')));
      const p = pSnap.docs[0]?.data(); setPlan(p);
      if (p) {
        const sSnap = await getDocs(query(collection(db,'table_state'), where('locationId','==', p.locationId)));
        const map: any = {}; sSnap.docs.forEach(d=> map[d.id] = d.data()); setState(map);
      }
    })();
  },[]);

  if (!plan) return <div className="p-6">Loading…</div>;
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-3">Floor — {plan.name}</h1>
      <div className="relative bg-[conic-gradient(at_10px_10px,#eee_90deg,transparent_0)_0_0/20px_20px] border rounded" style={{ width: plan.width, height: plan.height }}>
        {plan.tables.map((t:any)=>{
          const st = state[t.id] || { status:'open' };
          const color = st.status==='occupied' ? '#fde047' : st.status==='dirty' ? '#fecaca' : '#dcfce7';
          return (
            <div key={t.id} className="absolute text-xs flex flex-col gap-1 p-2 rounded border"
              style={{ left:t.x, top:t.y, width:t.w, height:t.h, background: color }}>
              <div className="flex items-center justify-between">
                <span className="font-semibold">{t.name}</span>
                <span>{st.status}</span>
              </div>
              <div className="mt-auto flex gap-1">
                {st.status!=='occupied' && <button onClick={()=>openTab({ tableId:t.id, locationId: plan.locationId })} className="px-2 py-1 rounded border">Open</button>}
                {st.status==='occupied' && <button onClick={()=>closeTab({ tableId:t.id })} className="px-2 py-1 rounded border">Close</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
