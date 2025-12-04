const admin = require('firebase-admin');
const path = require('path');

// Usage: node scripts/printRide.js <rideId>
const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
try {
  admin.initializeApp({ credential: admin.credential.cert(require(serviceAccountPath)) });
} catch (e) {
  try { admin.app(); } catch (_) { }
}

const db = admin.firestore();

async function main() {
  const rideId = process.argv[2];
  if (!rideId) {
    console.error('Usage: node scripts/printRide.js <rideId>');
    process.exit(1);
  }
  const ref = db.collection('rides').doc(rideId);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error('Ride not found:', rideId);
    process.exit(2);
  }
  console.log(JSON.stringify({ id: snap.id, data: snap.data() }, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
