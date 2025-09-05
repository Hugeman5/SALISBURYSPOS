import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { storage } from './utils.js';
import { requireRole, ADMIN_ROLES } from './roles.js';

export const getSignedUploadUrl = onCall({ cors: true, region: 'us-central1' }, async (req) => {
    requireRole(req, ADMIN_ROLES);
    const { path } = req.data;
    if (!path || typeof path !== 'string') {
        throw new HttpsError('invalid-argument', 'A storage path is required.');
    }

    const file = storage.bucket().file(path);
    const options = {
        version: 'v4' as const,
        action: 'write' as const,
        expires: Date.now() + 10 * 60 * 1000, // 10 minutes
    };

    const [url] = await file.getSignedUrl(options);
    return { ok: true, url };
});
