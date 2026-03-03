import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { RoleGuard } from "../../components/RoleGuard";
import { TopBar } from "../../components/TopBar";
import { db } from "../../lib/firebase";
import { createInAppNotification } from "../../lib/inAppNotifications";
import { isSubscriptionExpired } from "../../lib/session";
import {
  deleteDoc,
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
  firstName?: string;
  lastName?: string;
  subscriptionExpiresAt?: any;
};

type Template = {
  id: string;
  title: string;
};

type QuickFilter = "all" | "expired" | "today" | "soon" | "active";
type SortMode = "smart" | "expiryAsc" | "expiryDesc" | "nameAsc";

type AthleteRow = {
  athlete: Athlete;
  fullName: string;
  expiry: Date | null;
  daysUntilExpiry: number | null;
  expired: boolean;
};

function toDateInputValue(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseSubscriptionExpiry(raw: any): Date | null {
  if (!raw) return null;

  if (raw?.toDate && typeof raw.toDate === "function") {
    const d = raw.toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d : null;
  }

  if (raw instanceof Date) {
    return !isNaN(raw.getTime()) ? raw : null;
  }

  if (typeof raw === "number" || typeof raw === "string") {
    const d = new Date(raw);
    return !isNaN(d.getTime()) ? d : null;
  }

  return null;
}

function getDaysUntilExpiry(expiry: Date | null): number | null {
  if (!expiry) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiryDate = new Date(expiry);
  expiryDate.setHours(0, 0, 0, 0);

  const diffMs = expiryDate.getTime() - today.getTime();
  return Math.ceil(diffMs / 86400000);
}

function getStatusInfo(expired: boolean, daysUntilExpiry: number | null) {
  if (daysUntilExpiry === null) {
    return {
      label: "Nessuna scadenza",
      detail: "Scadenza non impostata",
      kind: "none" as const,
    };
  }

  if (expired) {
    if (daysUntilExpiry === 0) {
      return {
        label: "Scaduto oggi",
        detail: "Scaduto oggi",
        kind: "expired" as const,
      };
    }

    return {
      label: "Scaduto",
      detail: `Scaduto da ${Math.abs(daysUntilExpiry)} ${Math.abs(daysUntilExpiry) === 1 ? "giorno" : "giorni"}`,
      kind: "expired" as const,
    };
  }

  if (daysUntilExpiry === 1) {
    return {
      label: "Scade domani",
      detail: "Scade domani",
      kind: "soon" as const,
    };
  }

  if (daysUntilExpiry <= 7) {
    return {
      label: "In scadenza",
      detail: `${daysUntilExpiry} ${daysUntilExpiry === 1 ? "giorno" : "giorni"} alla scadenza`,
      kind: "soon" as const,
    };
  }

  return {
    label: "Attivo",
    detail: `${daysUntilExpiry} ${daysUntilExpiry === 1 ? "giorno" : "giorni"} alla scadenza`,
    kind: "active" as const,
  };
}

function matchesQuickFilter(row: AthleteRow, quickFilter: QuickFilter): boolean {
  if (quickFilter === "all") return true;
  if (quickFilter === "expired") return row.expired;
  if (quickFilter === "today") return row.daysUntilExpiry === 0;
  if (quickFilter === "soon") return !row.expired && row.daysUntilExpiry !== null && row.daysUntilExpiry <= 7;
  if (quickFilter === "active") return !row.expired;
  return true;
}

function compareSmart(a: AthleteRow, b: AthleteRow): number {
  const getPriority = (row: AthleteRow) => {
    if (row.expired) return 0;
    if (row.daysUntilExpiry === null) return 4;
    if (row.daysUntilExpiry <= 7) return 1;
    return 2;
  };

  const pA = getPriority(a);
  const pB = getPriority(b);
  if (pA !== pB) return pA - pB;

  const tA = rowToSortTime(a, true);
  const tB = rowToSortTime(b, true);
  if (tA !== tB) return tA - tB;

  return a.fullName.localeCompare(b.fullName);
}

function rowToSortTime(row: AthleteRow, nullAsInfinity: boolean) {
  if (!row.expiry) return nullAsInfinity ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  return row.expiry.getTime();
}

export default function CoachAthletes() {
  return (
    <RoleGuard role="coach">
      <CoachAthletesInner />
    </RoleGuard>
  );
}

function CoachAthletesInner() {
  const router = useRouter();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [searchAthlete, setSearchAthlete] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("smart");
  const [alreadyAssignedMap, setAlreadyAssignedMap] = useState<Record<string, boolean>>({});
  const [deletingUid, setDeletingUid] = useState<string>("");
  const [athleteToDelete, setAthleteToDelete] = useState<Athlete | null>(null);
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

  const athleteRows = useMemo<AthleteRow[]>(() => {
    return athletes.map((athlete) => {
      const fullName = athlete.firstName && athlete.lastName
        ? `${athlete.firstName} ${athlete.lastName}`
        : athlete.email || "Atleta";

      const expiry = parseSubscriptionExpiry(athlete.subscriptionExpiresAt);
      const daysUntilExpiry = getDaysUntilExpiry(expiry);
      const expired = isSubscriptionExpired(athlete.subscriptionExpiresAt);

      return {
        athlete,
        fullName,
        expiry,
        daysUntilExpiry,
        expired,
      };
    });
  }, [athletes]);

  const filteredAthletes = useMemo(() => {
    const queryText = searchAthlete.trim().toLowerCase();
    const searched = !queryText
      ? athleteRows
      : athleteRows.filter((row) => {
          const fullName = `${row.athlete.firstName || ""} ${row.athlete.lastName || ""}`.trim().toLowerCase();
          const email = (row.athlete.email || "").toLowerCase();
          return fullName.includes(queryText) || email.includes(queryText);
        });

    const filtered = searched.filter((row) => matchesQuickFilter(row, quickFilter));

    const sorted = [...filtered].sort((a, b) => {
      if (sortMode === "smart") return compareSmart(a, b);
      if (sortMode === "nameAsc") return a.fullName.localeCompare(b.fullName);
      if (sortMode === "expiryAsc") return rowToSortTime(a, true) - rowToSortTime(b, true);
      if (sortMode === "expiryDesc") return rowToSortTime(b, false) - rowToSortTime(a, false);
      return 0;
    });

    return sorted;
  }, [athleteRows, quickFilter, searchAthlete, sortMode]);

  const quickFilterCounts = useMemo(() => {
    const map: Record<QuickFilter, number> = {
      all: athleteRows.length,
      expired: 0,
      today: 0,
      soon: 0,
      active: 0,
    };

    athleteRows.forEach((row) => {
      if (matchesQuickFilter(row, "expired")) map.expired += 1;
      if (matchesQuickFilter(row, "today")) map.today += 1;
      if (matchesQuickFilter(row, "soon")) map.soon += 1;
      if (matchesQuickFilter(row, "active")) map.active += 1;
    });

    return map;
  }, [athleteRows]);

  useEffect(() => {
    const loadAlreadyAssigned = async () => {
      if (!selectedTemplate || athletes.length === 0) {
        setAlreadyAssignedMap({});
        return;
      }

      const checks = await Promise.all(
        athletes.map(async (a) => {
          const dupSnap = await getDocs(
            query(
              collection(db, "users", a.uid, "weeks"),
              where("templateId", "==", selectedTemplate)
            )
          );
          return [a.uid, !dupSnap.empty] as const;
        })
      );

      const map: Record<string, boolean> = {};
      checks.forEach(([uid, assigned]) => {
        map[uid] = assigned;
      });
      setAlreadyAssignedMap(map);
    };

    loadAlreadyAssigned();
  }, [athletes, selectedTemplate]);

  const setExpiry = async (uid: string, dateStr: string) => {
    // dateStr = YYYY-MM-DD
    const expires = new Date(`${dateStr}T00:00:00`);
    await updateDoc(doc(db, "users", uid), {
      subscriptionExpiresAt: expires,
      updatedAt: serverTimestamp(),
    });
  };

  const assignTemplateToAthlete = async (athlete: Athlete) => {
    const uid = athlete.uid;

    if (isSubscriptionExpired(athlete.subscriptionExpiresAt)) {
      setConfirmMessage("Abbonamento atleta scaduto: non puoi assegnare settimane.");
      setConfirmType("warning");
      return;
    }

    if (!selectedTemplate) {
      setConfirmMessage("Nessun template selezionato.");
      setConfirmType("error");
      return;
    }

    const dupSnap = await getDocs(
      query(
        collection(db, "users", uid, "weeks"),
        where("templateId", "==", selectedTemplate)
      )
    );

    if (!dupSnap.empty) {
      setConfirmMessage("Questa settimana è già assegnata a questo atleta.");
      setConfirmType("warning");
      setAlreadyAssignedMap((p) => ({ ...p, [uid]: true }));
      return;
    }

    // crea una nuova week assegnata all'atleta
    const weekRef = await addDoc(collection(db, "users", uid, "weeks"), {
      templateId: selectedTemplate,
      title: templateTitle || "Settimana",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await createInAppNotification(uid, {
      type: "week_assigned",
      title: "Nuova settimana assegnata",
      message: `Il coach ti ha assegnato ${templateTitle || "una settimana"}.`,
      link: `/athlete/week/${weekRef.id}`,
    });

    setConfirmMessage("Template assegnato ✅");
    setConfirmType("success");
    setAlreadyAssignedMap((p) => ({ ...p, [uid]: true }));
  };

  const deleteAthlete = async (athlete: Athlete) => {
    try {
      setDeletingUid(athlete.uid);

      const weeksRef = collection(db, "users", athlete.uid, "weeks");
      const weeksSnap = await getDocs(weeksRef);
      await Promise.all(weeksSnap.docs.map((weekDoc) => deleteDoc(weekDoc.ref)));

      await deleteDoc(doc(db, "users", athlete.uid));

      setConfirmMessage("Atleta eliminato ✅");
      setConfirmType("success");
    } catch (error) {
      setConfirmMessage("Errore durante l'eliminazione dell'atleta.");
      setConfirmType("error");
    } finally {
      setDeletingUid("");
      setAthleteToDelete(null);
    }
  };

  const requestDeleteAthlete = (athlete: Athlete) => {
    setAthleteToDelete(athlete);
  };

  return (
    <>
      <TopBar title="Gestisci Atleti" />
      <div className="container">
        <div className="card" style={{ marginTop: 20 }}>
          <label style={{ display: "block", fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
            Cerca atleta
          </label>
          <div className="coachAthletesToolbar">
            <input
              className="input"
              type="text"
              placeholder="Cerca per nome o email"
              value={searchAthlete}
              onChange={(e) => setSearchAthlete(e.target.value)}
            />

            <select
              className="input"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
            >
              <option value="smart">Ordina: intelligente</option>
              <option value="expiryAsc">Scadenza: prima le vicine</option>
              <option value="expiryDesc">Scadenza: prima le lontane</option>
              <option value="nameAsc">Nome: A-Z</option>
            </select>
          </div>

          <div className="quickFilterRow">
            <button
              className={`btn quickFilterBtn ${quickFilter === "all" ? "quickFilterBtnActive" : ""}`}
              onClick={() => setQuickFilter("all")}
            >
              Tutti ({quickFilterCounts.all})
            </button>
            <button
              className={`btn quickFilterBtn ${quickFilter === "expired" ? "quickFilterBtnActive" : ""}`}
              onClick={() => setQuickFilter("expired")}
            >
              Scaduti ({quickFilterCounts.expired})
            </button>
            <button
              className={`btn quickFilterBtn ${quickFilter === "today" ? "quickFilterBtnActive" : ""}`}
              onClick={() => setQuickFilter("today")}
            >
              Oggi ({quickFilterCounts.today})
            </button>
            <button
              className={`btn quickFilterBtn ${quickFilter === "soon" ? "quickFilterBtnActive" : ""}`}
              onClick={() => setQuickFilter("soon")}
            >
              ≤ 7 giorni ({quickFilterCounts.soon})
            </button>
            <button
              className={`btn quickFilterBtn ${quickFilter === "active" ? "quickFilterBtnActive" : ""}`}
              onClick={() => setQuickFilter("active")}
            >
              Attivi ({quickFilterCounts.active})
            </button>
          </div>

          <h2>Assegna settimana</h2>
          <p style={{ opacity: 0.8 }}>
            Seleziona una settimana e poi assegnala agli atleti che vuoi.
          </p>

          <select
            className="input selectPremium"
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

        {filteredAthletes.map((row) => {
          const a = row.athlete;
          const alreadyAssigned = !!alreadyAssignedMap[a.uid];
          const expired = row.expired;
          const expiry = row.expiry;
          const daysUntilExpiry = row.daysUntilExpiry;
          const status = getStatusInfo(expired, daysUntilExpiry);

          const expiryValue = expiry ? toDateInputValue(expiry) : "";

          return (
            <div key={a.uid} className="card" style={{ marginTop: 16 }}>
              <h3 style={{ marginBottom: 6 }}>
                {row.fullName}
              </h3>
              <div style={{ marginBottom: 12 }}>
                <span className={`badge subscriptionBadge subscriptionBadge_${status.kind}`}>
                  {status.label}
                </span>
              </div>

              <div className="athleteCardControls">
                <div className="athleteExpiryBlock">
                  <label style={{ fontSize: 12, opacity: 0.75 }}>Scadenza abbonamento</label>
                  <input
                    className="input"
                    type="date"
                    defaultValue={expiryValue}
                    onBlur={(e) => {
                      if (e.target.value) setExpiry(a.uid, e.target.value);
                    }}
                  />
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    {status.detail}
                  </div>
                </div>

                <button
                  className="btn"
                  onClick={() => assignTemplateToAthlete(a)}
                  disabled={alreadyAssigned || expired}
                  title={
                    expired
                      ? "Abbonamento scaduto"
                      : alreadyAssigned
                      ? "Settimana già assegnata"
                      : "Assegna settimana"
                  }
                >
                  {expired ? "Abbonamento scaduto" : alreadyAssigned ? "Già assegnata" : "Assegna settimana"}
                </button>

                <button
                  className="btn"
                  onClick={() => router.push(`/coach/progress?athleteUid=${a.uid}`)}
                >
                  Vedi risultati
                </button>

                <button
                  className="btn btnDanger"
                  onClick={() => requestDeleteAthlete(a)}
                  disabled={deletingUid === a.uid}
                >
                  {deletingUid === a.uid ? "Eliminazione..." : "Elimina atleta"}
                </button>
              </div>
            </div>
          );
        })}

        {filteredAthletes.length === 0 && (
          <div className="card" style={{ marginTop: 16 }}>
            {athletes.length === 0
              ? "Nessun atleta trovato."
              : "Nessun atleta corrisponde ai filtri o alla ricerca."}
          </div>
        )}
      </div>

      {athleteToDelete && (
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
          onClick={() => {
            if (!deletingUid) setAthleteToDelete(null);
          }}
        >
          <div
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.08))",
              border: "1px solid rgba(255,255,255,0.16)",
              borderRadius: 18,
              padding: 24,
              width: "min(92vw, 460px)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
              ⚠️ Conferma eliminazione
            </div>
            <div style={{ color: "rgba(245,245,247,0.75)", marginBottom: 20 }}>
              Vuoi eliminare
              {" "}
              {athleteToDelete.firstName && athleteToDelete.lastName
                ? `${athleteToDelete.firstName} ${athleteToDelete.lastName}`
                : athleteToDelete.email || "questo atleta"}
              ?
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                className="btn"
                onClick={() => setAthleteToDelete(null)}
                disabled={!!deletingUid}
              >
                Annulla
              </button>
              <button
                className="btn btnDanger"
                onClick={() => deleteAthlete(athleteToDelete)}
                disabled={!!deletingUid}
              >
                {deletingUid ? "Eliminazione..." : "Elimina atleta"}
              </button>
            </div>
          </div>
        </div>
      )}

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