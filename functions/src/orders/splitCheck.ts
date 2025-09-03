import { onCall } from 'firebase-functions/v2/https';

export const splitCheck = onCall(async (req) => {
    // TODO: Implement check splitting logic
    console.log('splitCheck called with:', req.data);
    return { ok: true, message: 'Not implemented' };
});
