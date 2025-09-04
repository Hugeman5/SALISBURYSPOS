
'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { POSProduct } from '@/types/catalog';
import type { CartLineItem } from '@/types/pos';
import { toast } from '@/hooks/use-toast';
import { splitVat } from '@/utils/money';

// Helper to get the price of a product, preferring effPriceCents over priceCents
const getPriceCents = (p: POSProduct): number => {
  return p.effPriceCents ?? p.priceCents ?? 0;
};

type Stocky = Pick<CartLineItem, 'stockOnHand' | 'trackStock'>;

function availableQty(x: Stocky): number {
  // If not tracking stock, or no numeric value → unlimited
  if (!x.trackStock) return Number.POSITIVE_INFINITY;
  return (typeof x.stockOnHand === 'number') ? x.stockOnHand : Number.POSITIVE_INFINITY;
}

function toCartLineItem(product: POSProduct): CartLineItem {
  return {
    productId: product.id,
    name: product.name,
    qty: 1,
    priceInclCents: getPriceCents(product),
    vatRate: 0.15, // Assuming a standard VAT rate
    // IMPORTANT: normalize null → undefined so the cart type is consistent
    stockOnHand: (typeof product.stockOnHand === 'number')
      ? product.stockOnHand
      : undefined,
    trackStock: !!product.trackStock,
  };
}

interface CartState {
  cart: CartLineItem[];
  totals: {
    subTotalEx: number;
    vat: number;
    totalInc: number;
  };
  addToCart: (product: POSProduct) => void;
  updateQuantity: (productId: string, delta: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
}

const calculateTotals = (cart: CartLineItem[]) => {
  const totalInc = cart.reduce((acc, item) => acc + item.priceInclCents * item.qty, 0);
  const { excl, vat } = splitVat(totalInc);
  return { subTotalEx: excl, vat, totalInc };
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      cart: [],
      totals: { subTotalEx: 0, vat: 0, totalInc: 0 },

      addToCart: (product) => {
        const { cart } = get();
        const existingItem = cart.find((item) => item.productId === product.id);

        let newCart: CartLineItem[];
        if (existingItem) {
          newCart = cart.map((item) =>
            item.productId === product.id ? { ...item, qty: item.qty + 1 } : item
          );
        } else {
          newCart = [
            ...cart,
            toCartLineItem(product)
          ];
        }

        const itemInNewCart = newCart.find(i => i.productId === product.id)!;
        if (itemInNewCart.qty > availableQty(itemInNewCart)) {
            toast({
              variant: "destructive",
              title: "Stock Limit Reached",
              description: `Only ${itemInNewCart.stockOnHand} of ${itemInNewCart.name} available.`,
            });
            return; // Do not update state if stock limit is exceeded
        }

        set({ cart: newCart, totals: calculateTotals(newCart) });
      },

      updateQuantity: (productId, delta) => {
        const { cart } = get();
        const itemToUpdate = cart.find(i => i.productId === productId);
        if (!itemToUpdate) return;
        
        const newQty = itemToUpdate.qty + delta;

        if(newQty > availableQty(itemToUpdate)) {
            toast({
                variant: "destructive",
                title: "Stock Limit Reached",
                description: `Only ${itemToUpdate.stockOnHand} of ${itemToUpdate.name} available.`,
            });
            return;
        }

        let newCart;
        if (newQty <= 0) {
          newCart = cart.filter((item) => item.productId !== productId);
        } else {
          newCart = cart.map((item) =>
            item.productId === productId ? { ...item, qty: newQty } : item
          );
        }
        set({ cart: newCart, totals: calculateTotals(newCart) });
      },

      removeFromCart: (productId) => {
        const newCart = get().cart.filter((item) => item.productId !== productId);
        set({ cart: newCart, totals: calculateTotals(newCart) });
      },
      
      clearCart: () => {
        set({ cart: [], totals: { subTotalEx: 0, vat: 0, totalInc: 0 } });
      },
    }),
    {
      name: 'pos-cart-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
