
'use client';
import { useEffect, useState } from 'react';
import { app } from '@/lib/firebase';
import {
  getFirestore, doc, updateDoc, addDoc, collection, serverTimestamp
} from 'firebase/firestore';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

const schema = z.object({
  id: z.string().optional(),
  name: z.string().min(1,'Name is required'),
  sku: z.string().optional(),
  plu: z.string().optional(),
  barcode: z.string().optional(),
  categoryId: z.string().optional(),
  priceCents: z.coerce.number().int().min(0),
  costCents: z.coerce.number().int().min(0).optional(),
  vatRate: z.coerce.number().min(0).max(100).optional(),
  unit: z.string().optional(),
  active: z.boolean().default(true)
});

type FormData = z.infer<typeof schema>;

export default function ProductFormDrawer({ product, onClose, onSaved }:{ product: Partial<FormData>|null, onClose:()=>void, onSaved:()=>void }){
  const db = getFirestore(app);
  const { register, handleSubmit, reset, formState:{ errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { active:true } });
  const [cats,setCats]=useState<{id:string;name:string}[]>([]);

  useEffect(()=>{ reset(product||{} as any); },[product, reset]);
  useEffect(()=>{
    // lightweight categories feed (names only)
    import('firebase/firestore').then(({getDocs, collection})=>{
      getDocs(collection(db,'categories')).then(s=> setCats(s.docs.map(d=>({id:d.id, name:(d.data() as any).name||d.id}))))
        .catch(()=>setCats([]));
    });
  },[db]);

  async function onSubmit(data:FormData){
    const payload:any = { ...data, updatedAt: serverTimestamp() };
    if (!data.id){
      payload.createdAt = serverTimestamp();
      const r = await addDoc(collection(db,'items'), payload);
      reset({ id:r.id, ...data });
    } else {
      const ref = doc(db,'items', data.id);
      await updateDoc(ref, payload);
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex justify-end">
      <div className="w-full max-w-md h-full bg-white p-4 overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-semibold">{product?.id? 'Edit Product':'New Product'}</div>
          <button onClick={onClose} className="px-2 py-1 rounded border">Close</button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <input type="hidden" {...register('id')} />
          <label className="block text-sm">Name
            <input className="border rounded p-2 w-full" {...register('name')} />
            {errors.name && <div className="text-rose-700 text-xs">{errors.name.message}</div>}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm">SKU<input className="border rounded p-2 w-full" {...register('sku')} /></label>
            <label className="block text-sm">PLU<input className="border rounded p-2 w-full" {...register('plu')} /></label>
          </div>
          <label className="block text-sm">Barcode<input className="border rounded p-2 w-full" {...register('barcode')} /></label>
          <label className="block text-sm">Category
            <select className="border rounded p-2 w-full" {...register('categoryId')}>
              <option value="">—</option>
              {cats.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm">Price (cents)
              <input type="number" className="border rounded p-2 w-full" {...register('priceCents')} />
            </label>
            <label className="block text-sm">Cost (cents)
              <input type="number" className="border rounded p-2 w-full" {...register('costCents')} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm">VAT %
              <input type="number" step="0.01" className="border rounded p-2 w-full" {...register('vatRate')} />
            </label>
            <label className="block text-sm">Unit
              <input className="border rounded p-2 w-full" placeholder="ea/kg/l…" {...register('unit')} />
            </label>
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('active')} /> Active
          </label>

          <div className="pt-2 flex items-center justify-between">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded border">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 rounded bg-black text-white disabled:opacity-50">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
