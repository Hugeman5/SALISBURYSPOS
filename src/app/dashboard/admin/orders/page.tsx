'use client';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit, where, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/stores/auth-store';
import { fmtZAR } from '@/utils/money';
import { Order } from '@/types/pos';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type OrderStatus = 'open' | 'paid' | 'void';

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<OrderStatus>('paid');
  const profile = useAuth(s => s.profile);

  useEffect(() => {
    async function load() {
      if (!profile) return;
      setLoading(true);
      try {
        const qy = query(
          collection(db, 'orders'), 
          where('status', '==', statusFilter), 
          orderBy('createdAt', 'desc'), 
          limit(50)
        );
        const snap = await getDocs(qy);
        setOrders(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      } catch (error) {
        console.error("Failed to load orders:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [profile, statusFilter]);

  const getStatusVariant = (status: Order['status']) => {
    switch (status) {
      case 'paid': return 'default';
      case 'open': return 'secondary';
      case 'void': return 'destructive';
      default: return 'outline';
    }
  }
  
  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Orders</CardTitle>
              <CardDescription>Showing recent orders.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as OrderStatus)}>
            <TabsList>
              <TabsTrigger value="paid">Paid</TabsTrigger>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="void">Void</TabsTrigger>
            </TabsList>
            <TabsContent value={statusFilter}>
              {loading ? (
                <div className="space-y-3 pt-4">
                  <div className="h-16 bg-muted rounded-md animate-pulse"></div>
                  <div className="h-16 bg-muted rounded-md animate-pulse"></div>
                  <div className="h-16 bg-muted rounded-md animate-pulse"></div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.length > 0 ? (
                      orders.map(o => (
                        <TableRow key={o.id}>
                          <TableCell>
                            {o.createdAt?.toDate ? format(o.createdAt.toDate(), 'PPpp') : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusVariant(o.status)}>{o.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">{fmtZAR(o.totals.totalInc)}</TableCell>
                          <TableCell className="text-right">{o.items.length}</TableCell>
                          <TableCell>{o.createdBy}</TableCell>
                          <TableCell className="text-right">
                             <Button asChild variant="outline" size="sm">
                                <Link href={`/pos/orders/${o.id}`}>View</Link>
                             </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                          No {statusFilter} orders found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
