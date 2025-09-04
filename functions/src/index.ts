// functions/src/index.ts
import { onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";

// Import side-effect-free utils (it initializes the app)
import { db } from "./utils.js";

export * from "./products.js";

// Optional health check
export const ping = onCall({ cors: true }, async () => {
  // prove db is usable
  logger.info("ping", { ok: true });
  return { ok: true, ts: Date.now() };
});
