import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { RoleGuard } from "../../components/RoleGuard";
import { TopBar } from "../../components/TopBar";
import { db } from "../../lib/firebase";
import { useSession } from "../../lib/session";

type PrItem = {
  id: string;
  name: string;
  weightKg?: number;
  reps?: number;
  timeSeconds?: number;
  recordedAt?: any;
  createdAt?: any;
};

type BenchmarkGroup = "weightlifting & strength" | "gymnastic" | "monostructural" | "crossfit";

const GROUP_LABELS: Record<BenchmarkGroup, string> = {
  "weightlifting & strength": "Weightlifting & Strength",
  gymnastic: "Gymnastic",
  monostructural: "Monostructural",
  crossfit: "CrossFit",
};

function normalizeName(raw: string) {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function getBenchmarkGroup(name: string): BenchmarkGroup | null {
  const normalized = normalizeName(name);

  const weightliftingWords = ["back squat", "front squat", "squat", "deadlift", "bench press", "bench", "overhead press", "press", "clean", "snatch", "jerk", "thruster", "row", "pull", "dip"]; 
  const gymnasticWords = ["pull-up", "pull up", "muscle-up", "muscle up", "ring dip", "handstand", "toes to bar", "toes-to-bar", "hspu", "kipping", "strict pull-up", "chest to bar"]; 
  const monostructuralWords = ["rower", "bike", "ski", "assault", "run", "marathon", "distance", "interval"]; 
  const crossfitWords = ["fran", "grace", "helen", "cindy", "murph", "filthy fifty", "wod", "amrap", "emom", "benchmark"]; 

  if (weightliftingWords.some((word) => normalized.includes(word))) return "weightlifting & strength";
  if (gymnasticWords.some((word) => normalized.includes(word))) return "gymnastic";
  if (monostructuralWords.some((word) => normalized.includes(word))) return "monostructural";
  if (crossfitWords.some((word) => normalized.includes(word))) return "crossfit";
  return null;
}

function getMetricValue(item: PrItem): number | null {
  if (typeof item.weightKg === "number" && Number.isFinite(item.weightKg)) return item.weightKg;
  if (typeof item.timeSeconds === "number" && Number.isFinite(item.timeSeconds)) return item.timeSeconds;
  return null;
}

function formatMetric(item: PrItem) {
  if (typeof item.weightKg === "number" && Number.isFinite(item.weightKg)) {
    return `${item.weightKg.toFixed(1).replace(".0", "")} kg`;
  }

  if (typeof item.timeSeconds === "number" && Number.isFinite(item.timeSeconds)) {
    const minutes = Math.floor(item.timeSeconds / 60);
    const seconds = Math.floor(item.timeSeconds % 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  if (item.reps) {
    return `${item.reps} reps`;
  }

  return "N/D";
}

function formatChartDate(raw: any) {
  const date = raw?.toDate?.() instanceof Date ? raw.toDate() : raw instanceof Date ? raw : null;
  if (!date) return "";
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
}

function getCategoryEntries(items: PrItem[], group: BenchmarkGroup) {
  return items
    .filter((item) => getBenchmarkGroup(item.name) === group && getMetricValue(item) !== null)
    .sort((a, b) => {
      const at = a.recordedAt?.toDate?.()?.getTime?.() || a.createdAt?.toDate?.()?.getTime?.() || 0;
      const bt = b.recordedAt?.toDate?.()?.getTime?.() || b.createdAt?.toDate?.()?.getTime?.() || 0;
      return bt - at;
    })
    .slice(0, 5);
}

export default function AthleteBenchmarksPage() {
  const { user } = useSession();
  const [items, setItems] = useState<PrItem[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<BenchmarkGroup | "all">("all");

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(collection(db, "users", user.uid, "prs"), orderBy("recordedAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const next = snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as any),
      })) as PrItem[];
      setItems(next);
    });

    return () => unsub();
  }, [user?.uid]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, PrItem[]> = {
      "weightlifting & strength": getCategoryEntries(items, "weightlifting & strength"),
      gymnastic: getCategoryEntries(items, "gymnastic"),
      monostructural: getCategoryEntries(items, "monostructural"),
      crossfit: getCategoryEntries(items, "crossfit"),
    };

    return groups;
  }, [items]);

  const chartData = useMemo(() => {
    const source = selectedGroup === "all"
      ? items.filter((item) => getBenchmarkGroup(item.name) !== null && getMetricValue(item) !== null)
      : items.filter((item) => getBenchmarkGroup(item.name) === selectedGroup && getMetricValue(item) !== null);

    const sorted = [...source].sort((a, b) => {
      const at = a.recordedAt?.toDate?.()?.getTime?.() || a.createdAt?.toDate?.()?.getTime?.() || 0;
      const bt = b.recordedAt?.toDate?.()?.getTime?.() || b.createdAt?.toDate?.()?.getTime?.() || 0;
      return at - bt;
    });

    if (sorted.length === 0) return [];

    const values = sorted.map((item) => getMetricValue(item) as number);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    return sorted.map((item, index) => {
      const value = getMetricValue(item) as number;
      const x = sorted.length === 1 ? 50 : (index / (sorted.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 70 - 10;
      return { ...item, x, y, value };
    });
  }, [items, selectedGroup]);

  const chartPath = chartData.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <RoleGuard role="athlete">
      <TopBar title="Massimali" />
      <div className="container">
        <div className="card" style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <div>
              <div style={{ opacity: 0.75, textTransform: "uppercase", letterSpacing: 1.2, fontSize: 12 }}>Performance</div>
              <h2 style={{ margin: "6px 0 0" }}>Massimali & benchmark</h2>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className={`btn ${selectedGroup === "all" ? "btnPrimary" : ""}`} onClick={() => setSelectedGroup("all")}>Tutto</button>
              {Object.keys(GROUP_LABELS).map((key) => (
                <button
                  key={key}
                  className={`btn ${selectedGroup === key ? "btnPrimary" : ""}`}
                  onClick={() => setSelectedGroup(key as BenchmarkGroup | "all")}
                >
                  {GROUP_LABELS[key as BenchmarkGroup]}
                </button>
              ))}
            </div>
          </div>

          {chartData.length === 0 ? (
            <div style={{ opacity: 0.8 }}>Nessun benchmark registrato ancora. Aggiungi un PR dal modulo massimali.</div>
          ) : (
            <>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: 220, background: "rgba(255,255,255,0.02)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)" }}>
                <defs>
                  <linearGradient id="benchmarkStroke" x1="0" x2="1">
                    <stop offset="0%" stopColor="#7dd3fc" />
                    <stop offset="100%" stopColor="#2f86c7" />
                  </linearGradient>
                </defs>
                <polyline
                  fill="none"
                  stroke="url(#benchmarkStroke)"
                  strokeWidth="2.6"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={chartPath}
                />
                {chartData.map((point) => (
                  <g key={point.id + '-' + point.recordedAt + '-' + point.value}>
                    <circle cx={point.x} cy={point.y} r="2.1" fill="#f8fafc" />
                    <text x={point.x} y="95" textAnchor="middle" fontSize="4" fill="rgba(255,255,255,0.7)">{formatChartDate(point.recordedAt)}</text>
                  </g>
                ))}
              </svg>
              <div style={{ marginTop: 12, opacity: 0.8, fontSize: 14 }}>
                {selectedGroup === "all" ? "Andamento generale dei benchmark" : `${GROUP_LABELS[selectedGroup as BenchmarkGroup]} trend`}
              </div>
            </>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18, marginTop: 20 }}>
          {Object.entries(GROUP_LABELS).map(([key, label]) => {
            const entries = groupedItems[key] || [];
            return (
              <div key={key} className="card">
                <h3 style={{ marginTop: 0 }}>{label}</h3>
                {entries.length === 0 ? (
                  <div style={{ opacity: 0.7 }}>Nessun dato</div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {entries.map((item) => (
                      <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.04)" }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{item.name}</div>
                          <div style={{ opacity: 0.7, fontSize: 12 }}>{formatChartDate(item.recordedAt) || "Data non disponibile"}</div>
                        </div>
                        <strong>{formatMetric(item)}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <Link href="/athlete-home" className="btn">Home</Link>
          <Link href="/athlete/pr" className="btn btnPrimary">Aggiungi PR</Link>
        </div>
      </div>
    </RoleGuard>
  );
}
