import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { RoleGuard } from "../../components/RoleGuard";
import { TopBar } from "../../components/TopBar";
import { db } from "../../lib/firebase";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";

type PrKind = "time" | "weight";
type PrFilter = "all" | "time" | "weight";

type PrItem = {
  id: string;
  name: string;
  kind: PrKind;
  timeValue?: string;
  timeSeconds?: number;
  weightKg?: number;
  reps?: number;
  recordedAt?: any;
  updatedAt?: any;
  createdAt?: any;
};

function toDateLabel(raw: any) {
  const date = raw?.toDate?.() instanceof Date
    ? raw.toDate()
    : raw instanceof Date
    ? raw
    : null;

  if (!date) return "Data non disponibile";

  return date.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getKindUi(kind: PrKind) {
  if (kind === "time") {
    return {
      badge: { borderColor: "var(--accent)", background: "rgba(100,149,237,0.2)" },
      card: { borderColor: "rgba(100,149,237,0.45)" },
    };
  }

  return {
    badge: { borderColor: "rgba(255,170,70,0.65)", background: "rgba(255,170,70,0.2)" },
    card: { borderColor: "rgba(255,170,70,0.45)" },
  };
}

function formatTimeValue(totalSeconds?: number, fallback?: string) {
  if (Number.isFinite(totalSeconds) && (totalSeconds as number) >= 0) {
    const minutes = Math.floor((totalSeconds as number) / 60);
    const seconds = Math.floor((totalSeconds as number) % 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return fallback || "00:00";
}

export default function CoachAthletePrPage() {
  return (
    <RoleGuard role="coach">
      <CoachAthletePrInner />
    </RoleGuard>
  );
}

function CoachAthletePrInner() {
  const router = useRouter();
  const athleteUid = router.query.athleteUid as string;

  const [athleteName, setAthleteName] = useState("Atleta");
  const [filter, setFilter] = useState<PrFilter>("all");
  const [searchText, setSearchText] = useState("");
  const [items, setItems] = useState<PrItem[]>([]);
  const [loadError, setLoadError] = useState("");

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

    const q = query(collection(db, "users", athleteUid, "prs"), orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLoadError("");
        setItems(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          })) as PrItem[]
        );
      },
      (error) => {
        setItems([]);
        setLoadError(error.message);
      }
    );

    return () => unsub();
  }, [athleteUid]);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    return items.filter((item) => {
      const matchesFilter = filter === "all" ? true : item.kind === filter;
      if (!matchesFilter) return false;
      if (!q) return true;

      return (item.name || "").toLowerCase().includes(q);
    });
  }, [filter, items, searchText]);

  return (
    <>
      <TopBar title={`PR atleta: ${athleteName}`} />
      <div className="container">
        <div className="card" style={{ marginTop: 20 }}>
          <h2>Visualizza PR</h2>

          {loadError && (
            <div style={{ marginTop: 10, color: "#ff6b6b" }}>
              Errore caricamento PR: {loadError}
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <input
              className="input"
              placeholder="Cerca PR per nome..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <div className="quickFilterRow" style={{ marginTop: 12 }}>
            <button
              className={`btn quickFilterBtn ${filter === "all" ? "quickFilterBtnActive" : ""}`}
              onClick={() => setFilter("all")}
            >
              Tutti ({items.length})
            </button>
            <button
              className={`btn quickFilterBtn ${filter === "time" ? "quickFilterBtnActive" : ""}`}
              onClick={() => setFilter("time")}
            >
              WOD tempo ({items.filter((item) => item.kind === "time").length})
            </button>
            <button
              className={`btn quickFilterBtn ${filter === "weight" ? "quickFilterBtnActive" : ""}`}
              onClick={() => setFilter("weight")}
            >
              PR di chili ({items.filter((item) => item.kind === "weight").length})
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="card" style={{ marginTop: 16, opacity: 0.8 }}>
            Nessun PR trovato.
          </div>
        ) : (
          <div className="stack" style={{ marginTop: 16 }}>
            {filtered.map((item) => (
              <div key={item.id} className="card" style={getKindUi(item.kind || "time").card}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ margin: 0 }}>{item.name || "PR"}</h3>
                  <span className="badge" style={getKindUi(item.kind || "time").badge}>
                    {item.kind === "time" ? "WOD tempo" : "PR chili"}
                  </span>
                </div>

                <div style={{ marginTop: 10 }}>
                  {item.kind === "time" ? (
                    <div>Tempo: <strong>{formatTimeValue(item.timeSeconds, item.timeValue)}</strong></div>
                  ) : (
                    <div>
                      <strong>{item.weightKg ?? "-"} kg</strong>
                      {item.reps ? ` x ${item.reps} reps` : ""}
                    </div>
                  )}
                </div>

                <div className="small" style={{ marginTop: 8 }}>
                  Data registrazione: {toDateLabel(item.recordedAt || item.updatedAt || item.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
