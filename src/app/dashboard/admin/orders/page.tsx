'use client';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/stores/auth-store';
import { fmtZAR } from '@/utils/money';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const profile = useAuth(s => s.profile);

  async function load() {
    setLoading(true);
    const qy = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(25));
    const snap = await getDocs(qy);
    setOrders(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createSampleOrder() {
    if (!profile) return;
    setLoading(true);
    const ps = await getDocs(query(collection(db, 'products'), limit(3)));
    const items = ps.docs.slice(0, 2).map(d => {
      const p = d.data() as any;
      const qty = Math.floor(Math.random() * 2) + 1;
      const price = Number(p.price || 0);
      return { productId: d.id, name: p.name, qty, price, lineTotal: qty * price };
    });
    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
    const tax = Number((subtotal * 0.15).toFixed(2));
    const total = Number((subtotal + tax).toFixed(2));
    await addDoc(collection(db, 'orders'), {
      createdAt: serverTimestamp(),
      cashierId: profile.id,
      items, subtotal, tax, total, status: 'paid',
    });
    await load();
  }
  
  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Orders</CardTitle>
              <CardDescription>Showing the last 25 orders.</CardDescription>
            </div>
            <Button onClick={createSampleOrder} disabled={loading}>Create Sample Order</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
             <div className="space-y-3">
              <div className="h-16 bg-muted rounded-md animate-pulse"></div>
              <div className="h-16 bg-muted rounded-md animate-pulse"></div>
              <div className="h-16 bg-muted rounded-md animate-pulse"></div>
            </div>
          ) : (
            <ul className="space-y-3">
              {orders.map(o => (
                <li key={o.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center font-medium">
                    <span>Order #{o.id.slice(-6).toUpperCase()}</span>
                    <span className="font-bold text-lg">{fmtZAR(o.total)}</span>
                  </div>
                  <div className="text-sm text-muted-foreground capitalize">
                    Status: <span className="font-semibold text-foreground">{o.status}</span>
                  </div>
                   <div className="text-sm text-muted-foreground">
                    Items: {o.items?.map((i:any)=>`${i.name} × ${i.qty}`).join(', ')}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    {o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString() : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
