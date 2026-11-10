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

type PrKind = "time" | "weight" | "reps";
type BenchmarkGroup = "weightlifting-strength" | "gymnastic" | "monostructural" | "crossfit";
type PrFilter = "all" | "time" | "weight" | "reps";
type PrSort = "alpha" | "oldest" | "newest";

type PrItem = {
  id: string;
  name: string;
  kind: PrKind;
  category?: BenchmarkGroup;
  timeValue?: string;
  timeSeconds?: number;
  weightKg?: number;
  reps?: number;
  recordedAt?: any;
  updatedAt?: any;
  createdAt?: any;
};

type GroupMeta = {
  label: string;
  color: string;
  examples: string[];
};

const GROUP_ORDER: readonly BenchmarkGroup[] = [
  "weightlifting-strength",
  "gymnastic",
  "monostructural",
  "crossfit",
];

const GROUP_META: Record<BenchmarkGroup, GroupMeta> = {
  "weightlifting-strength": {
    label: "Weightlifting & Strength",
    color: "#2f86c7",
    examples: ["Back Squat", "Deadlift", "Bench Press", "Snatch", "Clean & Jerk", "Thruster", "Power Clean", "Good Morning", "Bulgarian Split Squat", "Pendlay Row"],
  },
  gymnastic: {
    label: "Gymnastic",
    color: "#AEB6C2",
    examples: ["Pull-Up", "Muscle-Up", "Toes to Bar", "HSPU", "Rope Climb", "Strict Pull-Up", "Ring Dip", "L-Sit", "Front Lever", "Pistol Squat"],
  },
  monostructural: {
    label: "Monostructural",
    color: "#2A2F38",
    examples: ["1 Mile Run", "5k Run", "10k Run", "Row 2000m", "Row 500m", "Bike Erg 20 min", "SkiErg 1500m", "Run 400m", "Run 800m", "Bike Erg 30 min"],
  },
  crossfit: {
    label: "CrossFit",
    color: "#2f86c7",
    examples: ["Fran", "Murph", "Cindy", "Helen", "Grace", "Jackie", "Barbara", "Chelsea", "Mary", "Manion"],
  },
};

