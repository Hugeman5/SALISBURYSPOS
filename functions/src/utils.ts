import { getApps, initializeApp, App } from "firebase-admin/app";
import {
  getFirestore, FieldValue, Timestamp, FieldPath, Firestore,
} from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";
import { getStorage, Storage } from "firebase-admin/storage";

const app: App = getApps()[0] ?? initializeApp();

export const db: Firestore = getFirestore(app);
export const auth: Auth = getAuth(app);
export const storage: Storage = getStorage(app);

export { FieldValue, Timestamp, FieldPath };
