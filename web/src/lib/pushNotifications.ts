import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getToken } from "firebase/messaging";
import { db, getFirebaseMessaging } from "./firebase";

export async function requestPushNotifications(uid: string): Promise<{ enabled: boolean; reason?: string; token?: string }> {
  if (!uid || typeof window === "undefined" || !("Notification" in window)) {
    return { enabled: false, reason: "unsupported" };
  }

  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    return { enabled: false, reason: "unsupported" };
  }

  if (!("serviceWorker" in navigator)) {
    return { enabled: false, reason: "unsupported" };
  }

  if (Notification.permission === "denied") {
    return { enabled: false, reason: "denied" };
  }

  if (Notification.permission === "default") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { enabled: false, reason: permission === "denied" ? "denied" : "blocked" };
    }
  }

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";
  if (!vapidKey) {
    return { enabled: false, reason: "missing-vapid" };
  }

  try {
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/",
    });

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      return { enabled: false, reason: "no-token" };
    }

    await setDoc(
      doc(db, "users", uid, "deviceTokens", token),
      {
        token,
        createdAt: serverTimestamp(),
        platform: "web",
      },
      { merge: true }
    );

    return { enabled: true, token };
  } catch {
    return { enabled: false, reason: "unsupported" };
  }
}
