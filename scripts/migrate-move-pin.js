// Move pinHash from /users/{id} to /userSecrets/{id}
const admin = require('firebase-admin');

if (!admin.apps.length) {
  // Uses GOOGLE_APPLICATION_CREDENTIALS from your .env.local
  admin.initializeApp();
}
const db = admin.firestore();

(async () => {
  const snap = await db.collection('users').get();
  let moved = 0, skipped = 0;
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    if (!data.pinHash) { skipped++; continue; }
    const pinHash = data.pinHash;

    await db.collection('userSecrets').doc(doc.id).set({ pinHash }, { merge: true });
    await doc.ref.update({ pinHash: admin.firestore.FieldValue.delete() });

    moved++;
    console.log(`moved pinHash → userSecrets/${doc.id}`);
  }
  console.log(`Done. moved=${moved} skipped=${skipped}`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
