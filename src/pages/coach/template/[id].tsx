import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { RoleGuard } from "../../../components/RoleGuard";
import { TopBar } from "../../../components/TopBar";
import { db } from "../../../lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

type DayDoc = {
  id: string;
  order: number;
  workout: string;
};

export default function TemplateDetail() {
  return (
    <RoleGuard role="coach">
      <TemplateDetailInner />
    </RoleGuard>
  );
}

function TemplateDetailInner() {
  const router = useRouter();
  const templateId = router.query.id as string;

  const [title, setTitle] = useState("Template");
  const [days, setDays] = useState<DayDoc[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmType, setConfirmType] = useState<"success" | "error" | "warning">("success");
  const [pendingDeleteDay, setPendingDeleteDay] = useState<DayDoc | null>(null);

  useEffect(() => {
    if (!templateId) return;

    const loadTitle = async () => {
      const snap = await getDoc(doc(db, "programTemplates", templateId));
      if (snap.exists()) setTitle((snap.data() as any).title || "Template");
    };
    loadTitle();

    const q = query(
      collection(db, "programTemplates", templateId, "days"),
      orderBy("order", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          order: Number(data.order ?? 0),
          workout: data.workout ?? "",
        } as DayDoc;
      });

      // safety sort anche lato FE
      list.sort((a, b) => a.order - b.order);
      setDays(list);
    });

    return () => unsub();
  }, [templateId]);

  const addDay = async () => {
    if (!templateId) return;

    const snap = await getDocs(
      query(collection(db, "programTemplates", templateId, "days"), orderBy("order", "desc"))
    );

    let nextOrder = 1;
    if (!snap.empty) nextOrder = Number((snap.docs[0].data() as any).order ?? 0) + 1;

    await addDoc(collection(db, "programTemplates", templateId, "days"), {
      order: nextOrder,
      workout: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const saveWorkout = async (day: DayDoc) => {
    const text = drafts[day.id] ?? day.workout ?? "";
    await updateDoc(doc(db, "programTemplates", templateId, "days", day.id), {
      workout: text,
      updatedAt: serverTimestamp(),
    });
  };

  const deleteDay = async (day: DayDoc) => {
    setPendingDeleteDay(day);
    setConfirmMessage(`Eliminare Giorno ${day.order}?`);
    setConfirmType("warning");
  };

  const confirmDeleteDay = async () => {
    if (!pendingDeleteDay) return;
    await deleteDoc(doc(db, "programTemplates", templateId, "days", pendingDeleteDay.id));
    setPendingDeleteDay(null);
    setConfirmMessage("");
  };

  const renameTemplate = async () => {
    const t = prompt("Nome settimana:", title);
    if (!t) return;

    await updateDoc(doc(db, "programTemplates", templateId), {
      title: t.trim(),
      updatedAt: serverTimestamp(),
    });

    setTitle(t.trim());
  };

  const subtitle = useMemo(() => `Modifica: ${title}`, [title]);

  return (
    <>
      <TopBar title={subtitle} />
      <div className="container">
        <div className="card" style={{ marginTop: 20 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn" onClick={addDay}>
              + Aggiungi giorno
            </button>
            <button className="btn" onClick={renameTemplate}>
              Rinomina settimana
            </button>
            <button className="btn" onClick={() => router.push("/coach/templates")}>
              ← Indietro
            </button>
          </div>
        </div>

        {days.map((day) => (
          <div key={day.id} className="card" style={{ marginTop: 16 }}>
            <h3>Giorno {day.order}</h3>

            <textarea
              className="input"
              style={{ width: "100%", minHeight: 160, marginTop: 10 }}
              value={drafts[day.id] ?? day.workout ?? ""}
              onChange={(e) =>
                setDrafts((p) => ({
                  ...p,
                  [day.id]: e.target.value,
                }))
              }
              placeholder="Scrivi il workout (a capo come vuoi, l'atleta lo vedrà uguale)."
            />

            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn" onClick={() => saveWorkout(day)}>
                Salva workout
              </button>

              <button
                className="btn"
                onClick={() => deleteDay(day)}
                style={{ background: "#8b0000" }}
              >
                Elimina giorno
              </button>
            </div>
          </div>
        ))}

        {days.length === 0 && (
          <div className="card" style={{ marginTop: 16 }}>
            Nessun giorno ancora. Premi “Aggiungi giorno”.
          </div>
        )}
      </div>
      {confirmMessage && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={() => setConfirmMessage("")}
        >
          <div
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.08))",
              border: "1px solid rgba(255,255,255,0.16)",
              borderRadius: 18,
              padding: 24,
              maxWidth: 420,
              boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
              {confirmType === "success" ? "✅ Successo" : confirmType === "error" ? "❌ Errore" : "⚠️ Conferma"}
            </div>
            <div style={{ color: "rgba(245,245,247,0.75)", marginBottom: 20 }}>
              {confirmMessage}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                className="btn"
                onClick={() => {
                  setPendingDeleteDay(null);
                  setConfirmMessage("");
                }}
              >
                Annulla
              </button>
              <button
                className="btn btnPrimary"
                onClick={() => {
                  if (pendingDeleteDay) confirmDeleteDay();
                }}
              >
                Ok
              </button>
            </div>
          </div>
        </div>
      )}    </>
  );
}