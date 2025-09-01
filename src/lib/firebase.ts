
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyCEo74xa0GcP17mVA6TJ9kkevhBtN8BnX8",
  authDomain: "salisburyspos.firebaseapp.com",
  projectId: "salisburyspos",
};

export const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'us-central1');

if (process.env.NEXT_PUBLIC_USE_EMULATORS === 'true') {
  console.log('Connecting to functions emulator');
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}
