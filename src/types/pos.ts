import type { Timestamp } from 'firebase/firestore';

export interface Product {
  id: string;
  name: string;
  sku: string;
  price: {
    incCents: number;
    taxRate: number;
  };
  stockOnHand: number;
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
}

export interface Payment {
  type: "cash" | "card";
  amount: number;
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
}
