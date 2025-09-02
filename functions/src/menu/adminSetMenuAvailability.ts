
import { onCall } from 'firebase-functions/v2/https';

export const adminSetMenuAvailability = onCall(async (req) => {
    // TODO: Implement menu availability logic
    console.log('adminSetMenuAvailability called with:', req.data);
    return { ok: true, message: 'Not implemented' };
});
