
'use server';
import { onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Export all functions from other files
export * from "./products.js";
export * from "./menu.js";
export * from "./floor.js";
export * from "./users.js";
export * from "./reports.js";
export * from "./orders.js";
export * from "./cash-register.js";
export * from "./timeclock.js";
export * from "./storage.js";

// Optional health check
export const ping = onCall({ cors: true, region: 'us-central1' }, async () => {
  logger.info("ping", { ok: true });
  return { ok: true, ts: Date.now() };
});