const BENCHMARK_LIBRARY: Record<BenchmarkGroup, string[]> = {
  "weightlifting-strength": [
    "Back Squat",
    "Front Squat",
    "Goblet Squat",
    "Bulgarian Split Squat",
    "Deadlift",
    "Romanian Deadlift",
    "Rack Pull",
    "Bench Press",
    "Overhead Press",
    "Strict Press",
    "Push Press",
    "Power Clean",
    "Hang Clean",
    "Clean & Jerk",
    "Snatch",
    "Power Snatch",
    "Hang Snatch",
    "Thruster",
    "Barbell Row",
    "Pendlay Row",
    "Good Morning",
    "Weighted Pull-Up",
    "Strict Dip",
    "Lunge",
  ],
  gymnastic: [
    "Pull-Up",
    "Strict Pull-Up",
    "Butterfly Pull-Up",
    "Deficit Pull-Up",
    "Kipping Pull-Up",
    "Muscle-Up",
    "Ring Muscle-Up",
    "Toes to Bar",
    "Chest to Bar",
    "Ring Dip",
    "Strict Dip",
    "HSPU",
    "Rope Climb",
    "Handstand Walk",
    "Pistol Squat",
    "L-Sit",
    "Front Lever",
    "Back Lever",
    "Dragon Flag",
    "Human Flag",
    "Walking Lunge Hold",
  ],
  monostructural: [
    "1 Mile Run",
    "Run 400m",
    "Run 800m",
    "Run 1500m",
    "5k Run",
    "10k Run",
    "Row 500m",
    "Row 750m",
    "Row 1000m",
    "Row 1500m",
    "Row 2000m",
    "SkiErg 500m",
    "SkiErg 1000m",
    "SkiErg 1500m",
    "Bike Erg 10 min",
    "Bike Erg 20 min",
    "Bike Erg 30 min",
    "Bike Erg 40 min",
    "Assault Bike 5 min",
    "Assault Bike 10 min",
    "Assault Bike 15 min",
  ],
  crossfit: [
    "Fran",
    "Helen",
    "Grace",
    "Murph",
    "Cindy",
    "Annie",
    "Diane",
    "Nancy",
    "DT",
    "Isabel",
    "Fight Gone Bad",
    "Filthy Fifty",
    "Linda",
    "The Chipper",
    "Jackie",
    "Barbara",
    "Chelsea",
    "Mary",
    "Manion",
    "Kalsu",
    "Nate",
    "Amanda",
    "Lynne",
    "Randy",
    "Meredith",
    "Morrison",
    "Mikko",
    "McGhee",
  ],
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

  for (const group of GROUP_ORDER) {
    const match = BENCHMARK_LIBRARY[group].find((entry) => {
      const target = normalizeName(entry);
      return normalized === target || normalized.includes(target) || target.includes(normalized);
    });
    if (match) return group;
  }

  const keywords: Array<[BenchmarkGroup, string[]]> = [
    ["weightlifting-strength", ["squat", "deadlift", "bench", "press", "clean", "snatch", "jerk", "thruster", "row", "pull", "rack", "good morning", "split squat", "lunge", "pendlay", "power clean", "hang clean", "goblet squat", "bulgarian split squat", "strict dip"]],
    ["gymnastic", ["pull-up", "muscle-up", "ring", "hspu", "dip", "rope climb", "handstand", "toes to bar", "chest to bar", "pistol", "front lever", "back lever", "dragon flag", "human flag", "l-sit", "butterfly", "deficit", "ring dip"]],
    ["monostructural", ["run", "row", "bike", "ski", "assault", "mile", "5k", "10k", "500m", "750m", "1000m", "1500m", "2000m", "400m", "800m", "assault bike"]],
    ["crossfit", ["fran", "helen", "grace", "murph", "cindy", "annie", "diane", "fight gone bad", "filthy fifty", "wod", "jackie", "barbara", "chelsea", "mary", "manion", "kalsu", "nate", "amanda", "lynne", "randy", "morrison", "mikko", "mcghee"]],
  ];

  for (const [group, words] of keywords) {
    if (words.some((word) => normalized.includes(word))) return group;
  }

  return null;
}

