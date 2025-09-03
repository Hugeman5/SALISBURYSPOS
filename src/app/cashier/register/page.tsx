'use client';

import { useMemo, useState } from 'react';
import { useLiveMenu } from '@/hooks/useLiveMenu';
import { app } from '@/lib/firebaseClient';
import { getFunctions, httpsCallable } from 'firebase/functions';

function fmtZAR(cents: number) { return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format((cents||0)/100); }

type CartLine = { itemId: string; name: string; priceCents: number; qty: number };

export default function CashierRegisterPage(){
  // TODO: Plug real device/location ids (settings or localStorage)
  const deviceId = 'FrontTill1';
  const locationId = 'main';
  const { loading, error, menu, screens, buttons, categories, itemsByCategory } = useLiveMenu({ deviceId, locationId });
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);

  // Prefer categories that are referenced by Category buttons on the default screen
  const referencedCategoryIds = useMemo(()=> {
    const ids = new Set<string>();
    for (const b of buttons) {
      if ((b as any).type === 'category' && b.refId) ids.add(b.refId);
    }
    return Array.from(ids);
  }, [buttons]);

  const visibleCategories = useMemo(() => {
    const map: Record<string, { id:string; name:string; order:number; active:boolean }> = {};
    for (const c of categories) map[c.id] = c;

    const ids = referencedCategoryIds.length > 0 ? referencedCategoryIds : Object.keys(itemsByCategory);
    const list = ids
      .map(id => map[id] || { id, name: id === 'uncat' ? 'Other' : id, order: 999, active: true })
      .filter(c => c && c.active !== false);
    // de-dupe and sort
    const byId: Record<string, any> = {}; for (const c of list) byId[c.id] = c;
    return Object.values(byId).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  }, [categories, itemsByCategory, referencedCategoryIds]);

  // pick default category
  const defaultCatId = activeCat ?? visibleCategories[0]?.id ?? 'uncat';
  const gridItems = itemsByCategory[defaultCatId] || [];

  function addToCart(item: { id: string; name: string; effPriceCents: number }){
    setCart(prev => {
      const idx = prev.findIndex(l => l.itemId === item.id);
      if (idx >= 0) { const copy = [...prev]; copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 }; return copy; }
      return prev.concat({ itemId: item.id, name: item.name, priceCents: item.effPriceCents, qty: 1 });
    });
  }
  function removeLine(itemId: string){ setCart(prev => prev.filter(l => l.itemId !== itemId)); }
  const totalCents = cart.reduce((s, l) => s + l.priceCents * l.qty, 0);

  async function checkout(){
    const fns = getFunctions(app);
    try {
      const create = httpsCallable(fns, 'cashierCreateOrder');
      const setItems = httpsCallable(fns, 'cashierSetItems');
      const close = httpsCallable(fns, 'cashierCloseOrder');
      const r: any = await create({ note: 'Register sale' });
      const orderId = r?.data?.orderId;
      if (!orderId) throw new Error('No orderId from cashierCreateOrder');
      await setItems({ orderId, lines: cart.map(l => ({ itemId: l.itemId, qty: l.qty, priceCents: l.priceCents })) });
      await close({ orderId, payment: { method: 'cash', amountCents: totalCents } });
      alert('Order completed');
      setCart([]);
    } catch (e: any) {
      console.warn('Checkout fallback (no callable functions):', e?.message || e);
      alert('Checkout stub: functions not available in this env. Cart cleared.');
      setCart([]);
    }
  }

  return (
    <div className="p-6 grid grid-cols-12 gap-4">
      <div className="col-span-8 bg-white border rounded-2xl p-4">
        <div className="mb-3 flex gap-2 overflow-x-auto">
          {visibleCategories.map(c => (
            <button key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`px-3 py-2 rounded border whitespace-nowrap ${ (activeCat??visibleCategories[0]?.id) === c.id ? 'bg-black text-white' : 'bg-white' }`}
            >{c.name}</button>
          ))}
        </div>

        {loading && <div className="text-slate-600">Loading menu…</div>}
        {error && <div className="text-rose-700">{error}</div>}
        {!loading && !error && gridItems.length === 0 && (
          <div className="text-slate-600">No items in this category.</div>
        )}

        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {gridItems.map((it:any) => (
            <button key={it.id} onClick={() => addToCart(it)}
              className="h-24 rounded border bg-neutral-50 text-left p-2 hover:bg-neutral-100">
              <div className="text-xs text-slate-600">{it.plu || it.sku || '\u00A0'}</div>
              <div className="font-semibold truncate">{it.name}</div>
              <div className="text-sm">{fmtZAR(it.effPriceCents)}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="col-span-4 bg-white border rounded-2xl p-4 flex flex-col">
        <div className="font-semibold mb-2">Cart</div>
        <div className="flex-1 overflow-auto divide-y">
          {cart.map(l => (
            <div key={l.itemId} className="py-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium truncate">{l.name}</div>
                <div className="text-xs text-slate-600">{l.qty} × {fmtZAR(l.priceCents)}</div>
              </div>
              <div className="text-right">
                <div className="font-medium">{fmtZAR(l.qty * l.priceCents)}</div>
                <button onClick={() => removeLine(l.itemId)} className="text-xs text-rose-700">Remove</button>
              </div>
            </div>
          ))}
          {cart.length === 0 && <div className="text-slate-600">No items yet.</div>}
        </div>
        <div className="mt-3 border-t pt-3 flex items-center justify-between">
          <div className="text-sm text-slate-600">Total</div>
          <div className="text-xl font-semibold">{fmtZAR(totalCents)}</div>
        </div>
        <button onClick={checkout} disabled={cart.length===0}
          className="mt-3 px-4 py-3 rounded bg-black text-white disabled:opacity-50">Checkout</button>
      </div>
    </div>
  );
}
