#!/usr/bin/env node
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const bcrypt = require('bcryptjs');

function initAdmin() {
  initializeApp({ credential: applicationDefault(), projectId: 'salisburyspos' });
  return { db: getFirestore(), auth: getAuth() };
}

async function seedUsers(db, auth) {
  console.log('Seeding users...');
  const users = [
    { id: 'admin1', name: 'Alice Admin', role: 'admin', pin: '1234', active: true },
    { id: 'manager1', name: 'Mike Manager', role: 'manager', pin: '1111', active: true },
    { id: 'cashier1', name: 'Cassie Cash', role: 'cashier', pin: '2222', active: true },
    { id: 'waiter1', name: 'Walter Waiter', role: 'waiter', pin: '0000', active: true },
    { id: 'kitchen1', name: 'Kurt Kitchen', role: 'kitchen', pin: '5555', active: true },
    { id: 'inactive1', name: 'Inactive User', role: 'cashier', pin: '9999', active: false },
  ];

  const batch = db.batch();

  for (const user of users) {
    const { id, pin, ...userData } = user;
    const pinHash = await bcrypt.hash(pin, 10);
    const ref = db.collection('users').doc(id);
    batch.set(ref, { 
      ...userData, 
      pinHash,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    
    // Create Firebase Auth user if not exists
    try {
      await auth.getUser(id);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        await auth.createUser({ uid: id, displayName: user.name });
      } else {
        throw error;
      }
    }
    await auth.setCustomUserClaims(id, { role: user.role });
  }

  await batch.commit();
  console.log(`${users.length} users seeded.`);
}

async function seedCategoriesAndProducts(db) {
  console.log('Seeding categories and products...');
  
  const categories = {
    coffee: { name: 'Coffee', color: '#6F4E37', sortOrder: 1 },
    bakery: { name: 'Bakery', color: '#E8B478', sortOrder: 2 },
    sandwiches: { name: 'Sandwiches', color: '#32CD32', sortOrder: 3 },
  };

  const catBatch = db.batch();
  for (const [id, data] of Object.entries(categories)) {
    const ref = db.collection('categories').doc(id);
    catBatch.set(ref, { ...data, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  }
  await catBatch.commit();
  console.log(`${Object.keys(categories).length} categories seeded.`);
  
  const products = [
    { name: 'Flat White', sku: 'SKU-001', price: 38.00, taxRate: 15, categoryId: 'coffee', active: true, stockQty: 100 },
    { name: 'Cappuccino', sku: 'SKU-002', price: 36.00, taxRate: 15, categoryId: 'coffee', active: true, stockQty: 100 },
    { name: 'Espresso', sku: 'SKU-003', price: 25.00, taxRate: 15, categoryId: 'coffee', active: true, stockQty: 100 },
    { name: 'Croissant', sku: 'SKU-101', price: 28.00, taxRate: 15, categoryId: 'bakery', active: true, stockQty: 50 },
    { name: 'Muffin', sku: 'SKU-102', price: 22.00, taxRate: 15, categoryId: 'bakery', active: true, stockQty: 60 },
    { name: 'Chicken Mayo Sandwich', sku: 'SKU-201', price: 55.00, taxRate: 15, categoryId: 'sandwiches', active: true, stockQty: 20 },
  ];

  const prodBatch = db.batch();
  for (const product of products) {
    const ref = db.collection('products').doc();
    prodBatch.set(ref, { ...product, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  }
  await prodBatch.commit();
  console.log(`${products.length} products seeded.`);
}

async function seedSettings(db) {
    console.log('Seeding settings...');
    const ref = db.collection('settings').doc('main');
    await ref.set({
        businessName: 'Salisburys POS',
        taxNumber: 'VAT123456789',
        defaultTaxRate: 15,
        updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    console.log('Settings seeded.');
}


async function main() {
  try {
    const { db, auth } = initAdmin();
    await seedUsers(db, auth);
    await seedCategoriesAndProducts(db);
    await seedSettings(db);
    console.log('\nSeed complete! ✅');
  } catch (e) {
    console.error('🔥 Seeding failed:');
    console.error(e);
    process.exit(1);
  }
}

main();
