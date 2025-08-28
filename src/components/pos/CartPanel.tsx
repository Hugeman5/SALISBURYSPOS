'use client';
import { useMemo, useState } from 'react';
import { CartLineItem } from '@/types/pos';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Trash2, Minus, Plus } from 'lucide-react';
import { fmtZAR } from '@/utils/money';
import { CheckoutModal } from './CheckoutModal';
import { useToast } from '@/hooks/use-toast';

interface CartPanelProps {
  cart: CartLineItem[];
  setCart: React.Dispatch<React.SetStateAction<CartLineItem[]>>;
  cashierId: string;
}

export function CartPanel({ cart, setCart, cashierId }: CartPanelProps) {
  const { toast } = useToast();
  const [isCheckoutOpen, setCheckoutOpen] = useState(false);

  const updateQuantity = (productId: string, delta: number) => {
    setCart(currentCart => {
      const item = currentCart.find(i => i.productId === productId);
      if (!item) return currentCart;

      const newQty = item.qty + delta;
      
      if (newQty > item.stockQty) {
        toast({
            variant: "destructive",
            title: "Stock Limit Reached",
            description: `Only ${item.stockQty} of ${item.name} available.`,
        });
        return currentCart;
      }

      if (newQty <= 0) {
        return currentCart.filter(i => i.productId !== productId);
      }
      return currentCart.map(i => i.productId === productId ? { ...i, qty: newQty } : i);
    });
  };

  const totals = useMemo(() => {
    const subtotal = cart.reduce((acc, item) => acc + (item.unitPrice * item.qty) - item.lineDiscount, 0);
    // Assuming prices are VAT inclusive
    const tax = Math.round(subtotal * (0.15 / 1.15));
    return { subtotal, tax, total: subtotal };
  }, [cart]);

  const handleFinalizeSale = () => {
    if (cart.length === 0) {
        toast({
            variant: "destructive",
            title: "Empty Cart",
            description: "Add products to the cart before proceeding to payment.",
        });
        return;
    }
    setCheckoutOpen(true);
  };

  return (
    <>
      <div className="flex flex-col h-full p-4">
        <h2 className="text-lg font-semibold mb-4">Current Sale</h2>
        <ScrollArea className="flex-grow">
          {cart.length === 0 ? (
            <div className="text-center text-muted-foreground pt-20">Cart is empty</div>
          ) : (
            <div className="space-y-4 pr-4">
              {cart.map(item => (
                <div key={item.productId} className="flex items-center">
                  <div className="flex-grow">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">{fmtZAR(item.unitPrice)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.productId, -1)}><Minus className="h-3 w-3"/></Button>
                    <span>{item.qty}</span>
                    <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.productId, 1)}><Plus className="h-3 w-3"/></Button>
                  </div>
                  <div className="w-20 text-right font-medium">
                    {fmtZAR(item.unitPrice * item.qty)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="pt-4 border-t mt-auto">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{fmtZAR(totals.subtotal - totals.tax)}</span></div>
            <div className="flex justify-between"><span>Tax (15%)</span><span>{fmtZAR(totals.tax)}</span></div>
            <Separator/>
            <div className="flex justify-between font-bold text-lg"><span>Total</span><span>{fmtZAR(totals.total)}</span></div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <Button variant="outline" onClick={() => setCart([])} disabled={cart.length === 0}>
                <Trash2 className="mr-2 h-4 w-4"/> Clear
            </Button>
            <Button size="lg" onClick={handleFinalizeSale} disabled={cart.length === 0}>Pay</Button>
          </div>
        </div>
      </div>
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setCheckoutOpen(false)}
        cart={cart}
        totals={totals}
        cashierId={cashierId}
        onSuccess={() => setCart([])}
      />
    </>
  );
}
