export type LocationId = string; export type DeviceId = string; export type MenuId = string;
export interface Menu { id: MenuId; name: string; description?: string; order: number; active: boolean; deviceIds?: DeviceId[]; default?: boolean; createdAt: string; updatedAt: string; }
export interface MenuScreen { id: string; menuId: MenuId; name: string; color?: string; order: number; parentScreenId?: string | null; }
export type ButtonType = 'item'|'combo'|'discount'|'instruction'|'order_profile'|'submenu';
export interface MenuButton { id: string; menuId: MenuId; screenId: string; type: ButtonType; refId?: string; label?: string; color?: string; order: number; }
export interface Item { id: string; name: string; sku?: string; plu?: string; categoryId?: string; priceCents: number; taxRate?: number; imageUrl?: string; active: boolean; printerRouteIds?: string[]; tags?: string[]; modifierGroupIds?: string[]; createdAt: string; updatedAt: string; }
export interface ModifierGroup { id: string; name: string; min: number; max: number; items: { id: string; name: string; priceDeltaCents: number; active: boolean }[]; active: boolean; }
export interface Combo { id: string; name: string; priceCents: number; groups: { name: string; required: boolean; min: number; max: number; options: { itemId: string }[] }[]; active: boolean; }
export interface PriceRule { id: string; name: string; type: 'percent_discount'|'percent_surcharge'|'absolute_adjust'; value: number; appliesTo: { itemIds?: string[]; categoryIds?: string[] };
schedule?: { days?: number[]; from?: string; to?: string }; locationIds?: LocationId[]; orderProfileIds?: string[]; active: boolean; }
export interface MenuAvailability { id: string; menuId: MenuId; schedule: { days?: number[]; from?: string; to?: string; dates?: string[] }; devices?: DeviceId[]; locations?: LocationId[]; }


export interface FloorPlan { id: string; locationId: LocationId; name: string; width: number; height: number; imageUrl?: string; orderProfileId?: string; promptCovers?: boolean; receiptPrinterProfileId?: string; draftPrinterProfileId?: string; tables: FloorTable[]; updatedAt: string; }
export type TableShape = 'rect'|'round';
export interface FloorTable { id: string; name: string; refNumber?: string; shape: TableShape; x: number; y: number; w: number; h: number; rotation?: number; seats: number; zone?: string; visible: boolean; }
export interface TableState { id: string; locationId: LocationId; tableId: string; status: 'open'|'occupied'|'dirty'|'reserved'|'merged'|'disabled'; serverUserId?: string; covers?: number; orderId?: string; since?: string; mergedIntoId?: string; updatedAt: string; }