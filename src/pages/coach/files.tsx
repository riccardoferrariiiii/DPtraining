import { useEffect, useMemo, useState } from "react";
import { RoleGuard } from "../../components/RoleGuard";
import { TopBar } from "../../components/TopBar";
import { useSession } from "../../lib/session";
import { db, storage } from "../../lib/firebase";
import {
  AthleteOption,
  buildAthleteLabel,
  createSharedFileId,
  formatBytes,
  formatDateLabel,
  sanitizeStorageSegment,
  sharedFileDoc,
  sharedFilesCollection,
  SharedFile,
} from "../../lib/sharedFiles";
import {
  collection,
  deleteDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";

function fileLabel(file: SharedFile) {
  return file.fileName || file.originalName || "File";
}

export default function CoachFilesPage() {
  return (
    <RoleGuard role="coach">
      <CoachFilesInner />
    </RoleGuard>
  );
}

function CoachFilesInner() {
  const { user } = useSession();
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const [activeAssignFile, setActiveAssignFile] = useState<SharedFile | null>(null);
  const [assignDraft, setAssignDraft] = useState<string[]>([]);
  const [searchAthlete, setSearchAthlete] = useState("");
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const qAthletes = query(collection(db, "users"), where("role", "==", "athlete"));
    const unsubAthletes = onSnapshot(qAthletes, (snap) => {
      const next = snap.docs.map((d) => ({ uid: d.id, ...(d.data() as any) }));
      setAthletes(next);
    });

    const qFiles = query(sharedFilesCollection(), orderBy("createdAt", "desc"));
    const unsubFiles = onSnapshot(
      qFiles,
      (snap) => {
        const next = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setFiles(next);
        setDraftNames((prev) => {
          const merged = { ...prev };
          next.forEach((file) => {
            if (!merged[file.id]) {
              merged[file.id] = file.fileName || file.originalName || "";
            }
          });
          return merged;
        });
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => {
      unsubAthletes();
      unsubFiles();
    };
  }, []);

  const filteredAthletes = useMemo(() => {
    const q = searchAthlete.trim().toLowerCase();
    if (!q) return athletes;
    return athletes.filter((athlete) => buildAthleteLabel(athlete).toLowerCase().includes(q));
  }, [athletes, searchAthlete]);

  const openAssignModal = (file: SharedFile) => {
    setActiveAssignFile(file);
    setAssignDraft([...(file.assignedAthleteUids || [])]);
    setSearchAthlete("");
  };

  const uploadFile = async () => {
    if (!user?.uid || !selectedUploadFile) return;

    setUploading(true);
    setMessage(null);

    try {
      const fileId = createSharedFileId();
      const safeName = sanitizeStorageSegment(selectedUploadFile.name);
      const storagePath = `shared-files/${fileId}/${safeName}`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, selectedUploadFile, {
        contentType: selectedUploadFile.type || "application/octet-stream",
      });

      const downloadUrl = await getDownloadURL(storageRef);
      const finalName = displayName.trim() || selectedUploadFile.name;

      await setDoc(sharedFileDoc(fileId), {
        fileName: finalName,
        originalName: selectedUploadFile.name,
        storagePath,
        downloadUrl,
        mimeType: selectedUploadFile.type || "application/octet-stream",
        sizeBytes: selectedUploadFile.size,
        assignedAthleteUids: [],
        uploadedByUid: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSelectedUploadFile(null);
      setDisplayName("");
      setMessage({ kind: "success", text: "File caricato correttamente." });
    } catch (error: any) {
      setMessage({ kind: "error", text: String(error?.message || error) });
    } finally {
      setUploading(false);
    }
  };

  const saveFileName = async (file: SharedFile) => {
    const nextName = (draftNames[file.id] || "").trim();
    if (!nextName) return;

    await updateDoc(sharedFileDoc(file.id), {
      fileName: nextName,
      updatedAt: serverTimestamp(),
    });
  };

  const saveAssignments = async () => {
    if (!activeAssignFile) return;

    await updateDoc(sharedFileDoc(activeAssignFile.id), {
      assignedAthleteUids: assignDraft,
      updatedAt: serverTimestamp(),
    });

    setActiveAssignFile(null);
  };

  const deleteFile = async (file: SharedFile) => {
    const confirmed = window.confirm(`Eliminare ${fileLabel(file)}?`);
    if (!confirmed) return;

    try {
      await deleteObject(ref(storage, file.storagePath));
    } catch {
      // If storage object is already gone, still remove metadata.
    }

    await deleteDoc(sharedFileDoc(file.id));
  };

  return (
    <>
      <TopBar title="Gestisci File" />
      <div className="container" style={{ paddingBottom: 40 }}>
        <div className="card" style={{ marginTop: 20 }}>
          <h2 style={{ marginBottom: 8 }}>Carica un file</h2>
          <div style={{ opacity: 0.8, marginBottom: 16 }}>
            Puoi caricare qualsiasi estensione, rinominare il file e assegnarlo a uno o piu atleti.
          </div>

          {message && (
            <div
              className="card"
              style={{
                marginBottom: 16,
                borderColor: message.kind === "error" ? "rgba(255,90,90,0.5)" : "rgba(105,205,120,0.45)",
                background: message.kind === "error" ? "rgba(255,90,90,0.08)" : "rgba(105,205,120,0.08)",
              }}
            >
              {message.text}
            </div>
          )}

          <div className="row" style={{ gap: 12, alignItems: "end" }}>
            <div style={{ flex: "1 1 280px" }}>
              <label className="small" style={{ display: "block", marginBottom: 8 }}>
                File
              </label>
              <input
                type="file"
                className="input"
                style={{ width: "100%" }}
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setSelectedUploadFile(file);
                  setDisplayName(file?.name || "");
                }}
              />
            </div>

            <div style={{ flex: "1 1 280px" }}>
              <label className="small" style={{ display: "block", marginBottom: 8 }}>
                Nome file modificabile
              </label>
              <input
                className="input"
                style={{ width: "100%" }}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nome mostrato agli atleti"
              />
            </div>

            <button className="btn btnPrimary" onClick={uploadFile} disabled={!selectedUploadFile || uploading}>
              {uploading ? "Caricamento..." : "Aggiungi file"}
            </button>
          </div>

          {selectedUploadFile && (
            <div className="small" style={{ marginTop: 10, opacity: 0.8 }}>
              Selezionato: {selectedUploadFile.name} ({formatBytes(selectedUploadFile.size)})
            </div>
          )}
        </div>

        <div className="card" style={{ marginTop: 20 }}>
          <h2 style={{ marginBottom: 12 }}>File caricati</h2>

          {loading ? (
            <div className="small">Caricamento...</div>
          ) : files.length === 0 ? (
            <div className="small">Nessun file caricato ancora.</div>
          ) : (
            <div className="stack" style={{ gap: 14 }}>
              {files.map((file) => {
                const assignedNames = (file.assignedAthleteUids || [])
                  .map((uid) => athletes.find((athlete) => athlete.uid === uid))
                  .filter(Boolean)
                  .map((athlete) => buildAthleteLabel(athlete as AthleteOption));

                return (
                  <div
                    key={file.id}
                    className="card"
                    style={{
                      padding: 16,
                      background: "rgba(255,255,255,0.04)",
                      borderColor: "rgba(255,255,255,0.12)",
                    }}
                  >
                    <div className="row" style={{ justifyContent: "space-between", gap: 16, alignItems: "start" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{fileLabel(file)}</div>
                        <div className="small" style={{ marginBottom: 8 }}>
                          Originale: {file.originalName} | {formatBytes(file.sizeBytes)} | {formatDateLabel(file.createdAt)}
                        </div>
                        <div className="small" style={{ marginBottom: 12, wordBreak: "break-word" }}>
                          {file.mimeType}
                        </div>

                        <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                          <a className="btn btnPrimary" href={file.downloadUrl} target="_blank" rel="noreferrer">
                            Visualizza file
                          </a>
                          <button className="btn" onClick={() => openAssignModal(file)}>
                            Assegna atleti
                          </button>
                          <button className="btn btnDanger" onClick={() => deleteFile(file)}>
                            Elimina
                          </button>
                        </div>
                      </div>

                      <div style={{ flex: "0 1 320px", minWidth: 260 }}>
                        <label className="small" style={{ display: "block", marginBottom: 8 }}>
                          Nome modificabile
                        </label>
                        <input
                          className="input"
                          style={{ width: "100%" }}
                          value={draftNames[file.id] || ""}
                          onChange={(e) => setDraftNames((prev) => ({ ...prev, [file.id]: e.target.value }))}
                        />
                        <button className="btn" style={{ marginTop: 10 }} onClick={() => saveFileName(file)}>
                          Salva nome
                        </button>
                      </div>
                    </div>

                    <div style={{ marginTop: 14 }}>
                      <div className="small" style={{ marginBottom: 6 }}>
                        Assegnato a {assignedNames.length} atleta/e
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {assignedNames.length === 0 ? (
                          <span className="small" style={{ opacity: 0.7 }}>
                            Nessun atleta assegnato
                          </span>
                        ) : (
                          assignedNames.map((name) => (
                            <span
                              key={name}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 999,
                                background: "rgba(100,149,237,0.14)",
                                border: "1px solid rgba(100,149,237,0.3)",
                                fontSize: 13,
                              }}
                            >
                              {name}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {activeAssignFile && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setActiveAssignFile(null)}
        >
          <div
            className="card"
            style={{ width: "min(92vw, 760px)", maxHeight: "84vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: 8 }}>Assegna file</h2>
            <div className="small" style={{ marginBottom: 14 }}>
              {fileLabel(activeAssignFile)}
            </div>

            <input
              className="input"
              style={{ width: "100%", marginBottom: 14 }}
              value={searchAthlete}
              onChange={(e) => setSearchAthlete(e.target.value)}
              placeholder="Cerca atleta"
            />

            <div className="stack" style={{ gap: 10 }}>
              {filteredAthletes.map((athlete) => {
                const checked = assignDraft.includes(athlete.uid);
                return (
                  <label
                    key={athlete.uid}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: 12,
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.04)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setAssignDraft((prev) =>
                          e.target.checked
                            ? Array.from(new Set([...prev, athlete.uid]))
                            : prev.filter((uid) => uid !== athlete.uid)
                        );
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: 700 }}>{buildAthleteLabel(athlete)}</div>
                      <div className="small">{athlete.uid}</div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 16 }}>
              <button className="btn" onClick={() => setActiveAssignFile(null)}>
                Annulla
              </button>
              <button className="btn btnPrimary" onClick={saveAssignments}>
                Salva assegnazione
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}