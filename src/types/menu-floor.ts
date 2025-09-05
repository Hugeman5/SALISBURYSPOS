// types/menu-floor.ts

// Common Identifiers
export type LocationId = string;
export type DeviceId = string;
export type MenuId = string;
export type Id = string;

// Menu Configuration
export interface Menu {
  id: MenuId;
  name: string;
  description?: string;
  order: number;
  active: boolean;
  deviceIds?: DeviceId[];
  default?: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface MenuScreen {
  id: string;
  menuId: MenuId;
  name: string;
  color?: string;
  order: number;
  parentScreenId?: string | null;
  createdAt: any; 
  updatedAt: any;
}

export type ButtonType = 'item'|'combo'|'discount'|'instruction'|'order_profile'|'submenu'|'category';

export interface MenuButton {
  id: string;
  menuId: MenuId;
  screenId: string;
  type: ButtonType;
  refId?: string; // e.g., item ID, combo ID, screen ID for submenu
  label?: string;
  color?: string;
  order: number;
  width?: number; 
  height?: number;
  createdAt: any; 
  updatedAt: any;
}

export interface Category {
  id: Id;
  name: string;
  parentId?: Id | null;
  order: number;
  active: boolean;
  createdAt: any; 
  updatedAt: any;
}

// Menu Entities
export interface Item {
  id: string;
  name: string;
  sku?: string;
  plu?: string;
  categoryId?: string;
  priceCents: number;
  taxRate?: number;
  imageUrl?: string;
  active: boolean;
  printerRouteIds?: string[];
  tags?: string[];
  modifierGroupIds?: string[];
  trackStock?: boolean;
  stockOnHand?: number | null;
  costCents?: number;
  unit?: string;
  createdAt: any;
  updatedAt: any;
}

export interface ModifierGroup {
  id: string;
  name: string;
  min: number;
  max: number;
  items: {
    id: string;
    name: string;
    priceDeltaCents: number;
    active: boolean;
  }[];
  active: boolean;
  createdAt: any; 
  updatedAt: any;
}

export interface Combo {
  id: string;
  name: string;
  priceCents: number;
  groups: {
    name: string;
    required: boolean;
    min: number;
    max: number;
    options: { itemId: string }[];
  }[];
  active: boolean;
  createdAt: any; 
  updatedAt: any;
}

// Pricing and Availability
export interface PriceRule {
  id: Id;
  name: string;
  appliesTo: { itemIds?: Id[]; categoryIds?: Id[] };
  type: 'percentOff' | 'fixedPrice' | 'amountOff';
  value: number; // e.g., 20 (percent) or 1000 (cents)
  start?: string; end?: string; // ISO local time windows
  days?: number[];             // 0-6
  createdAt: any; updatedAt: any;
}

export interface MenuAvailability {
  id: Id;
  menuId: Id;
  days?: number[];             // 0-6
  start?: string; end?: string;// 'HH:mm'
  deviceIds?: string[];
  locationIds?: string[];
  createdAt: any; updatedAt: any;
  active: boolean;
}

// Floor Plans & Table State
export interface FloorPlan {
  id: string;
  locationId: LocationId;
  name: string;
  width: number;
  height: number;
  imageUrl?: string;
  orderProfileId?: string;
  promptCovers?: boolean;
  receiptPrinterProfileId?: string;
  draftPrinterProfileId?: string;
  tables: FloorTable[];
  updatedAt: string;
}

export type TableShape = 'rect' | 'round';

export interface FloorTable {
  id: string;
  name: string;
  refNumber?: string;
  shape: TableShape;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  seats: number;
  zone?: string;
  visible: boolean;
}

export interface TableState {
  id: string;
  locationId: LocationId;
  tableId: string;
  status: 'open' | 'occupied' | 'dirty' | 'reserved' | 'merged' | 'disabled';
  serverUserId?: string;
  covers?: number;
  orderId?: string;
  since?: string; // ISO timer start
  mergedIntoId?: string;
  updatedAt: string;
}
