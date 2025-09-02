'use client';
import { useEffect, useState } from 'react';
import { app } from '@/lib/firebaseClient';
import { getFirestore, collection, onSnapshot, query, where } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

export default function FloorLive(){
  const db = getFirestore(app);
  const openTab = httpsCallable(getFunctions(app),'openTableTab');
  const closeTab = httpsCallable(getFunctions(app),'closeTableTab');

  const [locationId] = useState('main');
  const [plan,setPlan]=useState<any>(null);
  const [state,setState]=useState<Record<string,any>>({});

  useEffect(()=>{
    const unsubPlan = onSnapshot(query(collection(db,'floor_plans'), where('locationId','==', locationId)), s=> {
      const p=s.docs[0]?.data(); setPlan(p||null);
    });
    const unsubState = onSnapshot(query(collection(db,'table_state'), where('locationId','==', locationId)), s=> {
      const map:any={}; s.docs.forEach(d=> map[d.id]=d.data()); setState(map);
    });
    return ()=>{unsubPlan();unsubState();};
  },[locationId]);

  const colorFor = (st:string)=> st==='occupied'? '#fde68a' : st==='dirty'? '#fecaca' : st==='reserved'? '#c7d2fe' : st==='disabled'? '#e5e7eb' : '#dcfce7';
  const sinceText = (iso?:string)=>{ if(!iso) return ''; const mins = Math.max(0, Math.floor((Date.now()-new Date(iso).getTime())/60000)); const h=Math.floor(mins/60), m=mins%60; return h? `${h}h ${m}m` : `${m}m`; };

  if (!plan) return <div className="p-6">Loading…</div>;
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Floor — {plan.name}</h1>
      <div className="relative border rounded"
           style={{ width: plan.width, height: plan.height, backgroundImage: plan.imageUrl? `url(${plan.imageUrl})`: undefined, backgroundSize:'cover' }}>
        <div className="absolute inset-0 bg-[conic-gradient(at_10px_10px,#eee_90deg,transparent_0)_0_0/20px_20px]/60 pointer-events-none"/>
        {plan.tables?.map((t:any)=>{
          const st = state[t.id] || { status: t.visible===false? 'disabled':'open' };
          return (
            <div key={t.id}
                 className="absolute text-xs p-2 rounded border"
                 style={{ left:t.x, top:t.y, width:t.w, height:t.h, background: colorFor(st.status) }}>
              <div className="flex items-center justify-between">
                <span className="font-semibold">{t.name}</span>
                <span className="text-[11px] text-slate-700">
                  {st.status}{st.since? ` • ${sinceText(st.since)}`:''}
                </span>
              </div>
              <div className="mt-auto flex gap-1">
                {st.status!=='occupied' && st.status!=='disabled' &&
                  <button onClick={()=>openTab({ tableId:t.id, locationId })} className="px-2 py-1 rounded border bg-white">Open</button>}
                {st.status==='occupied' &&
                  <button onClick={()=>closeTab({ tableId:t.id })} className="px-2 py-1 rounded border bg-white">Close</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
