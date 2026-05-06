import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { RoleGuard } from "../../components/RoleGuard";
import { TopBar } from "../../components/TopBar";
import { db } from "../../lib/firebase";
import { useSession } from "../../lib/session";
import {
  formatBytes,
  formatDateLabel,
  SharedFile,
  sharedFilesCollection,
} from "../../lib/sharedFiles";

export default function AthleteFilesPage() {
  return (
    <RoleGuard role="athlete">
      <AthleteFilesInner />
    </RoleGuard>
  );
}

function AthleteFilesInner() {
  const { user } = useSession();
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    const qFiles = query(
      sharedFilesCollection(),
      where("assignedAthleteUids", "array-contains", user.uid)
    );

    const unsub = onSnapshot(
      qFiles,
      (snap) => {
        const next = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        next.sort((a, b) => {
          const aTime = a.createdAt?.toDate?.()?.getTime?.() || 0;
          const bTime = b.createdAt?.toDate?.()?.getTime?.() || 0;
          return bTime - aTime;
        });
        setFiles(next);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [user?.uid]);

  const hasFiles = useMemo(() => files.length > 0, [files]);

  return (
    <>
      <TopBar title="I Miei File" />
      <div className="container">
        <div className="card" style={{ marginTop: 20 }}>
          <h2 style={{ marginBottom: 8 }}>File assegnati</h2>
          <div style={{ opacity: 0.8, marginBottom: 16 }}>
            Qui trovi i file che il coach ha condiviso con te.
          </div>

          {loading ? (
            <div className="small">Caricamento...</div>
          ) : !hasFiles ? (
            <div className="small">Nessun file assegnato al momento.</div>
          ) : (
            <div className="stack" style={{ gap: 14 }}>
              {files.map((file) => (
                <div
                  key={file.id}
                  className="card"
                  style={{
                    padding: 16,
                    background: "rgba(255,255,255,0.04)",
                    borderColor: "rgba(255,255,255,0.12)",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
                    {file.fileName || file.originalName || "File"}
                  </div>
                  <div className="small" style={{ marginBottom: 14 }}>
                    Originale: {file.originalName} | {formatBytes(file.sizeBytes)} | {formatDateLabel(file.createdAt)}
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <a className="btn btnPrimary" href={file.downloadUrl} target="_blank" rel="noreferrer">
                      Scarica
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}