import { getApps, initializeApp, applicationDefault, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'salisburyspos';

function initAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const gac    = process.env.GOOGLE_APPLICATION_CREDENTIALS; // file path
  const b64    = process.env.FIREBASE_SERVICE_ACCOUNT_B64;    // optional fallback
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT;        // optional fallback

  if (gac)    return initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  if (b64)    return initializeApp({ credential: cert(JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))), projectId: PROJECT_ID });
  if (inline) return initializeApp({ credential: cert(JSON.parse(inline)), projectId: PROJECT_ID });

  throw new Error('ADMIN_CREDENTIALS_MISSING');
}

export function getAdmin(): { adminAuth: Auth; adminDb: Firestore } {
  const app = initAdminApp();
  return { adminAuth: getAuth(app), adminDb: getFirestore(app) };
}
