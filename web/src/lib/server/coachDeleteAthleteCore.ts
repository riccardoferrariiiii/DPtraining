import * as admin from "firebase-admin";

function isAuthUserNotFound(err: unknown): boolean {
  const code = (err as { errorInfo?: { code?: string }; code?: string })?.errorInfo?.code
    || (err as { code?: string })?.code;
  return code === "auth/user-not-found";
}

async function ensureAuthUserRemoved(
  auth: admin.auth.Auth,
  uid: string,
  email?: string
) {
  try {
    await auth.deleteUser(uid);
  } catch (err) {
    if (isAuthUserNotFound(err)) {
      // ok
    } else if (email) {
      const normalized = email.trim().toLowerCase();
      try {
        const u = await auth.getUserByEmail(normalized);
        if (u.uid === uid) {
          await auth.deleteUser(uid);
        }
      } catch (err2) {
        if (!isAuthUserNotFound(err2)) {
          throw err;
        }
      }
    } else {
      throw err;
    }
  }

  try {
    await auth.getUser(uid);
    throw new Error("AUTH_USER_STILL_EXISTS");
  } catch (check: unknown) {
    if ((check as Error)?.message === "AUTH_USER_STILL_EXISTS") {
      throw new Error(
        "L'utente Firebase Authentication non è stato eliminato: l'email resterebbe bloccata. Controlla le credenziali Admin su Vercel (stesso progetto Firebase dell'app)."
      );
    }
    if (isAuthUserNotFound(check)) {
      return;
    }
    throw check;
  }
}

async function deleteCollectionRecursiveByRef(
  collRef: admin.firestore.CollectionReference
) {
  const snap = await collRef.get();
  for (const doc of snap.docs) {
    const subcols = await doc.ref.listCollections();
    for (const sc of subcols) {
      await deleteCollectionRecursiveByRef(sc);
    }
    await doc.ref.delete();
  }
}

/**
 * Elimina prima Firebase Auth (libera subito l'email), poi tutto Firestore.
 * Così anche se il passaggio Firestore va in timeout, l'atleta può rifarsi l'account.
 */
export async function coachDeleteAthleteCore(
  db: admin.firestore.Firestore,
  auth: admin.auth.Auth,
  targetUid: string
): Promise<void> {
  const targetUserSnap = await db.collection("users").doc(targetUid).get();
  const rawEmail = targetUserSnap.data()?.email;
  const athleteEmail =
    typeof rawEmail === "string" && rawEmail.includes("@") ? rawEmail.trim() : undefined;

  await ensureAuthUserRemoved(auth, targetUid, athleteEmail);

  // Delete athletePrograms/{uid} subcollections (doc may not exist)
  try {
    const athleteProgramsDoc = db.collection("athletePrograms").doc(targetUid);
    const athleteProgramSubcols = await athleteProgramsDoc.listCollections();
    for (const sc of athleteProgramSubcols) {
      await deleteCollectionRecursiveByRef(sc);
    }
  } catch (err) {
    // Ignore errors if document structure doesn't exist
    console.warn("Note: athletePrograms/{uid} subcollections may not exist:", err);
  }

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

  const weeksColl = db.collection("users").doc(targetUid).collection("weeks");
  const weeksSnap = await weeksColl.get();
  for (const weekDoc of weeksSnap.docs) {
    const resultsColl = weekDoc.ref.collection("results");
    await deleteCollectionRecursiveByRef(resultsColl);
    await weekDoc.ref.delete();
  }

  await deleteCollectionRecursiveByRef(db.collection("users").doc(targetUid).collection("prs"));
  await deleteCollectionRecursiveByRef(
    db.collection("users").doc(targetUid).collection("notifications")
  );

  const entriesColl = db.collection("results").doc(targetUid).collection("entries");
  await deleteCollectionRecursiveByRef(entriesColl);

  const resultsDocRef = db.collection("results").doc(targetUid);
  const resultsDoc = await resultsDocRef.get();
  if (resultsDoc.exists) {
    await resultsDocRef.delete();
  }

  const userDocRef = db.collection("users").doc(targetUid);
  const userDoc = await userDocRef.get();
  if (userDoc.exists) {
    const subcols = await userDocRef.listCollections();
    for (const sc of subcols) {
      await deleteCollectionRecursiveByRef(sc);
    }
    await userDocRef.delete();
  }
}
