
'use client';
import { useEffect, useRef, useState } from 'react';
import { app } from '@/lib/firebase';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

type Node = { id:string; name:string; x:number; y:number; w:number; h:number; shape:'rect'|'round'; seats:number; active:boolean };

export default function FloorBuilder(){
  const db = getFirestore(app);
  const fn = httpsCallable(getFunctions(app), 'adminUpsertFloorPlan');
  const [plan, setPlan] = useState({ id:'', locationId:'main', name:'Main Floor', width:900, height:600 });
  const [nodes, setNodes] = useState<Node[]>([]);
  const [drag, setDrag] = useState<{ id:string; offX:number; offY:number }|null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  function addTable(){
    const id = 'T'+(nodes.length+1);
    setNodes(n=> n.concat({ id, name:id, x:40, y:40, w:100, h:80, shape:'rect', seats:4, active:true }));
  }

  function onDown(e: React.MouseEvent, id:string){
    const r = (wrapRef.current as HTMLDivElement).getBoundingClientRect();
    const node = nodes.find(n=>n.id===id)!;
    setDrag({ id, offX: e.clientX - (r.left + node.x), offY: e.clientY - (r.top + node.y) });
  }
  function onMove(e: React.MouseEvent){
    if (!drag) return;
    const r = (wrapRef.current as HTMLDivElement).getBoundingClientRect();
    const x = Math.max(0, Math.min(plan.width-20, e.clientX - r.left - drag.offX));
    const y = Math.max(0, Math.min(plan.height-20, e.clientY - r.top - drag.offY));
    setNodes(ns => ns.map(n=> n.id===drag.id ? { ...n, x, y } : n ));
  }
  function onUp(){ setDrag(null); }

  async function save(){
    await fn({ id: plan.id || undefined, locationId: plan.locationId, name: plan.name, width: plan.width, height: plan.height, tables: nodes });
    alert('Saved');
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-semibold">Floor Plan Builder</h1>
        <div className="flex gap-2">
          <button onClick={addTable} className="px-3 py-2 rounded border">+ Table</button>
          <button onClick={save} className="px-3 py-2 rounded bg-black text-white">Save</button>
        </div>
      </div>
      <div ref={wrapRef} onMouseMove={onMove} onMouseUp={onUp} className="relative bg-[conic-gradient(at_10px_10px,#eee_90deg,transparent_0)_0_0/20px_20px] border rounded"
        style={{ width: plan.width, height: plan.height }}>
        {nodes.map(n => (
          <div key={n.id} onMouseDown={(e)=>onDown(e,n.id)} className="absolute select-none cursor-move flex items-center justify-center text-xs bg-white border rounded"
            style={{ left:n.x, top:n.y, width:n.w, height:n.h, borderRadius: n.shape==='round' ? '9999px' : '8px' }}>
            {n.name}
          </div>
        ))}
      </div>
    </div>
  );
}
