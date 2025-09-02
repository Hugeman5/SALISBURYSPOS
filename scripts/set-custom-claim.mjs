
// scripts/set-custom-claim.mjs
import admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';

// Initialize the Firebase Admin SDK.
// You must have the GOOGLE_APPLICATION_CREDENTIALS environment variable set.
// See: https://firebase.google.com/docs/admin/setup#initialize-sdk
admin.initializeApp();

const uid = process.argv[2];
const role = process.argv[3];

const validRoles = ['admin', 'manager', 'cashier', 'waiter', 'kitchen'];

if (!uid || !role) {
  console.error('Usage: node scripts/set-custom-claim.mjs <uid> <role>');
  process.exit(1);
}

if (!validRoles.includes(role)) {
    console.error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    process.exit(1);
}

(async () => {
  try {
    await getAuth().setCustomUserClaims(uid, { role });
    console.log(`Successfully set role='${role}' for user ${uid}`);

    // Verify the claim was set
    const user = await getAuth().getUser(uid);
    console.log('Current custom claims:', user.customClaims);
    process.exit(0);
  } catch (error) {
    console.error('Error setting custom claim:', error);
    process.exit(1);
  }
})();
