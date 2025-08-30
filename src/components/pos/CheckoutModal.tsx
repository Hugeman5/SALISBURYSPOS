
'use client';
import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCartStore } from '@/stores/cart-store';
import type { Payment } from '@/types/pos';
import { fmtZAR, parseToCents } from '@/utils/money';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { call } from '@/lib/functions/call';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cashierId: string;
  cashierName: string;
}

type PaymentType = Payment['type'];

export function CheckoutModal({ isOpen, onClose, cashierId, cashierName }: CheckoutModalProps) {
  const { toast } = useToast();
  const { cart, totals, clearCart } = useCartStore();
  const [amountTenderedStr, setAmountTenderedStr] = useState('');
  const [isProcessing, setProcessing] = useState(false);
  const [completedOrderId, setCompletedOrderId] = useState<string | null>(null);

  const amountTendered = useMemo(() => parseToCents(amountTenderedStr), [amountTenderedStr]);
  const changeDue = useMemo(() => Math.max(0, amountTendered - totals.totalInc), [amountTendered, totals.totalInc]);
  
  // Auto-fill tendered amount when modal opens for convenience
  useEffect(() => {
    if (isOpen) {
      setAmountTenderedStr((totals.totalInc / 100).toFixed(2));
    }
  }, [isOpen, totals.totalInc]);
  
  const handleClose = () => {
    setAmountTenderedStr('');
    setCompletedOrderId(null);
    setProcessing(false);
    onClose();
  }

  const handleFinalize = async (type: PaymentType) => {
    const finalAmount = type === 'card' ? totals.totalInc : amountTendered;

    if (finalAmount < totals.totalInc) {
      toast({
        variant: 'destructive',
        title: 'Insufficient Amount',
        description: 'Amount tendered is less than the total due.',
      });
      return;
    }

    setProcessing(true);
    
    try {
      const { orderId: newOrderId } = await call('cashierCreateOrder', { note: '' });
      if (!newOrderId) throw new Error("Failed to create order.");

      await call('cashierSetItems', { 
        orderId: newOrderId,
        items: cart.map(item => ({ productId: item.productId, qty: item.qty })) 
      });

      await call('cashierTakePayment', {
        orderId: newOrderId,
        type,
        amount: finalAmount
      });
      
      await call('cashierCloseOrder', { orderId: newOrderId });

      toast({
        title: "Sale Successful",
        description: type === 'cash' ? `Change due: ${fmtZAR(changeDue)}` : 'Payment complete.',
      });
      
      clearCart();
      setCompletedOrderId(newOrderId);

    } catch (error: any) {
      console.error('Failed to finalize order:', error);
      toast({
        variant: 'destructive',
        title: 'Sale Failed',
        description: error.message || 'An unexpected error occurred.',
      });
      setProcessing(false);
    }
  };

  const handleExactCash = () => {
    setAmountTenderedStr((totals.totalInc / 100).toFixed(2));
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent onPointerDownOutside={(e) => { if (isProcessing) e.preventDefault() }}>
        {completedOrderId ? (
            <>
                 <DialogHeader>
                    <DialogTitle>Sale Complete</DialogTitle>
                    <DialogDescription>
                        Change due: <span className="font-bold text-foreground">{fmtZAR(changeDue)}</span>
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 flex justify-center">
                    <Button asChild size="lg">
                        <Link href={`/pos/orders/${completedOrderId}?print=true`} target="_blank">
                            View & Print Receipt
                        </Link>
                    </Button>
                </div>
                <DialogFooter>
                    <Button onClick={handleClose}>New Sale</Button>
                </DialogFooter>
            </>
        ) : (
            <>
                <DialogHeader>
                <DialogTitle>Checkout</DialogTitle>
                <DialogDescription>
                    Total amount due: <span className="font-bold text-foreground">{fmtZAR(totals.totalInc)}</span>
                </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="amount-tendered" className="text-right">
                      Cash Tendered
                      </Label>
                      <Input
                      id="amount-tendered"
                      value={amountTenderedStr}
                      onChange={(e) => setAmountTenderedStr(e.target.value)}
                      className="col-span-3"
                      type="number"
                      placeholder="e.g., 500.00"
                      autoFocus
                      />
                  </div>
                  <div className="text-right">
                    <Button variant="link" size="sm" onClick={handleExactCash}>Exact Cash</Button>
                  </div>
                  <div className="text-right text-lg">
                      Change Due: <span className="font-bold">{fmtZAR(changeDue)}</span>
                  </div>
                </div>
                <DialogFooter className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" size="lg" onClick={() => handleFinalize('card')} disabled={isProcessing}>
                      {isProcessing ? <Loader2 className="animate-spin" /> : 'Pay by Card'}
                  </Button>
                  <Button size="lg" onClick={() => handleFinalize('cash')} disabled={isProcessing}>
                      {isProcessing ? <Loader2 className="animate-spin" /> : 'Finalize Cash Sale'}
                  </Button>
                </DialogFooter>
            </>
        )}
      </DialogContent>
    </Dialog>
  );
}
