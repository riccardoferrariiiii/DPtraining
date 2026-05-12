import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function deleteCollectionRecursiveByRef(collRef: FirebaseFirestore.CollectionReference) {
  const snap = await collRef.get();
  for (const doc of snap.docs) {
    // delete subcollections of this doc
    const subcols = await doc.ref.listCollections();
    for (const sc of subcols) {
      await deleteCollectionRecursiveByRef(sc);
    }
    await doc.ref.delete();
  }
}

export const deleteAthlete = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in");
  }

  const callerUid = context.auth.uid;

  // Verify caller is a coach
  const callerDoc = await db.collection("users").doc(callerUid).get();
  if (callerDoc.data()?.role !== "coach") {
    throw new functions.https.HttpsError("permission-denied", "Only coaches can delete athletes");
  }

  const targetUid = data?.uid;
  if (!targetUid || typeof targetUid !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Missing athlete uid");
  }

  try {
    // 0) Legacy athletePrograms/{uid} (subcollections can exist without a parent doc)
    const athleteProgramsDoc = db.collection("athletePrograms").doc(targetUid);
    const athleteProgramSubcols = await athleteProgramsDoc.listCollections();
    for (const sc of athleteProgramSubcols) {
      await deleteCollectionRecursiveByRef(sc);
    }

    // 0b) Remove athlete from shared file assignments (metadata only; files stay for coach)
    const sharedSnap = await db
      .collection("sharedFiles")
      .where("assignedAthleteUids", "array-contains", targetUid)
      .get();
    for (const fileDoc of sharedSnap.docs) {
      const assigned: string[] = fileDoc.get("assignedAthleteUids") || [];
      const nextAssigned = assigned.filter((u) => u !== targetUid);
      await fileDoc.ref.update({
        assignedAthleteUids: nextAssigned,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // 1) Delete weeks and nested results under users/{uid}/weeks
    const weeksColl = db.collection("users").doc(targetUid).collection("weeks");
    const weeksSnap = await weeksColl.get();
    for (const weekDoc of weeksSnap.docs) {
      const resultsColl = weekDoc.ref.collection("results");
      await deleteCollectionRecursiveByRef(resultsColl);
      await weekDoc.ref.delete();
    }

    // 2) Delete prs, notifications under users/{uid}
    await deleteCollectionRecursiveByRef(db.collection("users").doc(targetUid).collection("prs"));
    await deleteCollectionRecursiveByRef(db.collection("users").doc(targetUid).collection("notifications"));

    // 3) Delete shared subcollections that the UI might have created (weeks already handled)

    // 4) Delete results/{uid}/entries
    const entriesColl = db.collection("results").doc(targetUid).collection("entries");
    await deleteCollectionRecursiveByRef(entriesColl);

    // 5) Delete results/{uid} document if exists
    const resultsDocRef = db.collection("results").doc(targetUid);
    const resultsDoc = await resultsDocRef.get();
    if (resultsDoc.exists) {
      await resultsDocRef.delete();
    }

    // 6) Other top-level athlete data (sharedFiles assignments cleared in step 0b)

    // 7) Finally delete user document
    const userDocRef = db.collection("users").doc(targetUid);
    const userDoc = await userDocRef.get();
    if (userDoc.exists) {
      // delete any remaining subcollections under users/{uid}
      const subcols = await userDocRef.listCollections();
      for (const sc of subcols) {
        await deleteCollectionRecursiveByRef(sc);
      }
      await userDocRef.delete();
    }

    // 8) Delete Firebase Auth user
    try {
      await admin.auth().deleteUser(targetUid);
    } catch (err) {
      // If deletion from Auth fails (user not found), ignore
      console.warn("Auth deletion error or user not found:", err);
    }

    return { success: true };
  } catch (error) {
    console.error("deleteAthlete error:", error);
    throw new functions.https.HttpsError("internal", "Failed to delete athlete");
  }
});
