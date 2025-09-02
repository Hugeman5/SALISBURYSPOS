'use client';
import { useEffect, useMemo, useState } from 'react';
import FloorCanvas from '@/components/FloorCanvas';
import UploadDropzone from '@/components/UploadDropzone';
import { app } from '@/lib/firebaseClient';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirestore, collection, onSnapshot, query, where } from 'firebase/firestore';

type Node = {
  id:string; name:string; x:number; y:number; w:number; h:number;
  rotation:number; shape:'rect'|'round'; seats:number; zone?:string; visible:boolean
};

export default function FloorBuilderPage(){
  const db = getFirestore(app);
  const savePlan = httpsCallable(getFunctions(app),'adminUpsertFloorPlan');

  const [locationId] = useState('main');
  const [plan, setPlan] = useState<{ id?:string; name:string; width:number; height:number; imageUrl?:string; promptCovers?:boolean }>({
    name:'Main Floor', width:900, height:600, promptCovers:true
  });
  const [nodes, setNodes] = useState<Node[]>([]);
  const [selectedId, setSelectedId] = useState<string|null>(null);

  // Load first plan for location in real-time
  useEffect(()=>{
    const unsub = onSnapshot(query(collection(db,'floor_plans'), where('locationId','==', locationId)), s => {
      const doc0 = s.docs[0];
      if (!doc0) return;
      const p:any = doc0.data();
      setPlan({ id:p.id, name:p.name, width:p.width, height:p.height, imageUrl:p.imageUrl||'', promptCovers: !!p.promptCovers });
      setNodes((p.tables||[]).map((t:any)=> ({
        id:t.id, name:t.name, x:t.x, y:t.y, w:t.w, h:t.h,
        rotation:t.rotation||0, shape:t.shape||'rect', seats:t.seats||4, zone:t.zone||'', visible: t.visible!==false
      })));
    });
    return ()=>unsub();
  },[locationId, db]);

  function addTable(){
    const id = `T${(nodes.length+1).toString().padStart(2,'0')}`;
    setNodes(ns=> ns.concat({ id, name:id, x:40, y:40, w:100, h:80, rotation:0, shape:'rect', seats:4, visible:true }));
  }
  function duplicate(){
    if(!selectedId) return; const src=nodes.find(n=>n.id===selectedId)!;
    const id = src.name+"_copy";
    setNodes(ns=> ns.concat({ ...src, id, name:id, x: src.x+20, y: src.y+20 }));
  }
  function remove(){ if(!selectedId) return; setNodes(ns=> ns.filter(n=> n.id!==selectedId)); setSelectedId(null); }
  function align(axis:'x'|'y'){
    if(!selectedId) return; const base=nodes.find(n=>n.id===selectedId)!;
    setNodes(ns=> ns.map(n=> selectedId===n.id? n : ({ ...n, [axis]: (base as any)[axis] } as any)));
  }
  function toggleVisible(ids:string[], v:boolean){ setNodes(ns=> ns.map(n=> ids.includes(n.id) ? { ...n, visible:v } : n)); }

  async function save(){
    const payload = {
      id: plan.id, locationId, name: plan.name, width: plan.width, height: plan.height,
      imageUrl: plan.imageUrl||'', promptCovers: !!plan.promptCovers, tables: nodes
    };
    const r:any = await savePlan(payload);
    if (!plan.id && r.data.id) setPlan(p=> ({ ...p, id: r.data.id }));
    alert('Saved');
  }

  const selected = useMemo(()=> nodes.find(n=>n.id===selectedId)||null, [nodes, selectedId]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Floor Plan Builder</h1>
        <div className="flex items-center gap-2">
          <button onClick={addTable} className="px-3 py-2 rounded border bg-white">+ Table</button>
          <button onClick={duplicate} className="px-3 py-2 rounded border bg-white" disabled={!selectedId}>Duplicate</button>
          <button onClick={()=>align('x')} className="px-3 py-2 rounded border bg-white" disabled={!selectedId}>Align X</button>
          <button onClick={()=>align('y')} className="px-3 py-2 rounded border bg-white" disabled={!selectedId}>Align Y</button>
          <button onClick={()=>toggleVisible(selectedId?[selectedId]:nodes.map(n=>n.id), false)} className="px-3 py-2 rounded border bg-white">Hide</button>
          <button onClick={()=>toggleVisible(selectedId?[selectedId]:nodes.map(n=>n.id), true)} className="px-3 py-2 rounded border bg-white">Show</button>
          <button onClick={remove} className="px-3 py-2 rounded border text-rose-700" disabled={!selectedId}>Delete</button>
          <button onClick={save} className="px-3 py-2 rounded bg-black text-white">Save</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 p-4 rounded-2xl border bg-white">
          <FloorCanvas size={{ w: plan.width, h: plan.height }} nodes={nodes} onChange={setNodes} background={plan.imageUrl}/>
        </div>
        <div className="lg:col-span-4 p-4 rounded-2xl border bg-white space-y-4">
          <h2 className="font-semibold">Properties</h2>
          <div className="grid grid-cols-2 gap-2">
            <label className="col-span-2 text-sm">Name
              <input className="border p-2 rounded w-full" value={plan.name} onChange={e=>setPlan(p=>({ ...p, name:e.target.value }))}/>
            </label>
            <label className="text-sm">Width
              <input type="number" className="border p-2 rounded w-full" value={plan.width} onChange={e=>setPlan(p=>({ ...p, width:Number(e.target.value) }))}/>
            </label>
            <label className="text-sm">Height
              <input type="number" className="border p-2 rounded w-full" value={plan.height} onChange={e=>setPlan(p=>({ ...p, height:Number(e.target.value) }))}/>
            </label>
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!plan.promptCovers} onChange={e=>setPlan(p=>({ ...p, promptCovers: e.target.checked }))}/>
              Prompt covers on open
            </label>
            <div className="col-span-2">
              <div className="text-sm mb-1">Background image</div>
              <UploadDropzone pathPrefix={`uploads/floor`} onDone={(url)=>setPlan(p=>({ ...p, imageUrl: url }))} />
              {plan.imageUrl && <div className="text-xs text-slate-600 mt-1 break-all">{plan.imageUrl}</div>}
            </div>
          </div>

          <h3 className="font-semibold mt-4">Tables</h3>
          <div className="max-h-72 overflow-auto divide-y">
            {nodes.map(n=> (
              <button key={n.id}
                onClick={()=>setSelectedId(n.id)}
                className={`w-full text-left p-2 rounded ${selectedId===n.id? 'bg-emerald-50 border border-emerald-200':'hover:bg-neutral-50'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{n.name}</span>
                  <span className="text-[11px] text-slate-600">{n.shape} • {n.seats} seats</span>
                </div>
              </button>
            ))}
          </div>

          {selected && (
            <div className="mt-4 space-y-2">
              <div className="text-sm font-semibold">Inspector: {selected.name}</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <label className="col-span-2">Name
                  <input className="border p-2 rounded w-full"
                         value={selected.name}
                         onChange={e=>setNodes(ns=> ns.map(x=> x.id===selected.id? { ...x, name:e.target.value }:x))}/>
                </label>
                <label>X
                  <input type="number" className="border p-2 rounded w-full"
                         value={selected.x}
                         onChange={e=>setNodes(ns=> ns.map(x=> x.id===selected.id? { ...x, x:Number(e.target.value) }:x))}/>
                </label>
                <label>Y
                  <input type="number" className="border p-2 rounded w-full"
                         value={selected.y}
                         onChange={e=>setNodes(ns=> ns.map(x=> x.id===selected.id? { ...x, y:Number(e.target.value) }:x))}/>
                </label>
                <label>W
                  <input type="number" className="border p-2 rounded w-full"
                         value={selected.w}
                         onChange={e=>setNodes(ns=> ns.map(x=> x.id===selected.id? { ...x, w:Number(e.target.value) }:x))}/>
                </label>
                <label>H
                  <input type="number" className="border p-2 rounded w-full"
                         value={selected.h}
                         onChange={e=>setNodes(ns=> ns.map(x=> x.id===selected.id? { ...x, h:Number(e.target.value) }:x))}/>
                </label>
                <label>Rotation
                  <input type="number" className="border p-2 rounded w-full"
                         value={selected.rotation}
                         onChange={e=>setNodes(ns=> ns.map(x=> x.id===selected.id? { ...x, rotation:Number(e.target.value) }:x))}/>
                </label>
                <label>Seats
                  <input type="number" className="border p-2 rounded w-full"
                         value={selected.seats}
                         onChange={e=>setNodes(ns=> ns.map(x=> x.id===selected.id? { ...x, seats:Number(e.target.value) }:x))}/>
                </label>
                <label>Shape
                  <select className="border p-2 rounded w-full"
                          value={selected.shape}
                          onChange={e=>setNodes(ns=> ns.map(x=> x.id===selected.id? { ...x, shape:e.target.value as any }:x))}>
                    <option value="rect">Rect</option>
                    <option value="round">Round</option>
                  </select>
                </label>
                <label className="col-span-2 flex items-center gap-2">
                  Visible
                  <input type="checkbox" checked={selected.visible}
                         onChange={e=>setNodes(ns=> ns.map(x=> x.id===selected.id? { ...x, visible:e.target.checked }:x))}/>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