function toDateLabel(raw: any) {
  const date = raw?.toDate?.() instanceof Date ? raw.toDate() : raw instanceof Date ? raw : null;
  if (!date) return "Data non disponibile";
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatTimeValue(totalSeconds?: number, fallback?: string) {
  if (Number.isFinite(totalSeconds) && totalSeconds >= 0) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return fallback || "00:00";
}

function formatKg(value?: number | null) {
  if (!Number.isFinite(value as number)) return "-";
  return new Intl.NumberFormat("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value as number);
}

function toNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function estimateOneRepMax(weightKg?: number, reps?: number) {
  if (!Number.isFinite(weightKg) || (weightKg as number) <= 0) return null;
  const safeReps = Number.isFinite(reps) && (reps as number) > 0 ? Math.round(reps as number) : 1;
  if (safeReps <= 1) return weightKg as number;
  return (weightKg as number) * (1 + safeReps / 30);
}

function roundToIncrement(value: number, increment?: number | null) {
  if (!Number.isFinite(value)) return null;
  if (!Number.isFinite(increment) || increment <= 0) return value;
  return Math.round(value / increment) * increment;
}

function getKindUi(kind: PrKind) {
  const palette = {
    time: {
      badge: { borderColor: "rgba(47,134,199,0.6)", background: "rgba(47,134,199,0.14)" },
      card: { borderColor: "rgba(47,134,199,0.35)" },
    },
    weight: {
      badge: { borderColor: "rgba(47,134,199,0.6)", background: "rgba(47,134,199,0.14)" },
      card: { borderColor: "rgba(47,134,199,0.35)" },
    },
    reps: {
      badge: { borderColor: "rgba(105,180,238,0.6)", background: "rgba(105,180,238,0.1)" },
      card: { borderColor: "rgba(105,180,238,0.35)" },
    },
  };
  return palette[kind] || palette.time;
}

function toMillis(raw: any) {
  if (raw?.toDate && typeof raw.toDate === "function") {
    const parsed = raw.toDate();
    return parsed instanceof Date && Number.isFinite(parsed.getTime()) ? parsed.getTime() : 0;
  }
  if (raw instanceof Date) {
    return Number.isFinite(raw.getTime()) ? raw.getTime() : 0;
  }
  return 0;
}

function getMetric(item: PrItem): number | null {
  if (typeof item.weightKg === "number" && Number.isFinite(item.weightKg)) return item.weightKg;
  if (typeof item.reps === "number" && Number.isFinite(item.reps)) return item.reps;
  if (typeof item.timeSeconds === "number" && Number.isFinite(item.timeSeconds)) return item.timeSeconds;
  return null;
}

function shortenRadarLabel(label: string, maxLength = 12) {
  const clean = label.trim().replace(/\s+/g, " ");
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trim()}…`;
}

function buildRadarSeries(items: PrItem[], group: BenchmarkGroup) {
  const groupItems = items.filter((item) => (item.category ?? getBenchmarkGroup(item.name)) === group && getMetric(item) !== null);
  if (groupItems.length === 0) {
    return { values: [0, 0, 0, 0], labels: ["-", "-", "-", "-"] };
  }

  const sample = [...groupItems]
    .sort((a, b) => {
      const timeA = a.recordedAt?.toDate?.()?.getTime?.() || a.createdAt?.toDate?.()?.getTime?.() || 0;
      const timeB = b.recordedAt?.toDate?.()?.getTime?.() || b.createdAt?.toDate?.()?.getTime?.() || 0;
      return timeB - timeA;
    })
    .slice(0, 6);

  const valid = sample.map((item) => ({
    label: item.name,
    value: getMetric(item) as number,
    kind: item.kind,
  }));

  const values = valid.map((entry) => {
    const numbers = valid.map((it) => it.value);
    const min = Math.min(...numbers);
    const max = Math.max(...numbers);
    const range = max - min || 1;
    const normalized = (entry.value - min) / range;
    if (entry.kind === "time") {
      return Math.round(100 - normalized * 100);
    }
    return Math.round(normalized * 100);
  });

  return {
    values: values.length ? values : [0, 0, 0, 0],
    labels: valid.map((entry) => shortenRadarLabel(entry.label)),
  };
}

function renderRadar(values: number[], labels: string[], color: string) {
  const centerX = 60;
  const centerY = 60;
  const radius = 42;
  const labelRadius = 54;
  const minVisibleRadius = 4;
  const points = values.map((value, index) => {
    const angle = -Math.PI / 2 + (index / values.length) * Math.PI * 2;
    const normalized = Math.max(0, Math.min(value, 100)) / 100;
    const r = Math.max(minVisibleRadius, normalized * radius);
    return {
      x: centerX + Math.cos(angle) * r,
      y: centerY + Math.sin(angle) * r,
      labelX: centerX + Math.cos(angle) * labelRadius,
      labelY: centerY + Math.sin(angle) * labelRadius,
    };
  });

  const polygon = points.map((point) => `${point.x},${point.y}`).join(" ");
  const labelFontSize = labels.length > 5 ? 3.0 : labels.length > 4 ? 3.5 : 4.1;

  return (
    <svg viewBox="0 0 120 120" style={{ width: "100%", height: 200, display: "block", overflow: "visible" }}>
      {[20, 40, 60, 80, 100].map((ring) => {
        const ringPoints = values.map((_, index) => {
          const angle = -Math.PI / 2 + (index / values.length) * Math.PI * 2;
          const x = centerX + Math.cos(angle) * ((ring / 100) * radius);
          const y = centerY + Math.sin(angle) * ((ring / 100) * radius);
          return `${x},${y}`;
        }).join(" ");
        return <polygon key={ring} points={ringPoints} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />;
      })}

      {values.map((_, index) => {
        const angle = -Math.PI / 2 + (index / values.length) * Math.PI * 2;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        return <line key={`${index}-axis`} x1={centerX} y1={centerY} x2={x} y2={y} stroke="rgba(255,255,255,0.14)" strokeWidth="0.6" />;
      })}

      <polygon points={polygon} fill="rgba(47,134,199,0.22)" stroke={color} strokeWidth="1.4" />

      {points.map((point, index) => (
        <g key={`${labels[index]}-${index}`}>
          <circle cx={point.x} cy={point.y} r="1.8" fill={color} />
          <text x={point.labelX} y={point.labelY} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.8)" fontSize={labelFontSize} style={{ letterSpacing: 0.2 }}>{labels[index]}</text>
        </g>
      ))}
    </svg>
  );
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
  const [sortBy, setSortBy] = useState<PrSort>("newest");
  const [searchText, setSearchText] = useState("");
  const [items, setItems] = useState<PrItem[]>([]);
  const [loadError, setLoadError] = useState("");
  const [selectedPercentagePrId, setSelectedPercentagePrId] = useState("");
  const [customPercentage, setCustomPercentage] = useState("75");
  const [roundingStep, setRoundingStep] = useState("2");

  useEffect(() => {
    if (!athleteUid) return;

    const loadAthlete = async () => {
      const userSnap = await getDoc(doc(db, "users", athleteUid));
      if (!userSnap.exists()) return;
      const data = userSnap.data() as any;
      const fullName = data.firstName && data.lastName ? `${data.firstName} ${data.lastName}` : data.email || "Atleta";
      setAthleteName(fullName);
    };

    loadAthlete();

    const q = query(collection(db, "users", athleteUid, "prs"), orderBy("recordedAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLoadError("");
        setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as PrItem[]);
      },
      (error) => {
        setItems([]);
        setLoadError(error.message);
      },
    );

    return () => unsub();
  }, [athleteUid]);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const filteredItems = items.filter((item) => {
      const kindMatches = filter === "all" ? true : item.kind === filter;
      if (!kindMatches) return false;
      if (!q) return true;
      return (item.name || "").toLowerCase().includes(q);
    });

    return [...filteredItems].sort((a, b) => {
      if (sortBy === "alpha") {
        return (a.name || "").localeCompare(b.name || "", "it", { sensitivity: "base" });
      }
      const aTime = toMillis(a.recordedAt || a.updatedAt || a.createdAt);
      const bTime = toMillis(b.recordedAt || b.updatedAt || b.createdAt);
      if (sortBy === "oldest") return aTime - bTime;
      return bTime - aTime;
    });
  }, [filter, items, searchText, sortBy]);

  const weightPrItems = useMemo(
    () => items.filter((item) => item.kind === "weight" && Number.isFinite(item.weightKg) && (item.weightKg as number) > 0),
    [items],
  );

  const selectedPercentagePr = useMemo(() => {
    if (weightPrItems.length === 0) return null;
    return weightPrItems.find((item) => item.id === selectedPercentagePrId) || weightPrItems[0];
  }, [selectedPercentagePrId, weightPrItems]);

  const selectedOneRepMax = useMemo(
    () => estimateOneRepMax(selectedPercentagePr?.weightKg, selectedPercentagePr?.reps),
    [selectedPercentagePr],
  );

  const selectedRoundingStep = useMemo(() => {
    if (roundingStep === "none") return null;
    const parsed = toNumber(roundingStep);
    return parsed && parsed > 0 ? parsed : 2;
  }, [roundingStep]);

  const customPercentageValue = useMemo(() => toNumber(customPercentage), [customPercentage]);
  const presetPercentages = useMemo(() => [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100], []);
  const customCalculatedWeight = useMemo(() => {
    if (!selectedOneRepMax || customPercentageValue === null || customPercentageValue <= 0) return null;
    return roundToIncrement((selectedOneRepMax * customPercentageValue) / 100, selectedRoundingStep);
  }, [customPercentageValue, selectedOneRepMax, selectedRoundingStep]);

  const categoryRadar = useMemo(() => {
    const grouped: Record<BenchmarkGroup, { values: number[]; labels: string[] }> = {
      "weightlifting-strength": buildRadarSeries(items, "weightlifting-strength"),
      gymnastic: buildRadarSeries(items, "gymnastic"),
      monostructural: buildRadarSeries(items, "monostructural"),
      crossfit: buildRadarSeries(items, "crossfit"),
    };
    return grouped;
  }, [items]);

  const metrics = useMemo(() => {
    const total = items.length;
    const bestCategory = GROUP_ORDER.map((group) => ({
      group,
      label: GROUP_META[group].label,
      value: categoryRadar[group].values.reduce((acc, value) => acc + value, 0) / Math.max(categoryRadar[group].values.length, 1),
    })).sort((a, b) => b.value - a.value)[0];

    const latest = [...items].sort((a, b) => toMillis(b.recordedAt || b.updatedAt || b.createdAt) - toMillis(a.recordedAt || a.updatedAt || a.createdAt))[0];
    return { total, bestCategory, latest };
  }, [categoryRadar, items]);

  const groupedFiltered = useMemo(
    () => ({
      "weightlifting-strength": filtered.filter((item) => (item.category ?? getBenchmarkGroup(item.name)) === "weightlifting-strength"),
      gymnastic: filtered.filter((item) => (item.category ?? getBenchmarkGroup(item.name)) === "gymnastic"),
      monostructural: filtered.filter((item) => (item.category ?? getBenchmarkGroup(item.name)) === "monostructural"),
      crossfit: filtered.filter((item) => (item.category ?? getBenchmarkGroup(item.name)) === "crossfit"),
    }),
    [filtered],
  );

  return (
    <>
      <TopBar title={`PR atleta: ${athleteName}`} />
      <div className="container" style={{ paddingBottom: 80 }}>
        <div className="grid" style={{ marginTop: 20 }}>
          <div className="card cardHover" style={{ background: "linear-gradient(180deg, rgba(47,134,199,0.14), rgba(15,15,15,0.86))" }}>
            <div className="small">Totale PR</div>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.05em", marginTop: 8 }}>{metrics.total}</div>
            <div className="small" style={{ marginTop: 6 }}>record totali</div>
          </div>
          <div className="card cardHover" style={{ background: "linear-gradient(180deg, rgba(105,180,238,0.14), rgba(15,15,15,0.86))" }}>
            <div className="small">Categoria migliore</div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 8 }}>{metrics.bestCategory?.label || "—"}</div>
            <div className="small" style={{ marginTop: 6 }}>{metrics.bestCategory ? `${Math.round(metrics.bestCategory.value)}%` : "nessun dato"}</div>
          </div>
          <div className="card cardHover" style={{ background: "linear-gradient(180deg, rgba(47,134,199,0.08), rgba(15,15,15,0.86))" }}>
            <div className="small">Ultimo PR</div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 8 }}>{metrics.latest ? metrics.latest.name : "—"}</div>
            <div className="small" style={{ marginTop: 6 }}>{metrics.latest ? (metrics.latest.kind === "time" ? formatTimeValue(metrics.latest.timeSeconds, metrics.latest.timeValue) : metrics.latest.kind === "weight" ? `${formatKg(metrics.latest.weightKg)} kg` : `${metrics.latest.reps} reps`) : "nessun dato"}</div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 20, background: "linear-gradient(180deg, rgba(18,18,18,0.94), rgba(10,10,10,0.8))" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <div>
              <div style={{ opacity: 0.75, textTransform: "uppercase", letterSpacing: 1.2, fontSize: 12 }}>Performance</div>
              <h2 style={{ margin: "6px 0 0" }}>Analisi per categoria</h2>
            </div>
            <input
              className="input"
              placeholder="Cerca PR per nome..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ maxWidth: 260 }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {GROUP_ORDER.map((group) => {
              const radar = categoryRadar[group];
              const groupMeta = GROUP_META[group];
              const totalInGroup = items.filter((item) => (item.category ?? getBenchmarkGroup(item.name)) === group).length;

              return (
                <div key={group} className="card" style={{ background: "rgba(15,15,15,0.74)", borderColor: "rgba(47,134,199,0.25)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <h3 style={{ margin: 0 }}>{groupMeta.label}</h3>
                    <span className="badge" style={{ borderColor: `${groupMeta.color}88`, background: `${groupMeta.color}22` }}>{totalInGroup}</span>
                  </div>
                  <div style={{ borderRadius: 18, background: "rgba(255,255,255,0.02)", padding: 8 }}>
                    {renderRadar(radar.values, radar.labels, groupMeta.color)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0 }}>Calcolatore percentuali</h3>
              <div className="small" style={{ marginTop: 6 }}>Calcolo rapido dei kg alle varie percentuali del massimale dell&apos;atleta.</div>
            </div>
            {selectedOneRepMax && (
              <span className="badge" style={{ borderColor: "rgba(47,134,199,0.7)" }}>1RM stimato: {formatKg(selectedOneRepMax)} kg</span>
            )}
          </div>

          {weightPrItems.length === 0 ? (
            <div className="small" style={{ marginTop: 12 }}>Nessun PR di chili disponibile per questo atleta.</div>
          ) : (
            <>
              <div className="percentageCalcGrid" style={{ marginTop: 14 }}>
                <div>
                  <label style={{ fontSize: 12, opacity: 0.75, display: "block", marginBottom: 6 }}>PR di riferimento</label>
                  <select className="input" value={selectedPercentagePr?.id || ""} onChange={(e) => setSelectedPercentagePrId(e.target.value)}>
                    {weightPrItems.map((item) => (
                      <option key={item.id} value={item.id}>{item.name} • {formatKg(item.weightKg)} kg {item.reps ? `x ${item.reps}` : ""}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, opacity: 0.75, display: "block", marginBottom: 6 }}>Arrotonda a</label>
                  <select className="input" value={roundingStep} onChange={(e) => setRoundingStep(e.target.value)}>
                    <option value="none">Nessun arrotondamento</option>
                    <option value="0.5">0,5 kg</option>
                    <option value="1">1 kg</option>
                    <option value="2">2 kg</option>
                    <option value="5">5 kg</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, opacity: 0.75, display: "block", marginBottom: 6 }}>Percentuale personalizzata</label>
                  <input className="input" inputMode="decimal" placeholder="Es. 77,5" value={customPercentage} onChange={(e) => setCustomPercentage(e.target.value)} />
                </div>
              </div>

              <div className="percentageHighlight" style={{ marginTop: 14 }}>
                <div className="small">Carico alla percentuale inserita</div>
                <div className="percentageHighlightValue">{customPercentageValue && customPercentageValue > 0 ? `${formatKg(customCalculatedWeight)} kg` : "Inserisci una percentuale valida"}</div>
                <div className="small">{customPercentageValue && customPercentageValue > 0 ? `${formatKg(customPercentageValue)}% di ${formatKg(selectedOneRepMax)} kg` : "Sono accettati anche valori decimali, ad esempio 72,5"}</div>
              </div>

              <div className="percentagePresetGrid" style={{ marginTop: 14 }}>
                {presetPercentages.map((percentage) => {
                  const calculatedWeight = selectedOneRepMax ? roundToIncrement((selectedOneRepMax * percentage) / 100, selectedRoundingStep) : null;
                  return (
                    <div key={percentage} className="percentagePresetCard">
                      <div className="small">{percentage}%</div>
                      <div className="percentagePresetValue">{formatKg(calculatedWeight)} kg</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ opacity: 0.75, textTransform: "uppercase", letterSpacing: 1.2, fontSize: 12 }}>Records</div>
              <h2 style={{ margin: "6px 0 0" }}>PR dell&apos;atleta</h2>
            </div>
            <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value as PrSort)} style={{ maxWidth: 260 }}>
              <option value="newest">Data: più recenti</option>
              <option value="oldest">Data: meno recenti</option>
              <option value="alpha">Nome: A-Z</option>
            </select>
          </div>

          <div className="quickFilterRow" style={{ marginBottom: 16 }}>
            <button className={`btn quickFilterBtn ${filter === "all" ? "quickFilterBtnActive" : ""}`} onClick={() => setFilter("all")}>Tutti ({items.length})</button>
            <button className={`btn quickFilterBtn ${filter === "time" ? "quickFilterBtnActive" : ""}`} onClick={() => setFilter("time")}>Tempo ({items.filter((item) => item.kind === "time").length})</button>
            <button className={`btn quickFilterBtn ${filter === "weight" ? "quickFilterBtnActive" : ""}`} onClick={() => setFilter("weight")}>Peso ({items.filter((item) => item.kind === "weight").length})</button>
            <button className={`btn quickFilterBtn ${filter === "reps" ? "quickFilterBtnActive" : ""}`} onClick={() => setFilter("reps")}>Ripetizioni ({items.filter((item) => item.kind === "reps").length})</button>
          </div>

          {GROUP_ORDER.map((group) => {
            const entries = groupedFiltered[group];
            if (entries.length === 0) return null;

            return (
              <div key={group} className="card" style={{ background: "rgba(15,15,15,0.76)", borderColor: "rgba(47,134,199,0.25)", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                  <h3 style={{ margin: 0 }}>{GROUP_META[group].label}</h3>
                  <span className="badge" style={{ borderColor: `${GROUP_META[group].color}88`, background: `${GROUP_META[group].color}22` }}>{entries.length}</span>
                </div>

                <div className="stack">
                  {entries.map((item) => (
                    <div key={item.id} className="card" style={{ ...getKindUi(item.kind || "time").card, marginBottom: 0 }}>
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                        <h3 style={{ margin: 0 }}>{item.name || "PR"}</h3>
                        <span className="badge" style={getKindUi(item.kind || "time").badge}>{item.kind === "time" ? "Tempo" : item.kind === "weight" ? "Peso" : "Ripetizioni"}</span>
                      </div>

                      <div style={{ marginTop: 10 }}>
                        {item.kind === "time" ? (
                          <div>Tempo: <strong>{formatTimeValue(item.timeSeconds, item.timeValue)}</strong></div>
                        ) : item.kind === "weight" ? (
                          <div><strong>{formatKg(item.weightKg)} kg</strong>{item.reps ? ` x ${item.reps} reps` : ""}</div>
                        ) : (
                          <div><strong>{item.reps ?? "-"} reps</strong></div>
                        )}
                      </div>

                      <div className="small" style={{ marginTop: 8 }}>Data registrazione: {toDateLabel(item.recordedAt || item.updatedAt || item.createdAt)}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && <div className="small">Nessun PR trovato.</div>}
        </div>

        {loadError && (
          <div className="card" style={{ marginTop: 16, borderColor: "rgba(248,113,113,0.42)" }}>
            Errore caricamento PR: {loadError}
          </div>
        )}
      </div>
    </>
  );
}
