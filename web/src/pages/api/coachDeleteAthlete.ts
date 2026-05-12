import type { NextApiRequest, NextApiResponse } from "next";
import { getFirebaseAdmin, formatServerError } from "../../lib/server/firebaseAdmin";
import { coachDeleteAthleteCore } from "../../lib/server/coachDeleteAthleteCore";

/** Vercel / Next: consente eliminazioni con molti documenti (default spesso troppo basso). */
export const config = {
  maxDuration: 120,
};

function errorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null || !("code" in err)) return undefined;
  const c = (err as { code?: string | number }).code;
  if (c === undefined || c === null) return undefined;
  return String(c);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token di accesso mancante. Effettua di nuovo il login." });
  }

  const idToken = authHeader.slice("Bearer ".length).trim();

  let adminSdk: ReturnType<typeof getFirebaseAdmin>;
  try {
    adminSdk = getFirebaseAdmin();
  } catch (e: unknown) {
    const msg = formatServerError(e);
    console.error("coachDeleteAthlete: Firebase Admin init:", msg);
    return res.status(503).json({
      error:
        "Server senza credenziali Firebase Admin. Su Vercel aggiungi la variabile FIREBASE_SERVICE_ACCOUNT_JSON (vedi .env.example).",
    });
  }

  let callerUid: string;
  try {
    const decoded = await adminSdk.auth().verifyIdToken(idToken);
    callerUid = decoded.uid;
  } catch {
    return res.status(401).json({ error: "Sessione non valida. Effettua di nuovo il login." });
  }

  // Tutta la parte Firestore / delete deve stare nel try: altrimenti Next risponde con HTML 500.
  try {
    const callerDoc = await adminSdk.firestore().collection("users").doc(callerUid).get();
    if (callerDoc.data()?.role !== "coach") {
      return res.status(403).json({ error: "Solo i coach possono eliminare atleti." });
    }

    const body = (req.body || {}) as { uid?: string };
    const targetUid = body.uid;
    if (!targetUid || typeof targetUid !== "string") {
      return res.status(400).json({ error: "Parametro uid mancante." });
    }

    await coachDeleteAthleteCore(adminSdk.firestore(), adminSdk.auth(), targetUid);
    return res.status(200).json({ success: true });
  } catch (err: unknown) {
    const message = formatServerError(err);
    const code = errorCode(err);
    console.error("coachDeleteAthlete:", err);
    if (res.headersSent) return;
    return res.status(500).json({
      error: message || "Eliminazione fallita.",
      code: code || undefined,
    });
  }
}
