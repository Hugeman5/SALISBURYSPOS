
import type { Timestamp } from 'firebase/firestore';

export type Role = 'admin'|'manager'|'cashier'|'waiter'|'kitchen';

export type User = {
  id: string;
  name: string;
  role: Role;
  active: boolean;
  avatarUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastSignInAt?: Timestamp;
  email?: string;
  phone?: string;
};

export type Product = {
    id: string;
    name: string;
    nameLower: string;
    sku: string;
    skuUpper: string;
    barcode?: string | null;
    categoryId?: string | null;
    categoryName?: string | null;
    trackStock: boolean;
    price: {
      currency: "ZAR";
      taxRate: number;
      incCents: number;
      exCents: number;
    };
    costIncCents?: number | null;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    stockOnHand?: number;
    active: boolean;
};

export type Category = {
    id: string;
    name: string;
    nameLower: string;
    sort: number;
};

export type MovementType = 'receive' | 'sale' | 'refund' | 'wastage' | 'adjust' | 'set';

export type InventoryLedger = {
  id: string;
  productId: string;
  productSku?: string;
  productName?: string;
  type: MovementType;
  qty: number;
  delta: number;
  before: number;
  after: number;
  note?: string;
  userId: string;
  userName?: string;
  ts: Timestamp;
  clientTxnId?: string;
};
