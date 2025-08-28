
'use client';
import { useEffect, useState } from 'react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Order, OrderItem } from '@/types/pos';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { fmtZAR } from '@/utils/money';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const orderRef = doc(db, 'orders', params.id);
        const orderSnap = await getDoc(orderRef);

        if (!orderSnap.exists()) {
          setError('Order not found.');
          return;
        }
        
        const orderData = { id: orderSnap.id, ...orderSnap.data() } as Order;
        setOrder(orderData);
      } catch (err) {
        setError('Failed to fetch order details.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [params.id]);

  if (loading) return <div className="p-6 text-center">Loading order details...</div>;
  if (error) return <div className="p-6 text-center text-destructive">{error}</div>;
  if (!order) return null;

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Order Details</CardTitle>
              <CardDescription>
                {order.createdAt ? format(order.createdAt.toDate(), 'PPpp') : ''}
              </CardDescription>
            </div>
            <Badge variant={order.status === 'paid' ? 'default' : 'destructive'} className="capitalize">{order.status}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="text-sm text-muted-foreground">
              <p>Order ID: {order.id}</p>
              <p>Created By: {order.createdBy}</p>
            </div>
            <Separator />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Price (inc)</TableHead>
                  <TableHead className="text-right">Total (inc)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item, index) => (
                  <TableRow key={item.productId + index}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="text-center">{item.qty}</TableCell>
                    <TableCell className="text-right">{fmtZAR(item.lineTotalInc / item.qty)}</TableCell>
                    <TableCell className="text-right">{fmtZAR(item.lineTotalInc)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Separator />
             <div className="space-y-2 text-right">
                <div className="grid grid-cols-2">
                    <span className="text-muted-foreground">Subtotal (ex VAT):</span>
                    <span>{fmtZAR(order.totals.subTotalEx)}</span>
                </div>
                <div className="grid grid-cols-2">
                    <span className="text-muted-foreground">VAT ({order.vatRate * 100}%):</span>
                    <span>{fmtZAR(order.totals.vat)}</span>
                </div>
                 <div className="grid grid-cols-2 font-bold text-lg">
                    <span>Total:</span>
                    <span>{fmtZAR(order.totals.totalInc)}</span>
                </div>
             </div>
             {order.status === 'paid' && order.payments.length > 0 && (
                <>
                <Separator/>
                <div className="space-y-2 text-right">
                    <div className="grid grid-cols-2">
                        <span className="text-muted-foreground">Amount Tendered:</span>
                        <span>{fmtZAR(order.payments.reduce((sum, p) => sum + p.amount, 0))}</span>
                    </div>
                </div>
                </>
             )}
          </div>
        </CardContent>
        <CardFooter className="text-center text-muted-foreground text-xs">
          Thank you!
        </CardFooter>
      </Card>
    </div>
  );
}
