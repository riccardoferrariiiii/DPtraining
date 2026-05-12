#!/usr/bin/env node
/**
 * Script per cancellare retroattivamente atleti (Firestore + Auth).
 * Usage:
 * 1) Metti il tuo service account JSON in questa cartella come `serviceAccountKey.json`.
 * 2) Esegui: `node deleteAthletes.js UID1 UID2` (puoi passare più UID separati)
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const keyPath = path.join(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
  console.error('Missing serviceAccountKey.json in firebase/tools. Create it and retry.');
  process.exit(1);
}

const serviceAccount = require(keyPath);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const auth = admin.auth();

async function deleteCollectionRecursive(collRef) {
  const snap = await collRef.get();
  for (const doc of snap.docs) {
    const subcols = await doc.ref.listCollections();
    for (const sc of subcols) {
      await deleteCollectionRecursive(sc);
    }
    await doc.ref.delete();
    console.log('Deleted doc', doc.ref.path);
  }
}

async function deleteAthlete(uid) {
  console.log('Start deleting', uid);
  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();

  // Legacy athletePrograms/{uid}
  const apRef = db.collection('athletePrograms').doc(uid);
  const apSubcols = await apRef.listCollections();
  for (const sc of apSubcols) {
    await deleteCollectionRecursive(sc);
  }

  // sharedFiles: drop uid from assignedAthleteUids
  const sharedSnap = await db
    .collection('sharedFiles')
    .where('assignedAthleteUids', 'array-contains', uid)
    .get();
  for (const fileDoc of sharedSnap.docs) {
    const assigned = fileDoc.get('assignedAthleteUids') || [];
    const nextAssigned = assigned.filter((u) => u !== uid);
    await fileDoc.ref.update({
      assignedAthleteUids: nextAssigned,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Delete weeks and nested results
  const weeksColl = userRef.collection('weeks');
  await deleteCollectionRecursive(weeksColl);

  // prs
  await deleteCollectionRecursive(userRef.collection('prs'));

  // notifications
  await deleteCollectionRecursive(userRef.collection('notifications'));

  // results entries
  const entriesColl = db.collection('results').doc(uid).collection('entries');
  await deleteCollectionRecursive(entriesColl);

  // delete results/{uid} doc
  const resultsDocRef = db.collection('results').doc(uid);
  const resultsDoc = await resultsDocRef.get();
  if (resultsDoc.exists) {
    await resultsDocRef.delete();
    console.log('Deleted', resultsDocRef.path);
  }

  // delete any other subcollections under users/{uid}
  if (userDoc.exists) {
    const subcols = await userRef.listCollections();
    for (const sc of subcols) {
      await deleteCollectionRecursive(sc);
    }
    await userRef.delete();
    console.log('Deleted', userRef.path);
  }

  // delete auth user
  try {
    await auth.deleteUser(uid);
    console.log('Deleted auth user', uid);
  } catch (err) {
    console.warn('Auth deletion error (maybe user missing):', err.message || err);
  }

  console.log('Finished deleting', uid);
}

async function main() {
  const uids = process.argv.slice(2);
  if (!uids.length) {
    console.error('Usage: node deleteAthletes.js UID1 UID2 ...');
    process.exit(1);
  }

  for (const uid of uids) {
    try {
      await deleteAthlete(uid);
    } catch (err) {
      console.error('Error deleting', uid, err);
    }
  }

  process.exit(0);
}

main();
