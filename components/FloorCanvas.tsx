'use client';
import { useRef, useState } from 'react';

type Node = {
  id: string; name: string; x: number; y: number; w: number; h: number;
  rotation: number; shape: 'rect'|'round'; seats: number; zone?: string; visible: boolean
};

export default function FloorCanvas({
  size, nodes, onChange, background,
}:{
  size:{w:number;h:number};
  nodes:Node[];
  onChange:(nodes:Node[])=>void;
  background?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [drag,setDrag] = useState<{ id:string; mode:'move'|'resize'|'rotate'; offX:number; offY:number }|null>(null);

  function onDown(e:React.MouseEvent, id:string, mode:'move'|'resize'|'rotate'){
    const r=wrapRef.current!.getBoundingClientRect();
    const n=nodes.find(x=>x.id===id)!;
    setDrag({ id, mode, offX: e.clientX - (r.left + n.x), offY: e.clientY - (r.top + n.y) });
  }
  function onMove(e:React.MouseEvent){
    if(!drag) return;
    const r=wrapRef.current!.getBoundingClientRect();
    const idx=nodes.findIndex(n=>n.id===drag.id);
    const n={...nodes[idx]};
    if(drag.mode==='move'){
      n.x=Math.max(0, Math.min(size.w-n.w, e.clientX - r.left - drag.offX));
      n.y=Math.max(0, Math.min(size.h-n.h, e.clientY - r.top - drag.offY));
    }
    if(drag.mode==='resize'){
      const x=e.clientX - r.left; const y=e.clientY - r.top;
      n.w=Math.max(40, Math.min(size.w-n.x, x-n.x));
      n.h=Math.max(40, Math.min(size.h-n.y, y-n.y));
    }
    if(drag.mode==='rotate'){
      const cx=n.x+n.w/2, cy=n.y+n.h/2;
      const ang=Math.atan2((e.clientY - (r.top+cy)), (e.clientX - (r.left+cx)));
      n.rotation = Math.round((ang*180/Math.PI));
    }
    const arr=[...nodes]; arr[idx]=n; onChange(arr);
  }
  function onUp(){ setDrag(null); }

  return (
    <div
      ref={wrapRef}
      onMouseMove={onMove}
      onMouseUp={onUp}
      className="relative border rounded"
      style={{
        width:size.w, height:size.h,
        backgroundImage: background? `url(${background})` : undefined,
        backgroundSize: 'cover'
      }}
    >
      <div className="absolute inset-0 bg-[conic-gradient(at_10px_10px,#eee_90deg,transparent_0)_0_0/20px_20px]/60 pointer-events-none"/>
      {nodes.map(n=> (
        <div key={n.id}
          className="absolute select-none"
          style={{ left:n.x, top:n.y, width:n.w, height:n.h, transform:`rotate(${n.rotation}deg)`, opacity: n.visible?1:.4 }}
        >
          <div
            onMouseDown={(e)=>onDown(e,n.id,'move')}
            className="w-full h-full bg-white/90 border border-slate-300 rounded-md flex items-center justify-center cursor-move shadow-sm"
          >
            <span className="text-xs text-slate-800 font-semibold">{n.name}</span>
          </div>
          <div onMouseDown={(e)=>onDown(e,n.id,'resize')} className="absolute -right-1 -bottom-1 w-3 h-3 bg-emerald-600 rounded-sm cursor-se-resize"/>
          <div onMouseDown={(e)=>onDown(e,n.id,'rotate')} className="absolute -right-1 -top-3 w-3 h-3 bg-amber-500 rounded-sm cursor-alias"/>
        </div>
      ))}
    </div>
  );
}
