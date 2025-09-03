
import type { Timestamp } from 'firebase/firestore';

export type Role = 'admin' | 'manager' | 'cashier' | 'waiter' | 'kitchen';
export type LocationId = string;
export type DeviceId = string;

// POS & Day End
export interface RegisterSession {
  id: string;
  locationId: string;
  userId: string;
  openedAt: string; // ISO
  closedAt?: string; // ISO
  openingFloatCents: number;
  closingFloatCents?: number;
  cashMovementsCents?: number;
  totals?: {
    payments: Record<string, number>;
    grossSalesCents: number;
    netSalesCents: number;
    discountsCents: number;
    returnsCents: number;
    taxCents: number;
  };
  status: 'open' | 'closed';
  createdAt: string;
  updatedAt: string;
}

export interface ZClosure {
  id: string;
  date: string;
  locationId: string;
  registerSessionIds: string[];
  paymentTotals: Record<string, number>;
  grossSalesCents: number;
  netSalesCents: number;
  discountsCents: number;
  returnsCents: number;
  taxCents: number;
  cashExpectedCents: number;
  cashCountedCents: number;
  cashOverShortCents: number;
  generatedByUserId: string;
  generatedAt: string;
  notes?: string;
}

// Time Clock
export interface TimeClockEntry {
  id: string;
  userId: string;
  locationId: string;
  inAt: string; // ISO
  outAt?: string; // ISO
  hourlyRateCents?: number;
  minutes?: number;
}

// Orders, Refunds, Payments
export interface RefundRequestLine {
  lineId: string;
  qty: number;
  reason: 'customer_change' | 'quality' | 'wrong_item' | 'void_error' | 'other';
  note?: string;
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
  type: 'cash' | 'card';
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
  cashierName?: string;
  currency: 'ZAR';
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
  priceInc: number;
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
  totalRefundAmount: number;
}

// Menu Builder
export type MenuId = string;
export interface Menu { id: MenuId; name: string; description?: string; order: number; active: boolean; deviceIds?: DeviceId[]; default?: boolean; createdAt: string; updatedAt: string; }
export interface MenuScreen { id: string; menuId: MenuId; name: string; color?: string; order: number; parentScreenId?: string | null; }
export interface MenuButton { id: string; menuId: MenuId; screenId: string; type: 'item'|'combo'|'discount'|'instruction'|'order_profile'|'submenu'; refId?: string; label?: string; color?: string; order: number; }
export interface Item { id: string; name: string; sku?: string; plu?: string; categoryId: string; priceCents: number; taxRate: number; imageUrl?: string; active: boolean; printerRouteIds?: string[]; tags?: string[]; modifierGroupIds?: string[]; createdAt: string; updatedAt: string; }
export interface ModifierGroup { id: string; name: string; min: number; max: number; items: { id: string; name: string; priceDeltaCents: number; active: boolean }[]; active: boolean; }
export interface Combo { id: string; name: string; priceCents: number; groups: { name: string; required: boolean; min: number; max: number; options: { itemId: string }[] }[]; active: boolean; }
export interface PriceRule { id: string; name: string; type: 'percent_discount'|'percent_surcharge'|'absolute_adjust'; value: number; appliesTo: { itemIds?: string[]; categoryIds?: string[] };
  schedule?: { days?: number[]; from?: string; to?: string }; locationIds?: string[]; orderProfileIds?: string[]; active: boolean; }
export interface MenuAvailability { id: string; menuId: MenuId; schedule: { days?: number[]; from?: string; to?: string; dates?: string[] }; devices?: DeviceId[]; locations?: LocationId[]; }

// Floor Plan
export interface FloorPlan { id: string; locationId: LocationId; name: string; width: number; height: number; imageUrl?: string; orderProfileId?: string; promptCovers?: boolean; receiptPrinterProfileId?: string; draftPrinterProfileId?: string; tables: FloorTable[]; updatedAt: string; }
export type TableShape = 'rect'|'round';
export interface FloorTable { id: string; name: string; refNumber?: string;
  shape: TableShape; x: number; y: number; w: number; h: number; rotation?: number; seats: number; zone?: string; visible: boolean; }
export interface TableState { id: string; locationId: LocationId; tableId: string; status: 'open'|'occupied'|'dirty'|'reserved'|'merged'|'disabled'; serverUserId?: string; covers?: number; orderId?: string; since?: string;
  mergedIntoId?: string; updatedAt: string; }
