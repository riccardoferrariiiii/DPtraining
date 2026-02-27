import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RoleGuard } from "../../components/RoleGuard";
import { TopBar } from "../../components/TopBar";
import { db } from "../../lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  orderBy,
  where,
} from "firebase/firestore";

type Template = {
  id: string;
  title: string;
  createdAt?: any;
};

type Athlete = {
  uid: string;
  firstName?: string;
  lastName?: string;
  email?: string;
};

type AssignedWeek = {
  id: string;
  title: string;
  templateId: string;
};

export default function CoachTemplates() {
  return (
    <RoleGuard role="coach">
      <CoachTemplatesInner />
    </RoleGuard>
  );
}

function CoachTemplatesInner() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [selectedAthletes, setSelectedAthletes] = useState<Set<string>>(new Set());
  const [athleteAssignedWeeks, setAthleteAssignedWeeks] = useState<Record<string, AssignedWeek[]>>({});
  const [expandedAthletes, setExpandedAthletes] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [assigningAthletes, setAssigningAthletes] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [confirmType, setConfirmType] = useState<'success' | 'error' | 'warning'>('success');
  const [pendingDeleteTemplate, setPendingDeleteTemplate] = useState<Template | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [pendingRenameTemplate, setPendingRenameTemplate] = useState<Template | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');

  useEffect(() => {
    const q = query(collection(db, "programTemplates"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setTemplates(
        snap.docs.map((d) => ({
          id: d.id,
          title: (d.data() as any).title || "Senza titolo",
          createdAt: (d.data() as any).createdAt,
        }))
      );
    });

    return () => unsub();
  }, []);

  const loadAthletes = async () => {
    const qUsers = query(collection(db, "users"), where("role", "==", "athlete"));
    const snap = await getDocs(qUsers);
    const list = snap.docs.map((d) => ({
      uid: d.id,
      firstName: (d.data() as any).firstName,
      lastName: (d.data() as any).lastName,
      email: (d.data() as any).email,
    }));
    setAthletes(list);
    setSelectedAthletes(new Set());

    // Carica settimane già assegnate per ogni atleta
    const weeksMap: Record<string, AssignedWeek[]> = {};
    await Promise.all(
      list.map(async (athlete) => {
        const weeksSnap = await getDocs(collection(db, "users", athlete.uid, "weeks"));
        weeksMap[athlete.uid] = weeksSnap.docs.map((d) => ({
          id: d.id,
          title: (d.data() as any).title || "Settimana",
          templateId: (d.data() as any).templateId,
        }));
      })
    );
    setAthleteAssignedWeeks(weeksMap);
  };

  const canCreate = useMemo(() => newTitle.trim().length >= 2, [newTitle]);

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const lowerQuery = searchQuery.toLowerCase();
    return templates.filter(t => t.title.toLowerCase().includes(lowerQuery));
  }, [templates, searchQuery]);

  const createTemplate = async () => {
    if (!canCreate) return;

    await addDoc(collection(db, "programTemplates"), {
      title: newTitle.trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setNewTitle("");
  };

  const renameTemplate = (t: Template) => {
    setPendingRenameTemplate(t);
    setNewTemplateName(t.title);
    setRenameModalOpen(true);
  };

  const confirmRename = async () => {
    if (!pendingRenameTemplate || !newTemplateName.trim()) return;

    try {
      const newTitle = newTemplateName.trim();
      
      // 1. Aggiorna il template principale
      await updateDoc(doc(db, "programTemplates", pendingRenameTemplate.id), {
        title: newTitle,
        updatedAt: serverTimestamp(),
      });

      // 2. Aggiorna tutte le settimane assegnate agli atleti con questo templateId
      const usersSnap = await getDocs(collection(db, "users"));
      const updatePromises: Promise<void>[] = [];

      for (const userDoc of usersSnap.docs) {
        const weeksSnap = await getDocs(collection(db, "users", userDoc.id, "weeks"));
        weeksSnap.docs.forEach((weekDoc) => {
          const weekData = weekDoc.data();
          if (weekData.templateId === pendingRenameTemplate.id) {
            updatePromises.push(
              updateDoc(weekDoc.ref, {
                title: newTitle,
                updatedAt: serverTimestamp(),
              })
            );
          }
        });
      }

      await Promise.all(updatePromises);
      
      setConfirmMessage('Settimana rinominata ✅');
      setConfirmType('success');
    } catch (e: any) {
      setConfirmMessage('Errore: ' + (e?.message ?? e));
      setConfirmType('error');
    } finally {
      setRenameModalOpen(false);
      setPendingRenameTemplate(null);
      setNewTemplateName('');
    }
  };

  const deleteTemplate = async (t: Template) => {
    setPendingDeleteTemplate(t);
    setConfirmMessage(`Eliminare "${t.title}"?\n\nAttenzione: verrà eliminata da tutti gli atleti a cui è stata assegnata.`);
    setConfirmType("warning");
  };

  const confirmDeleteTemplate = async () => {
    if (!pendingDeleteTemplate) return;

    // 1. Elimina tutte le assegnazioni agli atleti
    const usersSnap = await getDocs(collection(db, "users"));
    const deleteWeeksPromises: Promise<void>[] = [];

    for (const userDoc of usersSnap.docs) {
      const weeksSnap = await getDocs(collection(db, "users", userDoc.id, "weeks"));
      weeksSnap.docs.forEach((weekDoc) => {
        const weekData = weekDoc.data();
        if (weekData.templateId === pendingDeleteTemplate.id) {
          deleteWeeksPromises.push(deleteDoc(weekDoc.ref));
        }
      });
    }

    await Promise.all(deleteWeeksPromises);

    // 2. Elimina days (subcollection)
    const daysSnap = await getDocs(collection(db, "programTemplates", pendingDeleteTemplate.id, "days"));
    await Promise.all(daysSnap.docs.map((d) => deleteDoc(d.ref)));

    // 3. Elimina template
    await deleteDoc(doc(db, "programTemplates", pendingDeleteTemplate.id));
    
    setPendingDeleteTemplate(null);
    setConfirmMessage("");
  };

  const openAssignModal = async (templateId: string) => {
    setSelectedTemplateId(templateId);
    await loadAthletes();
    setExpandedAthletes(new Set());
    setShowModal(true);
  };

  const toggleAthlete = (uid: string) => {
    const newSet = new Set(selectedAthletes);
    if (newSet.has(uid)) {
      newSet.delete(uid);
    } else {
      newSet.add(uid);
    }
    setSelectedAthletes(newSet);
  };

  const toggleExpandAthlete = (uid: string) => {
    const newSet = new Set(expandedAthletes);
    if (newSet.has(uid)) {
      newSet.delete(uid);
    } else {
      newSet.add(uid);
    }
    setExpandedAthletes(newSet);
  };

  const assignTemplate = async () => {
    if (!selectedTemplateId || selectedAthletes.size === 0) {
      setConfirmMessage("Seleziona almeno un atleta");
      setConfirmType('warning');
      return;
    }

    const template = templates.find((t) => t.id === selectedTemplateId);
    if (!template) return;

    setAssigningAthletes(true);
    try {
      await Promise.all(
        Array.from(selectedAthletes).map((uid) =>
          addDoc(collection(db, "users", uid, "weeks"), {
            templateId: selectedTemplateId,
            title: template.title,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        )
      );

      setConfirmMessage(`Settimana assegnata a ${selectedAthletes.size} atleta/i`);
      setConfirmType('success');
      setShowModal(false);
      setSelectedAthletes(new Set());
      setSelectedTemplateId(null);
      // Ricarica le settimane assegnate
      await loadAthletes();
    } catch (e: any) {
      setConfirmMessage("Errore assegnazione: " + (e?.message ?? e));
      setConfirmType('error');
    } finally {
      setAssigningAthletes(false);
    }
  };

  const removeWeekFromAthlete = async (athleteUid: string, weekId: string) => {
    try {
      await deleteDoc(doc(db, "users", athleteUid, "weeks", weekId));
      setConfirmMessage("Settimana rimossa ✅");
      setConfirmType('success');
      // Ricarica le settimane assegnate
      await loadAthletes();
    } catch (e: any) {
      setConfirmMessage("Errore rimozione: " + (e?.message ?? e));
      setConfirmType('error');
    }
  };

  return (
    <>
      <TopBar title="Settimane Programmi" />
      <div className="container">
        <div className="card" style={{ marginTop: 20 }}>
          <h2>Cerca settimane</h2>
          <input
            className="input"
            placeholder="Cerca per nome..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ marginTop: 12 }}
          />
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <h2>Crea nuova settimana</h2>
          <input
            className="input"
            placeholder="Nome (es. Settimana 1)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            style={{ marginTop: 12 }}
          />
          <div style={{ marginTop: 12 }}>
            <button className="btn" onClick={createTemplate} disabled={!canCreate}>
              Crea
            </button>
          </div>
        </div>

        {filteredTemplates.map((t) => (
          <div key={t.id} className="card" style={{ marginTop: 16 }}>
            <h3 style={{ marginBottom: 12 }}>{t.title}</h3>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href={`/coach/template/${t.id}`}>
                <button className="btn">Apri</button>
              </Link>

              <button className="btn" onClick={() => renameTemplate(t)}>
                Rinomina
              </button>

              <button
                className="btn"
                onClick={() => openAssignModal(t.id)}
                style={{ background: "#0066cc" }}
              >
                Assegna Atleti
              </button>

              <button
                className="btn"
                onClick={() => deleteTemplate(t)}
                style={{ background: "#8b0000" }}
              >
                Elimina
              </button>
            </div>
          </div>
        ))}

        {filteredTemplates.length === 0 && templates.length > 0 && (
          <div className="card" style={{ marginTop: 16 }}>
            Nessuna settimana trovata con "{searchQuery}".
          </div>
        )}
        {templates.length === 0 && (
          <div className="card" style={{ marginTop: 16 }}>
            Nessuna settimana ancora.
          </div>
        )}
      </div>

      {/* Modal Assegna Atleti */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: 500,
              maxHeight: "80vh",
              overflow: "auto",
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Assegna Settimana agli Atleti</h2>
            <p style={{ opacity: 0.8, marginTop: 8 }}>
              Seleziona gli atleti a cui vuoi assegnare questa settimana
            </p>

            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {athletes.length === 0 ? (
                <div style={{ opacity: 0.8 }}>Nessun atleta trovato</div>
              ) : (
                athletes.map((a) => {
                  const alreadyHasThisWeek = (athleteAssignedWeeks[a.uid] || []).some(
                    (w) => w.templateId === selectedTemplateId
                  );
                  const assignedWeeks = athleteAssignedWeeks[a.uid] || [];

                  return (
                    <div key={a.uid}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                          padding: 10,
                          backgroundColor: alreadyHasThisWeek ? "rgba(76, 175, 80, 0.1)" : "rgba(245, 245, 247, 0.05)",
                          borderRadius: 6,
                        }}
                      >
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            cursor: alreadyHasThisWeek ? "not-allowed" : "pointer",
                            opacity: alreadyHasThisWeek ? 0.7 : 1,
                            flex: 1,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedAthletes.has(a.uid) || alreadyHasThisWeek}
                            onChange={() => {
                              if (!alreadyHasThisWeek) toggleAthlete(a.uid);
                            }}
                            disabled={alreadyHasThisWeek}
                            style={{ cursor: alreadyHasThisWeek ? "not-allowed" : "pointer" }}
                          />
                          <span>
                            {a.firstName && a.lastName
                              ? `${a.firstName} ${a.lastName}`
                              : a.email || "Atleta"}
                            {alreadyHasThisWeek && " ✓ (già assegnata)"}
                          </span>
                        </label>

                        {assignedWeeks.length > 0 && (
                          <button
                            onClick={() => toggleExpandAthlete(a.uid)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#007bff",
                              cursor: "pointer",
                              padding: "4px 8px",
                              fontSize: 16,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {expandedAthletes.has(a.uid) ? `▲` : `▼`}
                          </button>
                        )}
                      </div>

                      {/* Mostra settimane assegnate con tasto elimina */}
                      {assignedWeeks.length > 0 && expandedAthletes.has(a.uid) && (
                        <div style={{ marginLeft: 20, marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                          {assignedWeeks.map((week) => (
                            <div
                              key={week.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "6px 10px",
                                backgroundColor: "rgba(245, 245, 247, 0.03)",
                                borderRadius: 4,
                                fontSize: 12,
                                opacity: 0.7,
                              }}
                            >
                              <span>{week.title}</span>
                              <button
                                className="btn"
                                onClick={() => removeWeekFromAthlete(a.uid, week.id)}
                                style={{
                                  padding: "4px 8px",
                                  fontSize: 12,
                                  background: "#ff4444",
                                  border: "none",
                                  borderRadius: 4,
                                  color: "white",
                                  cursor: "pointer",
                                }}
                              >
                                Rimuovi
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
              <button
                className="btn btnPrimary"
                onClick={assignTemplate}
                disabled={selectedAthletes.size === 0 || assigningAthletes}
              >
                {assigningAthletes ? "Assegnazione..." : "Assegna"}
              </button>
              <button
                className="btn"
                onClick={() => setShowModal(false)}
                disabled={assigningAthletes}
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Rinomina Settimana */}
      {renameModalOpen && pendingRenameTemplate && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1001,
          }}
          onClick={() => {
            setRenameModalOpen(false);
            setPendingRenameTemplate(null);
            setNewTemplateName('');
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: 500,
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
            }}>
              <span style={{ fontSize: 24 }}>✏️</span>
              <h3 style={{ margin: 0 }}>Rinomina settimana</h3>
            </div>
            <p style={{ margin: 0, marginBottom: 12, fontSize: 14, color: 'rgba(245,245,247,0.7)' }}>Nuovo nome settimana:</p>
            <input
              className="input"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              placeholder="Nome settimana"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTemplateName.trim()) {
                  confirmRename();
                } else if (e.key === 'Escape') {
                  setRenameModalOpen(false);
                  setPendingRenameTemplate(null);
                  setNewTemplateName('');
                }
              }}
              style={{ marginBottom: 20 }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn"
                onClick={() => {
                  setRenameModalOpen(false);
                  setPendingRenameTemplate(null);
                  setNewTemplateName('');
                }}
                style={{ flex: 1 }}
              >
                Annulla
              </button>
              <button
                className="btn btnPrimary"
                onClick={confirmRename}
                disabled={!newTemplateName.trim()}
                style={{ flex: 1 }}
              >
                Ok
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Conferma Messaggio */}
      {confirmMessage && !pendingDeleteTemplate && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1001,
          }}
          onClick={() => setConfirmMessage(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: 400,
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
            }}>
              <span style={{
                fontSize: 24,
              }}>
                {confirmType === 'success' && '✅'}
                {confirmType === 'error' && '❌'}
                {confirmType === 'warning' && '⚠️'}
              </span>
              <h3 style={{
                margin: 0,
                color: confirmType === 'success' ? '#4ade80' : confirmType === 'error' ? '#ef4444' : '#eab308',
              }}>
                {confirmType === 'success' && 'Successo'}
                {confirmType === 'error' && 'Errore'}
                {confirmType === 'warning' && 'Attenzione'}
              </h3>
            </div>
            <p style={{ margin: 0, marginBottom: 20 }}>{confirmMessage}</p>
            <button
              className="btn btnPrimary"
              onClick={() => setConfirmMessage(null)}
              style={{ width: "100%" }}
            >
              Ok
            </button>
          </div>
        </div>
      )}

      {/* Modal Conferma Elimina Template */}
      {confirmMessage && pendingDeleteTemplate && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1001,
          }}
          onClick={() => {
            setPendingDeleteTemplate(null);
            setConfirmMessage(null);
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: 400,
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
            }}>
              <span style={{ fontSize: 24 }}>⚠️</span>
              <h3 style={{ margin: 0, color: '#eab308' }}>Conferma</h3>
            </div>
            <p style={{ margin: 0, marginBottom: 20, whiteSpace: 'pre-wrap' }}>{confirmMessage}</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn"
                onClick={() => {
                  setPendingDeleteTemplate(null);
                  setConfirmMessage(null);
                }}
                style={{ flex: 1 }}
              >
                Annulla
              </button>
              <button
                className="btn btnPrimary"
                onClick={confirmDeleteTemplate}
                style={{ flex: 1 }}
              >
                Ok
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}