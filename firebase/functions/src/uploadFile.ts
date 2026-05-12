import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

const storage = admin.storage();
const db = admin.firestore();

export const uploadSharedFile = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in");
  }

  // Verify user is a coach
  const userDoc = await db.collection("users").doc(context.auth.uid).get();
  if (userDoc.data()?.role !== "coach") {
    throw new functions.https.HttpsError("permission-denied", "Only coaches can upload files");
  }

  const { fileId, fileName, fileData, mimeType, sizeBytes, assignedAthleteUids } = data;

  // Validate inputs
  if (!fileId || !fileName || !fileData) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required parameters");
  }

  try {
    // Upload to Storage
    const bucket = storage.bucket();
    const filePath = `shared-files/${fileId}/${fileName}`;
    const file = bucket.file(filePath);

    // Decode base64 to buffer
    const buffer = Buffer.from(fileData, "base64");

    await file.save(buffer, {
      metadata: {
        contentType: mimeType,
      },
    });

    // Create Firestore metadata
    await db.collection("sharedFiles").doc(fileId).set({
      fileName,
      originalName: fileName,
      storagePath: filePath,
      downloadUrl: `https://storage.googleapis.com/${bucket.name}/${filePath}`,
      mimeType,
      sizeBytes,
      assignedAthleteUids: assignedAthleteUids || [],
      uploadedBy: context.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      fileId,
      downloadUrl: `https://storage.googleapis.com/${bucket.name}/${filePath}`,
    };
  } catch (error) {
    console.error("Upload error:", error);
    throw new functions.https.HttpsError("internal", "Failed to upload file");
  }
});
