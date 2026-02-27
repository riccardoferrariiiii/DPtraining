import { useEffect, useMemo, useState } from "react";
import { RoleGuard } from "../../components/RoleGuard";
import { TopBar } from "../../components/TopBar";
import { db } from "../../lib/firebase";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  addDoc,
} from "firebase/firestore";

type Athlete = {
  uid: string;
  email?: string;
  role?: string;
  subscriptionExpiresAt?: any;
};

type Template = {
  id: string;
  title: string;
};

function toDateInputValue(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function CoachAthletes() {
  return (
    <RoleGuard role="athlete">
      <CoachAthletesInner />
    </RoleGuard>
  );
}

function CoachAthletesInner() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmType, setConfirmType] = useState<"success" | "error" | "warning">("success");

  useEffect(() => {
    const qUsers = query(collection(db, "users"), where("role", "==", "athlete"));
    const unsub = onSnapshot(qUsers, (snap) => {
      setAthletes(
        snap.docs.map((d) => ({
          uid: d.id,
          ...(d.data() as any),
        }))
      );
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const loadTemplates = async () => {
      const snap = await getDocs(collection(db, "programTemplates"));
      const list = snap.docs.map((d) => ({
        id: d.id,
        title: (d.data() as any).title || "Senza titolo",
      }));
      setTemplates(list);
      if (!selectedTemplate && list.length > 0) setSelectedTemplate(list[0].id);
    };
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const templateTitle = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplate)?.title || "";
  }, [templates, selectedTemplate]);

  const setExpiry = async (uid: string, dateStr: string) => {
    // dateStr = YYYY-MM-DD
    const expires = new Date(`${dateStr}T00:00:00`);
    await updateDoc(doc(db, "users", uid), {
      subscriptionExpiresAt: expires,
      updatedAt: serverTimestamp(),
    });
  };

  const assignTemplateToAthlete = async (uid: string) => {
    if (!selectedTemplate) {
      setConfirmMessage("Nessun template selezionato.");
      setConfirmType("error");
      return;
    }

    // crea una nuova week assegnata all'atleta
    await addDoc(collection(db, "users", uid, "weeks"), {
      templateId: selectedTemplate,
      title: templateTitle || "Settimana",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setConfirmMessage("Template assegnato ✅");
    setConfirmType("success");
  };

  return (
    <>
      <TopBar title="Gestisci Atleti" />
      <div className="container">
        <div className="card" style={{ marginTop: 20 }}>
          <h2>Assegna template</h2>
          <p style={{ opacity: 0.8 }}>
            Seleziona un template e poi assegnalo agli atleti che vuoi.
          </p>

          <select
            className="input"
            style={{ marginTop: 10 }}
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>

        {athletes.map((a) => {
          const expiry =
            a.subscriptionExpiresAt?.toDate?.() instanceof Date
              ? a.subscriptionExpiresAt.toDate()
              : a.subscriptionExpiresAt instanceof Date
              ? a.subscriptionExpiresAt
              : null;

          const expiryValue = expiry ? toDateInputValue(expiry) : "";

          return (
            <div key={a.uid} className="card" style={{ marginTop: 16 }}>
              <h3 style={{ marginBottom: 6 }}>{a.email || a.uid}</h3>
              <div style={{ opacity: 0.8, marginBottom: 12 }}>UID: {a.uid}</div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 12, opacity: 0.75 }}>Scadenza abbonamento</label>
                  <input
                    className="input"
                    type="date"
                    defaultValue={expiryValue}
                    onBlur={(e) => {
                      if (e.target.value) setExpiry(a.uid, e.target.value);
                    }}
                  />
                </div>

                <button className="btn" onClick={() => assignTemplateToAthlete(a.uid)}>
                  Assegna template
                </button>
              </div>
            </div>
          );
        })}

        {athletes.length === 0 && (
          <div className="card" style={{ marginTop: 16 }}>
            Nessun atleta trovato.
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
              {confirmType === "success" ? "✅ Successo" : confirmType === "error" ? "❌ Errore" : "⚠️ Attenzione"}
            </div>
            <div style={{ color: "rgba(245,245,247,0.75)", marginBottom: 20 }}>
              {confirmMessage}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btnPrimary" onClick={() => setConfirmMessage("")}>
                Ok
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}