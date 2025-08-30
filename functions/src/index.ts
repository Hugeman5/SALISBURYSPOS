/**
 * @fileoverview Main entry point for all Firebase Cloud Functions.
 * This file exports all the callable functions, making them available to clients.
 */

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
} from "./orders";

// Reporting
export {
  adminCloseDay,
  adminExportZCsv,
} from "./reports";

// Employee Time Clock
export {
  clockIn,
  clockOut,
  adminExportTimeCsv,
} from "./timeclock";

// Cash Register Management
export {
  manageRegisterSession,
  postCashMovement,
} from "./cash-register";
