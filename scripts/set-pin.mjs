
import admin from 'firebase-admin';
import bcrypt from 'bcryptjs';

// Read configuration from environment variables with defaults
const uid = process.env.UID || 'cashier1';
const pin = process.env.PIN || '5678';
const PROJECT_ID = process.env.PROJECT_ID || 'salisburyspos';

console.log(`Attempting to set PIN for user: ${uid} in project: ${PROJECT_ID}`);

if (!admin.apps.length) {
  // This script assumes you have GOOGLE_APPLICATION_CREDENTIALS set in your environment.
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: PROJECT_ID,
  });
}
const db = admin.firestore();

(async () => {
  try {
    // Ensure public user doc exists & is active
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      await userRef.set({ 
        name: `User ${uid}`, 
        role: 'cashier', 
        active: true, 
        createdAt: admin.firestore.FieldValue.serverTimestamp() 
      });
      console.log(`Created new user: users/${uid}`);
    } else {
      await userRef.update({ active: true });
      console.log(`Ensured user is active: users/${uid}`);
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
    console.log(`✅ PIN set successfully for ${uid} (hash: ${pinHash.slice(0, 20)}...)`);
    
  } catch (e) {
    console.error('❌ An error occurred:');
    console.error(e);
    process.exit(1);
  }
})();
