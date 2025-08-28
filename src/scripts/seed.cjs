// scripts/seed.cjs
const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

if (!admin.apps.length) {
  try {
    // Attempt to initialize with service account from environment variable
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (e) {
    console.warn('Could not initialize with FIREBASE_SERVICE_ACCOUNT. Falling back to GOOGLE_APPLICATION_CREDENTIALS.');
    // Fallback for local development
    admin.initializeApp();
  }
}

const db = admin.firestore();

const users = [
  { id: 'admin-user', name: 'Admin', role: 'admin', pin: '1234' },
  { id: 'manager-user', name: 'Manager', role: 'manager', pin: '1111' },
  { id: 'cashier-user', name: 'Cashier', role: 'cashier', pin: '0000' },
  { id: 'kitchen-user', name: 'Kitchen', role: 'kitchen', pin: '2222' },
  { id: 'waiter-user', name: 'Waiter', role: 'waiter', pin: '3333' },
];

const categories = [
    { id: 'starters', name: 'Starters' },
    { id: 'mains', name: 'Mains' },
    { id: 'desserts', name: 'Desserts' },
    { id: 'drinks', name: 'Drinks' },
];

const products = [
    { name: 'Spring Rolls', sku: 'APP001', price: 6500, stockQty: 50, categoryId: 'starters' },
    { name: 'Peri-Peri Chicken Livers', sku: 'APP002', price: 7500, stockQty: 30, categoryId: 'starters' },
    { name: '250g Sirloin Steak', sku: 'MAIN001', price: 18000, stockQty: 25, categoryId: 'mains' },
    { name: 'Hake & Chips', sku: 'MAIN002', price: 14000, stockQty: 40, categoryId: 'mains' },
    { name: 'Vegetable Curry', sku: 'MAIN003', price: 12000, stockQty: 35, categoryId: 'mains' },
    { name: 'Malva Pudding', sku: 'DES001', price: 7000, stockQty: 20, categoryId: 'desserts' },
    { name: 'Castle Lager', sku: 'DRNK001', price: 3500, stockQty: 100, categoryId: 'drinks' },
    { name: 'Coca-Cola', sku: 'DRNK002', price: 2500, stockQty: 150, categoryId: 'drinks' },
];

async function seedCollection(collectionName, data, idField = 'id') {
  console.log(`Seeding ${collectionName}...`);
  const collectionRef = db.collection(collectionName);
  const batch = db.batch();

  for (const item of data) {
    const docId = item[idField] || uuidv4();
    const docRef = collectionRef.doc(docId);
    const docData = { ...item };
    if (idField === 'id') {
      delete docData.id;
    }
    batch.set(docRef, { ...docData, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  }

  await batch.commit();
  console.log(`${collectionName} seeded successfully.`);
}


async function seedUsers() {
  console.log('Seeding users and userSecrets...');
  const batch = db.batch();

  for (const user of users) {
    const { id, name, role, pin } = user;
    const pinHash = await bcrypt.hash(pin, 10);
    
    const userRef = db.collection('users').doc(id);
    batch.set(userRef, {
      name,
      role,
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const secretRef = db.collection('userSecrets').doc(id);
    batch.set(secretRef, {
      pinHash,
    });
  }

  await batch.commit();
  console.log('Users and userSecrets seeded successfully.');
}

async function main() {
  try {
    await seedUsers();
    await seedCollection('categories', categories);
    await seedCollection('products', products);
    console.log('Database seeding complete.');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

main();
