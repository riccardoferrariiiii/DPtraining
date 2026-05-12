import * as admin from "firebase-admin";

let initialized = false;

/** Inizializza Firebase Admin una sola volta (Vercel / locale). */
export function getFirebaseAdmin(): typeof admin {
  if (initialized && admin.apps.length) {
    return admin;
  }

  if (admin.apps.length) {
    initialized = true;
    return admin;
  }

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(json)) });
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
    "Firebase Admin non configurato: imposta FIREBASE_SERVICE_ACCOUNT_JSON (JSON del service account) oppure FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY + FIREBASE_PROJECT_ID nelle variabili d'ambiente su Vercel."
  );
}
