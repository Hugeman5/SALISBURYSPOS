import {onRequest} from "firebase-functions/https";
import * as logger from "firebase-functions/logger";

export const ping = onRequest((req, res) => {
  logger.info("ping", {method: req.method, path: req.path});
  res.status(200).send("ok");
});

export { adminSetUserPin } from "./users";
export { adminUpsertProduct, adminDeleteProduct, adminExportProducts, adminBulkImportProducts } from "./products";
