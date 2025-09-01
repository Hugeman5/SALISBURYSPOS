
import type { Timestamp } from 'firebase/firestore';

export type Role = 'admin' | 'manager' | 'cashier' | 'waiter' | 'kitchen';

export interface RegisterSession {
  id: string;
  locationId: string;
  userId: string;
  openedAt: string; // ISO
  closedAt?: string; // ISO
  openingFloatCents: number;
  closingFloatCents?: number;
  cashMovementsCents?: number; // manual cash in/out net for the session
  totals?: {
    payments: Record<string, number>; // e.g. { cash: 12345, card: 67890, yoco: 1000 }
    grossSalesCents: number;
    netSalesCents: number; // after discounts/returns
    discountsCents: number;
    returnsCents: number; // positive value represents money returned to customer
    taxCents: number;
  };
  status: 'open' | 'closed';
  createdAt: string;
  updatedAt: string;
}

export interface ZClosure {
  id: string; // z_<YYYY-MM-DD>_<locationId> (idempotent key)
  date: string; // YYYY-MM-DD (store/local tz normalized as agreement)
  locationId: string;
  registerSessionIds: string[];
  paymentTotals: Record<string, number>; // per method
  grossSalesCents: number;
  netSalesCents: number;
  discountsCents: number;
  returnsCents: number;
  taxCents: number;
  cashExpectedCents: number; // opening + cash sales - payouts - refunds
  cashCountedCents: number; // sum of session closingFloatCents
  cashOverShortCents: number; // counted - expected
  generatedByUserId: string;
  generatedAt: string; // ISO
  notes?: string;
}

export interface TimeClockEntry {
  id: string;
  userId: string;
  locationId: string;
  inAt: string; // ISO
  outAt?: string; // ISO
  hourlyRateCents?: number;
  // computed
  minutes?: number;
}

export interface RefundRequestLine {
  lineId: string;
  qty: number;
  reason: 'customer_change' | 'quality' | 'wrong_item' | 'void_error' | 'other';
  note?: string;
}


export interface Product {
  id: string;
  name: string;
  sku: string;
  price: {
    incCents: number;
    taxRate: number;
  };
  stockOnHand?: number;
  trackStock: boolean;
  active: boolean;
}

export interface OrderItem {
  productId: string;
  name: string;
  qty: number;
  priceEx: number;
  vatRate: number;
  lineTotalEx: number;
  vatAmount: number;
  lineTotalInc: number;
  priceInc?: number;
}

export interface Payment {
  type: "cash" | "card";
  amount: number; // in cents
  ref?: string;
  ts: Timestamp;
}

export interface Order {
  id: string;
  status: 'open' | 'paid' | 'void';
  items: OrderItem[];
  totals: {
    subTotalEx: number;
    vat: number;
    totalInc: number;
  };
  payments: Payment[];
  createdAt: Timestamp;
  closedAt?: Timestamp;
  createdBy: string;
  cashierName?: string;
  currency: "ZAR";
  vatRate: number;
  note?: string;
}

export interface CartLineItem {
  productId: string;
  name: string;
  qty: number;
  priceInclCents: number;
  vatRate: number;
  stockOnHand?: number;
  trackStock: boolean;
}

export interface RefundItem {
    productId: string;
    qty: number;
    priceInc: number; // in cents
    name: string;
}

export interface Refund {
    id: string;
    createdAt: Timestamp;
    createdBy: {
        uid: string;
        name: string;
    };
    items: RefundItem[];
    method: 'cash' | 'card';
    originalOrderId: string;
    reason?: string;
    totalRefundAmount: number; // in cents
}
