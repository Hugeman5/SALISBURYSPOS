import { onCall } from 'firebase-functions/v2/https';

export const getSignedUploadUrl = onCall(async (req) => {
    // TODO: Implement signed URL generation
    console.log('getSignedUploadUrl called with:', req.data);
    return { ok: true, message: 'Not implemented' };
});
