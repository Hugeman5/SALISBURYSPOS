
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

// Products
export {
  adminUpsertProduct,
  adminDeleteProduct,
  adminExportProducts,
  adminBulkImportProducts,
} from "./products";

// Users
export {adminUpsertUser} from "./users";

// Inventory
export {
  adminPostStockMovement,
  adminExportLedger,
} from "./inventory";

// Orders
export {
  cashierCreateOrder,
  cashierSetItems,
  cashierTakePayment,
  cashierCloseOrder,
} from "./orders";

// Reports
export {adminCloseDay, adminExportZCsv} from "./reports";

export {clockIn, clockOut, adminExportTimeCsv} from "./timeclock";
