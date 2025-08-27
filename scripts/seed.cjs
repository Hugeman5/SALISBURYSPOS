'use strict';
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'salisburyspos';

function init() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS to your serviceAccount.json path.');
  }
  return initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
}

async function main() {
  init();
  const db = getFirestore();
  const batch = db.batch();

  // Settings (VAT 15%, ZAR)
  batch.set(db.collection('settings').doc('general'), {
    currency: 'ZAR',
    vatRate: 0.15,
    businessName: 'Salisburys POS',
    createdAt: new Date()
  });

  // Admin user with PIN
  batch.set(db.collection('users').doc('admin1'), {
    name: 'Admin',
    role: 'admin',
    active: true,
    pin: '1234'
  });
  
  // Other users
  batch.set(db.collection('users').doc('cashier1'), {
    name: 'Jane Doe',
    role: 'cashier',
    active: true,
    pin: '1111'
  });
  
  batch.set(db.collection('users').doc('waiter1'), {
    name: 'John Smith',
    role: 'waiter',
    active: true,
    pin: '2222'
  });
  
  batch.set(db.collection('users').doc('kitchen1'), {
    name: 'Chef Mike',
    role: 'kitchen',
    active: false,
    pin: '3333'
  });

  // Sample menu + ingredients (minimal)
  batch.set(db.collection('ingredients').doc('tomato'), { name: 'Tomato', unit: 'kg', avgCost: 25 });
  batch.set(db.collection('menuCategories').doc('mains'), { name: 'Mains', sort: 1 });
  batch.set(db.collection('menuItems').doc('burger'), {
    name: 'Salisburys Burger',
    categoryId: 'mains',
    priceInclVat: 95,
    recipe: [{ ingredientId: 'tomato', qty: 0.05 }],
    active: true
  });

  await batch.commit();
  console.log('Seed complete for project:', PROJECT_ID);
}

main().catch(e => { console.error(e); process.exit(1); });
