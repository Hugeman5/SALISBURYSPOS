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
export {adminSetUserPin} from "./users";
