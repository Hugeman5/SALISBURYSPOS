import * as admin from 'firebase-admin';
if (!admin.apps.length) admin.initializeApp();

// Menu Management
export { adminUpsertMenuEntities } from './menu/adminUpsertMenuEntities';
export { adminImportMenuCsv } from './menu/adminImportMenuCsv';
export { adminExportMenuCsv } from './menu/adminExportMenuCsv';
export { adminUpsertPriceRules } from './menu/adminUpsertPriceRules';
export { adminSetMenuAvailability } from './menu/adminSetMenuAvailability';

// Storage
export { getSignedUploadUrl } from './storage/getSignedUploadUrl';

// Floor Plans
export { adminUpsertFloorPlan } from './floor/adminUpsertFloorPlan';
export { adminDisableTables } from './floor/adminDisableTables';
export { openTableTab } from './floor/openTableTab';
export { moveTabToTable } from './floor/moveTabToTable';
export { mergeTables } from './floor/mergeTables';
export { closeTableTab } from './floor/closeTableTab';

// Orders & Checks
export { splitCheck } from './orders/splitCheck';
export { mergeChecks } from './orders/mergeChecks';
export { transferItems } from './orders/transferItems';
export { printChecks } from './orders/printChecks';

// Existing Functions
export { adminCloseDay } from './adminCloseDay';
export { adminExportTimeCsv } from './adminExportTimeCsv';
export { cashierRefundItems } from './cashierRefundItems';
export { manageRegisterSession, postCashMovement } from './cash-register';
export { adminUpsertUser, adminDeleteUser, adminSetUserPin } from './users';
export { clockIn, clockOut } from './timeclock';
export { adminPostStockMovement, adminExportLedger } from './inventory';
export { adminBulkImportProducts, adminDeleteProduct, adminExportProducts, adminUpsertProduct } from './products';
export { cashierCreateOrder, cashierSetItems, cashierTakePayment, cashierCloseOrder } from './orders';
