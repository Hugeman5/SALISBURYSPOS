
'use client';
import { useState, useMemo } from 'react';
import { Order, Refund, OrderItem } from '@/types/pos';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { fmtZAR } from '@/utils/money';
import { format } from 'date-fns';
import { RefundModal } from './RefundModal';

interface OrderDetailsDrawerProps {
  order: Order | null;
  refunds: Refund[];
  isOpen: boolean;
  onClose: () => void;
}

export function OrderDetailsDrawer({ order, refunds, isOpen, onClose }: OrderDetailsDrawerProps) {
  const [isRefundModalOpen, setRefundModalOpen] = useState(false);

  const totalRefunded = useMemo(() => {
    return refunds.reduce((sum, refund) => sum + refund.totalRefundAmount, 0);
  }, [refunds]);

  if (!order) return null;

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="w-full sm:w-[540px]">
          <SheetHeader>
            <SheetTitle>Order Details</SheetTitle>
            <SheetDescription>
              ID: {order.id.slice(0, 8)}... | {order.createdAt ? format(order.createdAt.toDate(), 'PPpp') : ''}
            </SheetDescription>
          </SheetHeader>
          <div className="py-4 space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Items</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.productId}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell className="text-center">{item.qty}</TableCell>
                      <TableCell className="text-right">{fmtZAR(item.lineTotalInc)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            <Separator />

            <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal (ex VAT):</span>
                    <span>{fmtZAR(order.totals.subTotalEx)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">VAT ({order.vatRate * 100}%):</span>
                    <span>{fmtZAR(order.totals.vat)}</span>
                </div>
                 <div className="flex justify-between font-bold text-base">
                    <span>Total:</span>
                    <span>{fmtZAR(order.totals.totalInc)}</span>
                </div>
            </div>

            <Separator />
            
             <div>
              <h3 className="font-semibold mb-2">Payments</h3>
              {order.payments.map((p, i) => (
                <div key={i} className="flex justify-between text-sm">
                    <span className="capitalize">{p.type}</span>
                    <span>{fmtZAR(p.amount)}</span>
                </div>
              ))}
            </div>

            {refunds.length > 0 && (
                <>
                <Separator/>
                 <div>
                  <h3 className="font-semibold mb-2 text-destructive">Refunds</h3>
                   {refunds.map((refund) => (
                    <div key={refund.id} className="flex justify-between text-sm">
                        <span className="capitalize text-muted-foreground">{format(refund.createdAt.toDate(), 'P p')}</span>
                        <span className="text-destructive">-{fmtZAR(refund.totalRefundAmount)}</span>
                    </div>
                  ))}
                   <div className="flex justify-between font-bold text-sm mt-1">
                        <span>Total Refunded</span>
                        <span className="text-destructive">-{fmtZAR(totalRefunded)}</span>
                    </div>
                </div>
                </>
            )}

          </div>
          <SheetFooter>
            <Button variant="outline" onClick={onClose}>Close</Button>
            {order.status === 'paid' && (
                <Button onClick={() => setRefundModalOpen(true)}>Issue Refund</Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
      {isRefundModalOpen && (
          <RefundModal
            order={order}
            existingRefunds={refunds}
            isOpen={isRefundModalOpen}
            onClose={() => setRefundModalOpen(false)}
          />
      )}
    </>
  );
}
