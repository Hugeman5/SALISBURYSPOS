'use client';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/stores/auth-store';

type Product = { id: string; name: string; price: number; active?: boolean };

export default function InventoryPage() {
  const [rows, setRows] = useState<(Product & { onHand: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const { role } = useAuth();
  const canWrite = role === 'admin' || role === 'manager';

  useEffect(() => { (async () => {
    const ps = await getDocs(collection(db, 'products'));
    const products = await Promise.all(ps.docs.map(async d => {
      const p = { id: d.id, ...(d.data() as any) } as Product;
      const inv = await getDoc(doc(db, 'inventory', d.id));
      const onHand = inv.exists() ? (inv.data() as any).onHand ?? 0 : 0;
      return { ...p, onHand };
    }));
    setRows(products);
    setLoading(false);
  })(); }, []);

  async function adjust(id: string, delta: number) {
    if (!canWrite) return;
    const ref = doc(db, 'inventory', id);
    const snap = await getDoc(ref);
    const current = snap.exists() ? (snap.data() as any).onHand ?? 0 : 0;
    const newAmount = Math.max(0, current + delta);
    await setDoc(ref, { onHand: newAmount, updatedAt: serverTimestamp() }, { merge: true });
    setRows(rows.map(r => r.id === id ? { ...r, onHand: newAmount } : r));
  }

  if (loading) return (
    <div className="p-6">
      <div className="animate-pulse">
        <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
        <div className="space-y-2">
          <div className="h-10 bg-muted rounded w-full"></div>
          <div className="h-10 bg-muted rounded w-full"></div>
          <div className="h-10 bg-muted rounded w-full"></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Inventory Management</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-center">On Hand</TableHead>
                <TableHead className="text-center">Adjust</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-center">{p.onHand}</TableCell>
                  <TableCell className="text-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => adjust(p.id, -1)} disabled={!canWrite || p.onHand <= 0}>-1</Button>
                    <Button variant="outline" size="sm" onClick={() => adjust(p.id, +1)} disabled={!canWrite}>+1</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
