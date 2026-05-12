import * as admin from "firebase-admin";

let initialized = false;

function parseServiceAccountObject(): Record<string, unknown> | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (raw) {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_JSON non è JSON valido. Su Vercel incolla il file completo senza modifiche, oppure usa FIREBASE_SERVICE_ACCOUNT_BASE64 (file JSON codificato in Base64)."
      );
    }
  }

  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim();
  if (b64) {
    try {
      const decoded = Buffer.from(b64, "base64").toString("utf8");
      return JSON.parse(decoded) as Record<string, unknown>;
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 non è Base64 di un JSON valido.");
    }
  }

  return null;
}

/** Inizializza Firebase Admin una sola volta (Vercel / locale). */
export function getFirebaseAdmin(): typeof admin {
  if (initialized && admin.apps.length) {
    return admin;
  }

  if (admin.apps.length) {
    initialized = true;
    return admin;
  }

  const parsed = parseServiceAccountObject();
  if (parsed) {
    const publicId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
    const saProjectId = typeof parsed.project_id === "string" ? parsed.project_id : "";
    if (publicId && saProjectId && publicId !== saProjectId) {
      throw new Error(
        `Il service account è per il progetto Firebase "${saProjectId}" ma NEXT_PUBLIC_FIREBASE_PROJECT_ID è "${publicId}". Usa il JSON dello stesso progetto dell'app.`
      );
    }
    admin.initializeApp({ credential: admin.credential.cert(parsed as admin.ServiceAccount) });
    initialized = true;
    return admin;
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (clientEmail && privateKey && projectId) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    initialized = true;
    return admin;
  }

  throw new Error(
    "Firebase Admin non configurato: su Vercel imposta FIREBASE_SERVICE_ACCOUNT_JSON (JSON del service account) oppure FIREBASE_SERVICE_ACCOUNT_BASE64, oppure FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY + FIREBASE_PROJECT_ID. Vedi .env.example."
  );
}
