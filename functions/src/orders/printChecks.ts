import { onCall } from 'firebase-functions/v2/https';

export const printChecks = onCall(async (req) => {
    // TODO: Implement check printing logic
    console.log('printChecks called with:', req.data);
    return { ok: true, message: 'Not implemented' };
});
