
import admin from 'firebase-admin';
import bcrypt from 'bcryptjs';

const PROJECT_ID = 'salisburyspos';
const uid = 'cashier1';
const pin = '5678';

if (!admin.apps.length) {
  // This will use the GOOGLE_APPLICATION_CREDENTIALS environment variable
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: PROJECT_ID,
  });
}
const db = admin.firestore();

(async () => {
  // Ensure public user doc exists & active
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    await userRef.set({ name: 'Cashier 1', role: 'cashier', active: true, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    console.log('Created users/%s', uid);
  } else {
    await userRef.set({ active: true }, { merge: true });
  }

  // Set the PIN hash in userSecrets/{uid}
  const pinHash = bcrypt.hashSync(pin, 10);
  await db.collection('userSecrets').doc(uid).set(
    {
      pinHash,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  console.log('PIN set for %s (hash prefix: %s...)', uid, pinHash.slice(0, 20));

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
