#!/usr/bin/env node
/* Seed staff users + products for salisburyspos */
const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

function initAdmin() {
  // Uses your /home/user/serviceAccount.json via GOOGLE_APPLICATION_CREDENTIALS
  initializeApp({ credential: applicationDefault(), projectId: 'salisburyspos' });
  return { db: getFirestore(), auth: getAuth() };
}

async function upsertUserDoc(db, id, data) {
  await db.collection('users').doc(id).set(data, { merge: true });
}

async function setCustomRoleClaim(auth, uid, role) {
  // You can use staff id == uid for simplicity (PIN login uses doc id as UID)
  await auth.setCustomUserClaims(uid, { role });
}

async function main() {
  const { db, auth } = initAdmin();

  console.log('Seeding staff…');
  const staff = [
    { id: 'admin1',   name: 'Alice Admin',   role: 'admin',   pin: '1234', active: true },
    { id: 'manager1', name: 'Mike Manager',  role: 'manager', pin: '1111', active: true },
    { id: 'cashier1', name: 'Cassie Cash',   role: 'cashier', pin: '2222', active: true },
  ];

  for (const s of staff) {
    await upsertUserDoc(db, s.id, s);
    // set claims on the same id, so Custom Token “uid” matches this id
    await setCustomRoleClaim(auth, s.id, s.role);
  }

  console.log('Seeding products…');
  const products = [
    { id: 'sku-1001', name: 'Flat White', price: 38.0, taxRate: 0.15, categoryId: 'coffee', active: true },
    { id: 'sku-1002', name: 'Cappuccino', price: 36.0, taxRate: 0.15, categoryId: 'coffee', active: true },
    { id: 'sku-2001', name: 'Muffin',     price: 22.0, taxRate: 0.15, categoryId: 'bakery', active: true },
  ];

  for (const p of products) {
    await db.collection('products').doc(p.id).set(p, { merge: true });
  }

  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
