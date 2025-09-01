
import * as admin from 'firebase-admin';
if (!admin.apps.length) admin.initializeApp();

// Products and Inventory Management
export {
  adminUpsertProduct,
  adminDeleteProduct,
  adminExportProducts,
  adminBulkImportProducts,
} from "./products";
export {
  adminPostStockMovement,
  adminExportLedger,
} from "./inventory";

// User and Authentication Management
export {
  adminUpsertUser,
  adminDeleteUser,
  adminSetUserPin,
} from "./users";

// Order Processing
export {
  cashierCreateOrder,
  cashierSetItems,
  cashierTakePayment,
  cashierCloseOrder,
  cashierRefundItems,
} from "./orders";

// Reporting
export { adminCloseDay } from './adminCloseDay';
export { adminExportZCsv } from "./reports";
export { adminExportTimeCsv } from './adminExportTimeCsv';

// Employee Time Clock
export {
  clockIn,
  clockOut,
} from "./timeclock";

// Cash Register Management
export {
  manageRegisterSession,
  postCashMovement,
} from "./cash-register";

// Menu Builder
export { adminUpsertMenu } from './adminUpsertMenu';
export { adminExportMenuCsv } from './adminExportMenuCsv';

// Floor Plan & Table Management
export { adminUpsertFloorPlan } from './adminUpsertFloorPlan';
export { openTableTab } from './openTableTab';
export { moveTabToTable } from './moveTabToTable';
export { mergeTables } from './mergeTables';
export { closeTableTab } from './closeTableTab';
