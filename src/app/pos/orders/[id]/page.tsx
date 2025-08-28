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

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
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

        const itemsRef = collection(db, 'orders', params.id, 'items');
        const itemsSnap = await getDocs(itemsRef);
        const itemsData = itemsSnap.docs.map(doc => doc.data() as OrderItem);
        setItems(itemsData);

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
          <CardTitle>Order {order.number}</CardTitle>
          <CardDescription>
            {format(order.createdAt.toDate(), 'PPpp')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="text-sm text-muted-foreground">
              <p>Status: <span className="font-medium text-foreground capitalize">{order.status}</span></p>
              <p>Cashier ID: {order.cashierId}</p>
              <p>Register ID: {order.registerId}</p>
            </div>
            <Separator />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.productId}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="text-center">{item.qty}</TableCell>
                    <TableCell className="text-right">{fmtZAR(item.unitPrice)}</TableCell>
                    <TableCell className="text-right">{fmtZAR(item.lineTotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Separator />
             <div className="space-y-2 text-right">
                <div className="grid grid-cols-2">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>{fmtZAR(order.subtotal - order.tax)}</span>
                </div>
                <div className="grid grid-cols-2">
                    <span className="text-muted-foreground">Tax (15%):</span>
                    <span>{fmtZAR(order.tax)}</span>
                </div>
                 <div className="grid grid-cols-2 font-bold text-lg">
                    <span>Total:</span>
                    <span>{fmtZAR(order.total)}</span>
                </div>
             </div>
             {order.status === 'final' && order.amountTendered && (
                <>
                <Separator/>
                <div className="space-y-2 text-right">
                    <div className="grid grid-cols-2">
                        <span className="text-muted-foreground">Amount Tendered:</span>
                        <span>{fmtZAR(order.amountTendered)}</span>
                    </div>
                    <div className="grid grid-cols-2">
                        <span className="text-muted-foreground">Change Due:</span>
                        <span>{fmtZAR(order.changeDue ?? 0)}</span>
                    </div>
                </div>
                </>
             )}
          </div>
        </CardContent>
        <CardFooter className="text-center text-muted-foreground text-xs">
          Thank you for your purchase!
        </CardFooter>
      </Card>
    </div>
  );
}
