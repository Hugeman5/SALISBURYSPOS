
'use strict';
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

if (!getApps().length) {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    initializeApp({ credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS) });
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  } else {
    // For App Hosting and other environments where ADC is configured.
    initializeApp();
  }
}

const db = getFirestore();

(async () => {
  const users = db.collection('users');
  await users.doc('admin1').set({ name: 'Admin', role: 'admin', active: true, pin: '1234' }, { merge: true });
  await users.doc('cashier1').set({ name: 'Cashier', role: 'cashier', active: true, pin: '1111' }, { merge: true });
  console.log('Seeded users: admin1 (1234), cashier1 (1111)');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
