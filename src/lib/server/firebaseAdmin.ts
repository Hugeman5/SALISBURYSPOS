// src/lib/server/firebaseAdmin.ts
import * as admin from "firebase-admin";

let app: admin.app.App | null = null;

function getApp() {
  if (!app) {
    app = admin.apps.length ? admin.app() : admin.initializeApp();
  }
  return app;
}

export function getAdminDb() {
  return getApp().firestore();
}

export function getAdminAuth() {
  return getApp().auth();
}
