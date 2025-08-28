import { getApps, initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Reads /home/user/serviceAccount.json via application default creds
    initializeApp({ credential: applicationDefault(), projectId: 'salisburyspos' });
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    initializeApp({
      credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT as string)),
      projectId: 'salisburyspos',
    });
  } else {
    console.warn('Admin credentials missing.');
  }
}

export const adminAuth = getAuth();
export const adminDb = getFirestore();
