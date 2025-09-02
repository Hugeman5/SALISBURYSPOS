
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

// Floor Plan Management
export { adminUpsertFloorPlan } from './floor/adminUpsertFloorPlan';
export { adminDisableTables } from './floor/adminDisableTables';
export { openTableTab } from './floor/openTableTab';
export { moveTabToTable } from './floor/moveTabToTable';
export { mergeTables } from './floor/mergeTables';
export { closeTableTab } from './floor/closeTableTab';

// Order & Check Management
export { splitCheck } from './orders/splitCheck';
export { mergeChecks } from './orders/mergeChecks';
export { transferItems } from './orders/transferItems';
export { printChecks } from './orders/printChecks';

// Note: Legacy functions from the old structure are not exported here.
// This file should only contain exports from the new modular source files.
