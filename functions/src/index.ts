import * as admin from "firebase-admin";
import { onCall } from "firebase-functions/v2/https";
// use logger from the root package (works in v5)
import { logger } from "firebase-functions";

if (!admin.apps.length) admin.initializeApp();

// Minimal test callable to verify build/deploy
export const ping = onCall({ cors: true }, async (req) => {
  logger.info("ping called", { uid: req.auth?.uid ?? null });
  return { ok: true, ts: Date.now() };
});


// Menu Management
export { adminUpsertMenuEntities } from './menu/adminUpsertMenuEntities.js';
export { adminImportMenuCsv } from './menu/adminImportMenuCsv.js';
export { adminExportMenuCsv } from './menu/adminExportMenuCsv.js';
export { adminUpsertPriceRules } from './menu/adminUpsertPriceRules.js';
export { adminSetMenuAvailability } from './menu/adminSetMenuAvailability.js';

// Storage
export { getSignedUploadUrl } from './storage/getSignedUploadUrl.js';

// Floor Plans
export { adminUpsertFloorPlan } from './floor/adminUpsertFloorPlan.js';
export { adminDisableTables } from './floor/adminDisableTables.js';
export { openTableTab } from './floor/openTableTab.js';
export { moveTabToTable } from './floor/moveTabToTable.js';
export { mergeTables } from './floor/mergeTables.js';
export { closeTableTab } from './floor/closeTableTab.js';

// Orders & Checks
export { splitCheck } from './orders/splitCheck.js';
export { mergeChecks } from './orders/mergeChecks.js';
export { transferItems } from './orders/transferItems.js';
export { printChecks } from './orders/printChecks.js';

// Existing Functions
export { adminCloseDay } from './adminCloseDay.js';
export { adminExportTimeCsv } from './adminExportTimeCsv.js';
export { cashierRefundItems } from './cashierRefundItems.js';
export { manageRegisterSession, postCashMovement } from './cash-register.js';
export { adminUpsertUser, adminDeleteUser, adminSetUserPin } from './users.js';
export { clockIn, clockOut } from './timeclock.js';
export { adminPostStockMovement, adminExportLedger } from './inventory.js';
export { adminBulkImportProducts, adminDeleteProduct, adminExportProducts, adminUpsertProduct } from './products.js';
export { cashierCreateOrder, cashierSetItems, cashierTakePayment, cashierCloseOrder } from './orders.js';
