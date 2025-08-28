#!/usr/bin/env node
/* 
  One-shot migration script to hash all plaintext `pin` fields in Firestore.
  Usage: node scripts/migrate-pin-hash.cjs
*/
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const bcrypt = require('bcryptjs');

function initAdmin() {
  initializeApp({ credential: applicationDefault(), projectId: 'salisburyspos' });
  return { db: getFirestore() };
}

async function main() {
  const { db } = initAdmin();
  const usersRef = db.collection('users');

  console.log('Finding users with plaintext PINs...');
  
  // Firestore doesn't have a "where field exists" query, so we query for `pin > ""`
  // This works for string PINs. Adapt if you have numeric PINs.
  const snapshot = await usersRef.where('pin', '>', '').get();

  if (snapshot.empty) {
    console.log('No users with plaintext PINs found. Exiting.');
    return;
  }

  console.log(`Found ${snapshot.size} user(s) to migrate.`);

  const batch = db.batch();
  for (const doc of snapshot.docs) {
    const user = doc.data();
    const pin = user.pin;

    if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
        console.warn(`Skipping user ${doc.id} due to invalid PIN format: ${pin}`);
        continue;
    }
    
    console.log(`Hashing PIN for user: ${doc.id} (${user.name})`);
    const salt = await bcrypt.genSalt(10);
    const pinHash = await bcrypt.hash(pin, salt);
    
    batch.update(doc.ref, {
      pinHash: pinHash,
      pin: FieldValue.delete() // Remove the old plaintext pin
    });
  }

  await batch.commit();
  console.log('Batch update complete. All plaintext PINs have been hashed and removed.');
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
