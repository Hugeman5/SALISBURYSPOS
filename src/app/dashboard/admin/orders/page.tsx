
'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit, where, Timestamp, onSnapshot } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/stores/auth-store';
import { fmtZAR } from '@/utils/money';
import { Order, Refund } from '@/types/pos';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OrderDetailsDrawer } from '@/components/admin/orders/OrderDetailsDrawer';

type OrderStatus = 'paid' | 'open' | 'void';

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<OrderStatus>('paid');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [refunds, setRefunds] = useState<Map<string, Refund[]>>(new Map());

  const fetchOrders = useCallback(() => {
    setLoading(true);
    const qy = query(
      collection(db, 'orders'),
      where('status', '==', statusFilter),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubscribe = onSnapshot(qy, (snap) => {
      const newOrders = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      setOrders(newOrders);
      setLoading(false);
    }, (error) => {
      console.error("Failed to load orders:", error);
      setLoading(false);
    });
    return unsubscribe;
  }, [statusFilter]);

  useEffect(() => {
    const unsubscribe = fetchOrders();
    return () => unsubscribe();
  }, [fetchOrders]);

  useEffect(() => {
    if (!selectedOrder) return;
    const qy = query(
      collection(db, `orders/${selectedOrder.id}/refunds`),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(qy, (snap) => {
      const orderRefunds = snap.docs.map(d => ({ id: d.id, ...d.data() } as Refund));
      setRefunds(prev => new Map(prev).set(selectedOrder.id, orderRefunds));
    });
    return () => unsubscribe();
  }, [selectedOrder]);

  const getStatusVariant = (status: Order['status']) => {
    switch (status) {
      case 'paid': return 'default';
      case 'open': return 'secondary';
      case 'void': return 'destructive';
      default: return 'outline';
    }
  };

  const totalRefunded = (orderId: string) => {
    const orderRefunds = refunds.get(orderId) || [];
    return orderRefunds.reduce((sum, refund) => sum + refund.totalRefundAmount, 0);
  };

  return (
    <>
      <div className="p-6 space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Orders</CardTitle>
                <CardDescription>View recent orders and process refunds.</CardDescription>
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
                        <TableHead className="text-right">Refunds</TableHead>
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
                            <TableCell className="text-right font-mono text-destructive">
                                {totalRefunded(o.id) > 0 ? `-${fmtZAR(totalRefunded(o.id))}` : '—'}
                            </TableCell>
                            <TableCell>{o.cashierName}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm" onClick={() => setSelectedOrder(o)}>
                                Details
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
      {selectedOrder && (
        <OrderDetailsDrawer
            order={selectedOrder}
            refunds={refunds.get(selectedOrder.id) || []}
            isOpen={!!selectedOrder}
            onClose={() => setSelectedOrder(null)}
        />
      )}
    </>
  );
}
