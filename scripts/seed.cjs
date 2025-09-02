
// A script to seed the Firestore database with initial data.
// Usage: node scripts/seed.cjs
// Make sure you have GOOGLE_APPLICATION_CREDENTIALS set in your environment.

require('dotenv').config({ path: '.env.local' });
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const bcrypt = require('bcryptjs');

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : undefined;

if (!serviceAccount) {
    console.error("FIREBASE_SERVICE_ACCOUNT env var not set. Cannot seed.");
    process.exit(1);
}

const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = getFirestore(app);
const auth = getAuth(app);

const STAFF = [
    { id: 'admin', name: 'Admin', role: 'admin', pin: '1234' },
    { id: 'manager', name: 'Manager', role: 'manager', pin: '1111' },
    { id: 'cashier1', name: 'Cashier 1', role: 'cashier', pin: '2222' },
];

async function main() {
  console.log('Seeding staff...');
  for (const s of STAFF) {
    const { id, name, role, pin } = s;
    const pinHash = await bcrypt.hash(pin, 10);
    
    // Create Auth user if doesn't exist
    try {
      await auth.createUser({ uid: id, displayName: name });
      console.log(`Created auth user: ${id}`);
    } catch (e) {
      if (e.code !== 'auth/uid-already-exists') throw e;
    }

    // Set custom claim for role
    await auth.setCustomUserClaims(id, { role });

    // Set public profile
    await db.collection('users').doc(id).set({
      name,
      nameLower: name.toLowerCase(),
      role,
      active: true,
      hourlyRateCents: 0,
    }, { merge: true });
    
    // Set private PIN hash
    await db.collection('user_secrets').doc(id).set({ pinHash }, { merge: true });

    console.log(`Seeded user: ${id} (${name}) with role ${role} and PIN ${pin}`);
  }

  console.log('Done.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
