
import { onCall } from 'firebase-functions/v2/https';

export const adminImportMenuCsv = onCall(async (req) => {
    // TODO: Implement CSV import logic
    console.log('adminImportMenuCsv called with:', req.data);
    return { ok: true, message: 'Not implemented' };
});
