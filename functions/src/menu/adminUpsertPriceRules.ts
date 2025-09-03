import { onCall } from 'firebase-functions/v2/https';

export const adminUpsertPriceRules = onCall(async (req) => {
    // TODO: Implement price rule upsert logic
    console.log('adminUpsertPriceRules called with:', req.data);
    return { ok: true, message: 'Not implemented' };
});
