
import { onCall } from 'firebase-functions/v2/https';

export const transferItems = onCall(async (req) => {
    // TODO: Implement item transfer logic
    console.log('transferItems called with:', req.data);
    return { ok: true, message: 'Not implemented' };
});
