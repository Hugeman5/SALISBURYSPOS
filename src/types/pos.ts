import type { Timestamp } from 'firebase/firestore';

export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number; // in cents
  taxRate: number; // e.g. 0.15 for 15%
  stockQty: number;
  active: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface OrderItem {
  id: string; // Typically same as productId
  productId: string;
  name: string;
  sku: string;
  unitPrice: number; // cents
  qty: number;
  lineDiscount: number; // cents
  lineTotal: number; // cents, calculated as (unitPrice * qty) - lineDiscount
}

export interface Order {
  id: string;
  number: string; // Human-readable, e.g., S-000001
  status: 'draft' | 'final' | 'void';
  registerId: string;
  cashierId: string;
  subtotal: number; // cents
  tax: number; // cents
  total: number; // cents
  amountTendered?: number; // cents (for cash)
  changeDue?: number; // cents
  lineCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  items?: OrderItem[]; // Often fetched from subcollection
}

export interface CartLineItem {
  productId: string;
  name: string;
  unitPrice: number; // cents
  qty: number;
  lineDiscount: number; // cents
  stockQty: number;
}
