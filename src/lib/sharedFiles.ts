import { collection, doc } from "firebase/firestore";
import { db } from "./firebase";

export type SharedFile = {
  id: string;
  fileName: string;
  originalName: string;
  storagePath: string;
  downloadUrl: string;
  mimeType: string;
  sizeBytes: number;
  assignedAthleteUids: string[];
  uploadedByUid?: string;
  createdAt?: any;
  updatedAt?: any;
};

export type AthleteOption = {
  uid: string;
  email?: string;
  firstName?: string;
  lastName?: string;
};

export function sharedFilesCollection() {
  return collection(db, "sharedFiles");
}

export function sharedFileDoc(fileId: string) {
  return doc(db, "sharedFiles", fileId);
}

export function createSharedFileId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `file_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function sanitizeStorageSegment(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100) || "file";
}

export function formatBytes(bytes?: number) {
  if (!Number.isFinite(bytes as number)) return "-";

  const size = bytes as number;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatDateLabel(raw: any) {
  const date = raw?.toDate?.() instanceof Date ? raw.toDate() : raw instanceof Date ? raw : null;

  if (!date) return "Data non disponibile";

  return date.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function buildAthleteLabel(athlete: AthleteOption) {
  return athlete.firstName && athlete.lastName
    ? `${athlete.firstName} ${athlete.lastName}`
    : athlete.email || athlete.uid;
}