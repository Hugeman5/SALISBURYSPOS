
'use client';

import { useState, useMemo } from 'react';
import { Order, OrderItem, Refund, RefundItem } from '@/types/pos';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { fmtZAR } from '@/utils/money';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { call } from '@/lib/functions/call';

interface RefundModalProps {
  order: Order;
  existingRefunds: Refund[];
  isOpen: boolean;
  onClose: () => void;
}

type RefundQuantities = { [productId: string]: number };

export function RefundModal({ order, existingRefunds, isOpen, onClose }: RefundModalProps) {
  const [quantities, setQuantities] = useState<RefundQuantities>({});
  const [method, setMethod] = useState<'cash' | 'card'>('cash');
  const [reason, setReason] = useState('');
  const [isProcessing, setProcessing] = useState(false);
  const { toast } = useToast();

  const refundableQuantities = useMemo(() => {
    const refunded: RefundQuantities = {};
    for (const refund of existingRefunds) {
      for (const item of refund.items) {
        refunded[item.productId] = (refunded[item.productId] || 0) + item.qty;
      }
    }
    return order.items.reduce((acc, item) => {
      acc[item.productId] = item.qty - (refunded[item.productId] || 0);
      return acc;
    }, {} as RefundQuantities);
  }, [order, existingRefunds]);

  const handleQtyChange = (productId: string, qtyStr: string) => {
    const maxQty = refundableQuantities[productId] || 0;
    let qty = parseInt(qtyStr, 10);
    if (isNaN(qty)) qty = 0;
    if (qty < 0) qty = 0;
    if (qty > maxQty) qty = maxQty;
    setQuantities(prev => ({ ...prev, [productId]: qty }));
  };

  const { refundItems, total } = useMemo(() => {
    const items: RefundItem[] = [];
    let currentTotal = 0;
    for (const item of order.items) {
      const qtyToRefund = quantities[item.productId] || 0;
      if (qtyToRefund > 0) {
        const priceInc = item.priceInc || Math.round(item.lineTotalInc / item.qty);
        items.push({
          productId: item.productId,
          name: item.name,
          qty: qtyToRefund,
          priceInc: priceInc,
        });
        currentTotal += priceInc * qtyToRefund;
      }
    }
    return { refundItems: items, total: currentTotal };
  }, [quantities, order.items]);

  const handleSubmit = async () => {
    if (refundItems.length === 0) {
      toast({ variant: 'destructive', title: 'No items selected for refund.' });
      return;
    }
    setProcessing(true);
    try {
      await call('cashierRefundItems', {
        originalOrderId: order.id,
        items: refundItems,
        method,
        reason,
      });
      toast({ title: 'Refund processed successfully.' });
      onClose();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Refund Failed', description: error.message });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Issue Refund for Order</DialogTitle>
          <DialogDescription>{order.id.slice(0, 8)}...</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-center">Max Qty</TableHead>
                <TableHead className="w-24">Refund Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map(item => (
                <TableRow key={item.productId}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell className="text-center">{refundableQuantities[item.productId]}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={quantities[item.productId] || ''}
                      onChange={e => handleQtyChange(item.productId, e.target.value)}
                      max={refundableQuantities[item.productId]}
                      min={0}
                      disabled={(refundableQuantities[item.productId] || 0) <= 0}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex justify-between items-center pt-4">
            <div>
              <Label>Refund Method</Label>
              <RadioGroup value={method} onValueChange={(v) => setMethod(v as any)} className="flex gap-4 mt-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="cash" id="cash" />
                  <Label htmlFor="cash">Cash</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="card" id="card" />
                  <Label htmlFor="card">Card</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total Refund</p>
              <p className="text-2xl font-bold">{fmtZAR(total)}</p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isProcessing || total <= 0}>
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
