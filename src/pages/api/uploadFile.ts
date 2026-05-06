import type { NextApiRequest, NextApiResponse } from "next";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

let adminApp: any;
let db: any;
let auth: any;

try {
  adminApp = getApps().length > 0 ? getApps()[0] : initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
  db = getFirestore(adminApp);
  auth = getAuth(adminApp);
} catch (error) {
  console.error("Firebase Admin init note:", error);
}

interface UploadResponse {
  success?: boolean;
  fileId?: string;
  downloadUrl?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { fileId, fileName, fileData, mimeType, sizeBytes, assignedAthleteUids, idToken } = req.body;

    // Verify user is authenticated
    if (!idToken) {
      return res.status(401).json({ error: "Missing authentication token" });
    }

    let userId = "";
    if (auth) {
      try {
        const decodedToken = await auth.verifyIdToken(idToken);
        userId = decodedToken.uid;
      } catch (error) {
        return res.status(401).json({ error: "Invalid token" });
      }
    }

    // Validate inputs
    if (!fileId || !fileName || !fileData) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Decode base64
    const buffer = Buffer.from(fileData, "base64");
    const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

    // Upload to Firebase Storage via REST API
    const filePath = `shared-files/${fileId}/${fileName}`;
    const encodedPath = encodeURIComponent(filePath);
    const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?uploadType=media&name=${encodedPath}`;

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type": mimeType || "application/octet-stream",
      },
      body: buffer,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Storage upload failed: ${uploadResponse.statusText}`);
    }

    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media`;

    // Create Firestore document if DB is available
    if (db) {
      try {
        await db.collection("sharedFiles").doc(fileId).set({
          fileName,
          originalName: fileName,
          storagePath: filePath,
          downloadUrl,
          mimeType: mimeType || "application/octet-stream",
          sizeBytes: sizeBytes || 0,
          assignedAthleteUids: assignedAthleteUids || [],
          uploadedBy: userId || "unknown",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (dbError) {
        console.error("Firestore write error:", dbError);
        // Continue - storage upload succeeded
      }
    }

    return res.status(200).json({
      success: true,
      fileId,
      downloadUrl,
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return res.status(500).json({ error: error.message || "Upload failed" });
  }
}


