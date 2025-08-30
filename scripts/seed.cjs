
// A script to seed the Firestore database with some initial data.
// Usage: `node scripts/seed.cjs`
// Make sure you have the GOOGLE_APPLICATION_CREDENTIALS env var set.

const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');

// --- Your settings ---
const PROJECT_ID = 'salisburyspos'; // Your Firebase Project ID
const BATCH_SIZE = 499; // Firestore batch limit is 500

// --- Static Data ---
const USERS = [
  { id: 'admin1', name: 'Alice (Admin)', role: 'admin', active: true, pin: '1234', hourlyRateZAR: 200 },
  { id: 'manager2', name: 'Bob (Manager)', role: 'manager', active: true, pin: '2345', hourlyRateZAR: 150 },
  { id: 'cashier3', name: 'Charlie (Cashier)', role: 'cashier', active: true, pin: '3456', hourlyRateZAR: 100 },
  { id: 'waiter4', name: 'Diana (Waiter)', role: 'waiter', active: true, pin: '4567', hourlyRateZAR: 80 },
  { id: 'kitchen5', name: 'Eve (Kitchen)', role: 'kitchen', active: true, pin: '5678', hourlyRateZAR: 90 },
  { id: 'inactive6', name: 'Frank (Inactive)', role: 'cashier', active: false, pin: '6789', hourlyRateZAR: 100 },
];

const CATEGORIES = [
  { name: "Coffee & Hot Drinks" },
  { name: "Breakfast" },
  { name: "Lunch & Mains" },
  { name: "Bakery & Cakes" },
  { name: "Cold Drinks" },
  { name: "Retail" },
];

const PRODUCTS = [
    // Coffee & Hot Drinks
    { name: "Espresso", sku: "COF001", category: "Coffee & Hot Drinks", price: 25.00, trackStock: false },
    { name: "Cappuccino", sku: "COF002", category: "Coffee & Hot Drinks", price: 35.00, trackStock: false },
    { name: "Latte", sku: "COF003", category: "Coffee & Hot Drinks", price: 35.00, trackStock: false },
    { name: "Rooibos Tea", sku: "COF004", category: "Coffee & Hot Drinks", price: 28.00, trackStock: true, stock: 100 },
    // Breakfast
    { name: "Sourdough Toast", sku: "BRK001", category: "Breakfast", price: 45.00, trackStock: true, stock: 50 },
    { name: "Full English Breakfast", sku: "BRK002", category: "Breakfast", price: 120.00, trackStock: false },
    // Lunch
    { name: "Chicken Mayo Sandwich", sku: "LUN001", category: "Lunch & Mains", price: 75.00, trackStock: true, stock: 20 },
    { name: "Beef Burger", sku: "LUN002", category: "Lunch & Mains", price: 130.00, trackStock: true, stock: 30 },
    // Bakery
    { name: "Croissant", sku: "BAK001", category: "Bakery & Cakes", price: 30.00, trackStock: true, stock: 40 },
    { name: "Carrot Cake Slice", sku: "BAK002", category: "Bakery & Cakes", price: 55.00, trackStock: true, stock: 15 },
    // Cold Drinks
    { name: "Coca-Cola", sku: "DRN001", category: "Cold Drinks", price: 20.00, trackStock: true, stock: 100 },
    { name: "Still Water", sku: "DRN002", category: "Cold Drinks", price: 18.00, trackStock: true, stock: 100 },
    // Retail
    { name: "Rusks", sku: "RET001", category: "Retail", price: 60.00, trackStock: true, stock: 25 },
];


/**
 * Main seeding function.
 */
async function main() {
  console.log(`--- Seeding Firestore for project: ${PROJECT_ID} ---`);

  // Initialize Admin SDK
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }
  const db = admin.firestore();

  // Create users
  console.log(`\n👤 Seeding ${USERS.length} users...`);
  const userBatches = [db.batch()];
  let userOpCount = 0;
  for (const u of USERS) {
    if (userOpCount > BATCH_SIZE) {
        userBatches.push(db.batch());
        userOpCount = 0;
    }
    const currentBatch = userBatches[userBatches.length-1];
    
    const { pin, ...userData } = u;
    const userRef = db.collection('users').doc(u.id);
    currentBatch.set(userRef, {
      ...userData,
      hourlyRateCents: Math.round(u.hourlyRateZAR * 100),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    userOpCount++;

    const secretRef = db.collection('user_secrets').doc(u.id);
    // Use the specific hash for Alice (admin1)
    const pinHash = u.id === 'admin1'
        ? '$2a$10$FzniRqYMU0ExQNwOArAYkeY7koYJcmr0b.c9YKo3z8bVNq1oT3SFu'
        : bcrypt.hashSync(pin, 10);
        
    currentBatch.set(secretRef, { pinHash });
    userOpCount++;
  }
  await Promise.all(userBatches.map(b=>b.commit()));
  console.log('✅ Users seeded.');

  // Create categories
  console.log(`\n🏷️  Seeding ${CATEGORIES.length} categories...`);
  const categoriesByName = {};
  const catBatch = db.batch();
  for (const c of CATEGORIES) {
      const ref = db.collection('categories').doc();
      catBatch.set(ref, {
        ...c,
        nameLower: c.name.toLowerCase(),
        sort: 0,
      });
      categoriesByName[c.name] = { id: ref.id, name: c.name };
  }
  await catBatch.commit();
  console.log('✅ Categories seeded.');

  // Create products
  console.log(`\n📦 Seeding ${PRODUCTS.length} products...`);
  const prodBatches = [db.batch()];
  let prodOpCount = 0;
  for (const p of PRODUCTS) {
    if (prodOpCount >= BATCH_SIZE) {
        prodBatches.push(db.batch());
        prodOpCount = 0;
    }
    const currentBatch = prodBatches[prodBatches.length-1];

    const ref = db.collection('products').doc();
    const category = categoriesByName[p.category];
    const priceIncCents = Math.round(p.price * 100);
    const taxRate = 0.15;
    const priceExCents = Math.round(priceIncCents / (1 + taxRate));

    currentBatch.set(ref, {
      name: p.name,
      nameLower: p.name.toLowerCase(),
      sku: p.sku,
      skuUpper: p.sku.toUpperCase(),
      categoryId: category?.id || null,
      categoryName: category?.name || null,
      price: {
        currency: 'ZAR',
        taxRate,
        incCents: priceIncCents,
        exCents: priceExCents,
      },
      trackStock: p.trackStock,
      stockOnHand: p.stock || 0,
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    prodOpCount++;
  }
  await Promise.all(prodBatches.map(b=>b.commit()));
  console.log('✅ Products seeded.');

  // Create some registers
  console.log('\n📠 Seeding registers...');
  const regBatch = db.batch();
  regBatch.set(db.collection('registers').doc('front'), { name: 'Front Counter', active: true });
  regBatch.set(db.collection('registers').doc('bar'), { name: 'Bar', active: true });
  await regBatch.commit();
  console.log('✅ Registers seeded.');

  console.log('\n🎉 --- Seeding complete! ---');
}


main().catch(err => {
  console.error(err);
  process.exit(1);
});
