import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  doc,
} from "firebase/firestore";
import { db } from "./firebase";

export type InAppNotificationInput = {
  title: string;
  message: string;
  type: "result_submitted" | "coach_comment" | "week_assigned" | "subscription_expiring";
  link?: string;
};

export async function createInAppNotification(
  targetUid: string,
  payload: InAppNotificationInput
) {
  await addDoc(collection(db, "users", targetUid, "notifications"), {
    ...payload,
    readAt: null,
    createdAt: serverTimestamp(),
  });
}

export async function createUniqueInAppNotification(
  targetUid: string,
  uniqueId: string,
  payload: InAppNotificationInput
) {
  await setDoc(
    doc(db, "users", targetUid, "notifications", uniqueId),
    {
      ...payload,
      readAt: null,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function notifyAllCoaches(payload: InAppNotificationInput) {
  const coachesSnap = await getDocs(
    query(collection(db, "users"), where("role", "==", "coach"))
  );

  await Promise.all(
    coachesSnap.docs.map((coachDoc) => createInAppNotification(coachDoc.id, payload))
  );
}
