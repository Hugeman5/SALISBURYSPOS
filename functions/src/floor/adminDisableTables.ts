import { onCall } from 'firebase-functions/v2/https';

export const adminDisableTables = onCall(async (req) => {
    // TODO: Implement table disabling logic
    console.log('adminDisableTables called with:', req.data);
    return { ok: true, message: 'Not implemented' };
});
