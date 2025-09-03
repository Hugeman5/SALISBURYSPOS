import { onCall } from 'firebase-functions/v2/https';

export const mergeChecks = onCall(async (req) => {
    // TODO: Implement check merging logic
    console.log('mergeChecks called with:', req.data);
    return { ok: true, message: 'Not implemented' };
});
