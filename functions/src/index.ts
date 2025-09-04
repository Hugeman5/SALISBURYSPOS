
import { initializeApp } from "firebase-admin/app";
import { onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";

initializeApp();

// Minimal test callable to verify build/deploy
export const ping = onCall({ cors: true }, async (req) => {
  logger.info("ping called", { uid: req.auth?.uid ?? null });
  return { ok: true, ts: Date.now() };
});


// Menu Management
export * from "./menu/adminExportMenuCsv.js";
export * from "./menu/adminImportMenuCsv.js";
export * from "./menu/adminSetMenuAvailability.js";
export * from "./menu/adminUpsertMenuEntities.js";
export * from "./menu/adminUpsertPriceRules.js";

// Storage
export * from './storage/getSignedUploadUrl.js';

// Floor Plans
export * from './floor/adminDisableTables.js';
export * from './floor/adminUpsertFloorPlan.js';
export * from './floor/closeTableTab.js';
export * from './floor/mergeTables.js';
export * from './floor/moveTabToTable.js';
export * from './floor/openTableTab.js';

// Orders & Checks
export * from './orders/splitCheck.js';
export * from './orders/mergeChecks.js';
export * from './orders/transferItems.js';
export * from './orders/printChecks.js';

// Existing Functions
export * from './reports.js';
export * from './timeclock.js';
export * from './orders.js';
export * from './cash-register.js';
export * from './users.js';
export * from './inventory.js';
export * from './products.js';
