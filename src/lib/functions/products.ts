
import { call } from './call';

export type UpsertProductPayload = {
    id?: string;
    name?: string;
    sku?: string;
    barcode?: string | null;
    categoryName?: string | null;
    trackStock?: boolean;
    priceInc?: number | string;
    costInc?: string | number | null;
    taxRate?: number;
};

export const adminUpsertProduct = (data: UpsertProductPayload) =>
    call<{ ok: true; id: string }, any>('adminUpsertProduct', data);

export const adminDeleteProduct = (data: { id: string }) =>
    call<{ ok: true }, any>('adminDeleteProduct', data);

export const adminExportProducts = (data: {}) =>
    call<{ ok: true, csv: string }, any>('adminExportProducts', data);

export const adminBulkImportProducts = (data: { csv: string }) =>
    call<{ ok: true, imported: number }, any>('adminBulkImportProducts', data);
