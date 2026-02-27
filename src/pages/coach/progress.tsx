import { useRouter } from "next/router";
import { RoleGuard } from "../../components/RoleGuard";
import { TopBar } from "../../components/TopBar";
import { db } from "../../lib/firebase";
import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

type ResultEntry = {
  key: string;
  source: "entries" | "weekResults";
  id: string;
  weekId?: string;
  weekTitle?: string;
  dayId?: string;
  workoutId?: string;
  workoutTitle?: string;
  dayLabel?: string;
  value?: {
    weightKg?: number;
    reps?: number;
    timeSeconds?: number;
    notes?: string;
  };
  result?: string;
  coachComment?: string;
  updatedAt?: any;
};

function ProgressInner() {
  const router = useRouter();
  const athleteUid = router.query.athleteUid as string;
  const [athleteName, setAthleteName] = useState("Atleta");
  const [entryResults, setEntryResults] = useState<ResultEntry[]>([]);
  const [legacyResults, setLegacyResults] = useState<ResultEntry[]>([]);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  const results = [...entryResults, ...legacyResults].sort((a, b) => {
    const at = a.updatedAt?.toDate?.()?.getTime?.() || 0;
    const bt = b.updatedAt?.toDate?.()?.getTime?.() || 0;
    return bt - at;
  });

  useEffect(() => {
    if (!athleteUid) return;

    const loadAthlete = async () => {
      const userSnap = await getDoc(doc(db, "users", athleteUid));
      if (!userSnap.exists()) return;
      const data = userSnap.data() as any;
      const fullName =
        data.firstName && data.lastName
          ? `${data.firstName} ${data.lastName}`
          : data.email || "Atleta";
      setAthleteName(fullName);
    };

    loadAthlete();

    const q = query(
      collection(db, "results", athleteUid, "entries"),
      orderBy("createdAt", "desc")
    );
    const unsubEntries = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          key: `entries:${d.id}`,
          source: "entries" as const,
          id: d.id,
          ...data,
          weekTitle: data.weekTitle || undefined,
        };
      }) as ResultEntry[];
      setEntryResults(items);

      setCommentDrafts((prev) => {
        const next = { ...prev };
        for (const r of items) {
          if (next[r.key] === undefined) {
            next[r.key] = r.coachComment || "";
          }
        }
        return next;
      });
    });

    const unsubWeeks = onSnapshot(collection(db, "users", athleteUid, "weeks"), async (weeksSnap) => {
      const list: ResultEntry[] = [];

      for (const w of weeksSnap.docs) {
        const weekId = w.id;
        const wData = w.data() as any;
        const weekTitle = wData.title || "Settimana";

        let dayOrderMap: Record<string, number> = {};
        try {
          if (wData.templateId) {
            const daySnap = await getDocs(collection(db, "programTemplates", wData.templateId, "days"));
            daySnap.docs.forEach((d) => {
              dayOrderMap[d.id] = Number((d.data() as any).order ?? 0);
            });
          }
        } catch {
          dayOrderMap = {};
        }

        const resSnap = await getDocs(collection(db, "users", athleteUid, "weeks", weekId, "results"));
        resSnap.docs.forEach((r) => {
          const data = r.data() as any;
          const dayOrder = dayOrderMap[r.id] || data.dayOrder;
          list.push({
            key: `week:${weekId}:${r.id}`,
            source: "weekResults",
            id: r.id,
            weekId,
            weekTitle,
            dayId: r.id,
            dayLabel: dayOrder ? `Giorno ${dayOrder}` : `Giorno ${r.id}`,
            result: data.result || "",
            coachComment: data.coachComment || "",
            updatedAt: data.updatedAt,
          });
        });
      }

      setLegacyResults(list);
      setCommentDrafts((prev) => {
        const next = { ...prev };
        for (const r of list) {
          if (next[r.key] === undefined) {
            next[r.key] = r.coachComment || "";
          }
        }
        return next;
      });
    });

    return () => {
      unsubEntries();
      unsubWeeks();
    };
  }, [athleteUid]);

  const saveComment = async (result: ResultEntry) => {
    const text = (commentDrafts[result.key] || "").trim();

    if (result.source === "entries") {
      await updateDoc(doc(db, "results", athleteUid, "entries", result.id), {
        coachComment: text,
        coachCommentAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    if (result.weekId) {
      await updateDoc(doc(db, "users", athleteUid, "weeks", result.weekId, "results", result.id), {
        coachComment: text,
        coachCommentAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  };

  return (
    <>
      <TopBar title={`Risultati: ${athleteName}`} />
      <div className="container">
        {results.length === 0 ? (
          <div className="card">Nessun risultato inserito dall'atleta.</div>
        ) : (
          <div className="stack">
            {results.map((r) => (
              <div key={r.id} className="card">
                <div className="small" style={{ marginBottom: 8 }}>
                  {r.weekTitle ? `${r.weekTitle} • ` : ""}{(r.dayLabel || r.dayId || "Giorno")} • {r.workoutTitle || r.workoutId || "Workout"}
                </div>

                <div className="row" style={{ gap: 8, marginBottom: 10 }}>
                  {r.value?.weightKg !== undefined && <span className="badge">Peso: {r.value.weightKg} kg</span>}
                  {r.value?.reps !== undefined && <span className="badge">Reps: {r.value.reps}</span>}
                  {r.value?.timeSeconds !== undefined && <span className="badge">Tempo: {r.value.timeSeconds}s</span>}
                </div>

                {r.value?.notes && (
                  <div className="small" style={{ marginBottom: 12 }}>
                    Note atleta: {r.value.notes}
                  </div>
                )}

                <textarea
                  className="textarea"
                  placeholder="Scrivi un commento per l'atleta..."
                  value={commentDrafts[r.key] ?? ""}
                  onChange={(e) =>
                    setCommentDrafts((p) => ({
                      ...p,
                      [r.key]: e.target.value,
                    }))
                  }
                />

                {r.result && (
                  <div className="small" style={{ marginTop: 8 }}>
                    Risultato atleta: {r.result}
                  </div>
                )}

                <div className="row" style={{ marginTop: 10 }}>
                  <button className="btn btnPrimary" onClick={() => saveComment(r)}>
                    Salva commento
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function Progress() {
  return (
    <RoleGuard role="coach">
      <ProgressInner />
    </RoleGuard>
  );
}