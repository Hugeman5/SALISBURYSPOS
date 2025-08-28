'use client';
import { useState, useMemo } from 'react';
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
import { CartLineItem } from '@/types/pos';
import { fmtZAR, parseToCents } from '@/utils/money';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// Need to install uuid: npm i uuid && npm i --save-dev @types/uuid
// The system will handle this automatically.

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartLineItem[];
  totals: { subtotal: number; tax: number; total: number };
  cashierId: string;
  onSuccess: () => void;
}

export function CheckoutModal({ isOpen, onClose, cart, totals, cashierId, onSuccess }: CheckoutModalProps) {
  const { toast } = useToast();
  const [amountTenderedStr, setAmountTenderedStr] = useState('');
  const [isProcessing, setProcessing] = useState(false);

  const amountTendered = useMemo(() => parseToCents(amountTenderedStr), [amountTenderedStr]);
  const changeDue = useMemo(() => Math.max(0, amountTendered - totals.total), [amountTendered, totals.total]);

  const handleFinalize = async () => {
    if (amountTendered < totals.total) {
      toast({
        variant: 'destructive',
        title: 'Insufficient Amount',
        description: 'Amount tendered is less than the total due.',
      });
      return;
    }

    setProcessing(true);
    
    const payload = {
      clientRequestId: uuidv4(),
      status: 'final',
      registerId: 'REG-01',
      cashierId,
      items: cart.map(item => ({
        productId: item.productId,
        qty: item.qty,
        lineDiscount: item.lineDiscount,
      })),
      payment: {
        method: 'cash',
        amountTendered,
      },
    };

    try {
      const response = await fetch('/api/pos/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }
      
      toast({
        title: "Sale Successful",
        description: `Order #${result.number} created. Change due: ${fmtZAR(changeDue)}`,
      });
      onSuccess();
      onClose();
      setAmountTenderedStr('');

    } catch (error: any) {
      console.error('Failed to finalize order:', error);
      toast({
        variant: 'destructive',
        title: 'Sale Failed',
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Checkout</DialogTitle>
          <DialogDescription>
            Total amount due: <span className="font-bold text-foreground">{fmtZAR(totals.total)}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="amount-tendered" className="text-right">
              Amount Tendered
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
           <div className="text-right text-lg">
            Change Due: <span className="font-bold">{fmtZAR(changeDue)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>Cancel</Button>
          <Button onClick={handleFinalize} disabled={isProcessing}>
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Finalize Sale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
