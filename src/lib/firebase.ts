import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

export const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Optional analytics; never break SSR/dev if unsupported.
export async function initAnalytics() {
  if (typeof window === 'undefined') return null;
  if (!firebaseConfig.measurementId) return null;
  try { return (await isSupported()) ? getAnalytics(app) : null; } catch { return null; }
}
