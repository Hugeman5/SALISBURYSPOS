
import type { Timestamp } from 'firebase/firestore';

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
