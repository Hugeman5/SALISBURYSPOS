// src/lib/firebase-admin.ts
import { getApps, initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'salisburyspos';

function init() {
  if (getApps().length) return;
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)), projectId: PROJECT_ID });
  } else {
    console.warn('[admin] No credentials found. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT');
    initializeApp({ projectId: PROJECT_ID }); // still allows emulators/local metadata service
  }
}
init();

export const adminAuth = getAuth();
export const adminDb = getFirestore();
