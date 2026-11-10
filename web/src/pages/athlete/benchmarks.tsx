import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { RoleGuard } from "../../components/RoleGuard";
import { TopBar } from "../../components/TopBar";
import { db } from "../../lib/firebase";
import { useSession, isSubscriptionExpired } from "../../lib/session";

type PrKind = "time" | "weight" | "reps";
type BenchmarkGroup = "weightlifting-strength" | "gymnastic" | "monostructural" | "crossfit";

type PrItem = {
  id: string;
  name: string;
  category?: BenchmarkGroup;
  kind: PrKind;
  weightKg?: number | null;
  reps?: number | null;
  timeSeconds?: number | null;
  timeValue?: string | null;
  recordedAt?: any;
  createdAt?: any;
  updatedAt?: any;
};

type GroupMeta = {
  label: string;
  color: string;
  examples: string[];
};

type CatalogEntry = {
  name: string;
  kind: PrKind;
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
    examples: [
      "Back Squat",
      "Front Squat",
      "Deadlift",
      "Bench Press",
      "Overhead Press",
      "Clean & Jerk",
      "Snatch",
      "Push Press",
      "Thruster",
      "Strict Press",
      "Romanian Deadlift",
      "Rack Pull",
      "Barbell Row",
      "Weighted Pull-Up",
      "Power Clean",
      "Hang Clean",
      "Power Snatch",
      "Hang Snatch",
      "Good Morning",
      "Bulgarian Split Squat",
      "Lunge",
      "Dip",
      "Reverse Grip Row",
      "Pendlay Row",
    ],
  },
  gymnastic: {
    label: "Gymnastic",
    color: "#AEB6C2",
    examples: [
      "Pull-Up",
      "Strict Pull-Up",
      "Muscle-Up",
      "Toes to Bar",
      "Chest to Bar",
      "Ring Dip",
      "Ring Muscle-Up",
      "HSPU",
      "Rope Climb",
      "Handstand Walk",
      "Kipping Pull-Up",
      "Strict Dip",
      "Butterfly Pull-Up",
      "Deficit Pull-Up",
      "Pistol Squat",
      "L-Sit",
      "Front Lever",
      "Back Lever",
      "Dragon Flag",
      "Human Flag",
      "Walking Lunge Hold",
    ],
  },
  monostructural: {
    label: "Monostructural",
    color: "#2A2F38",
    examples: [
      "1 Mile Run",
      "5k Run",
      "10k Run",
      "Row 500m",
      "Row 1000m",
      "Row 2000m",
      "Assault Bike 5 min",
      "Assault Bike 10 min",
      "SkiErg 500m",
      "SkiErg 1000m",
      "Bike Erg 20 min",
      "Bike Erg 40 min",
      "Row 750m",
      "Row 1500m",
      "Bike Erg 10 min",
      "Bike Erg 30 min",
      "SkiErg 1500m",
      "Run 400m",
      "Run 800m",
      "Run 1500m",
    ],
  },
  crossfit: {
    label: "CrossFit",
    color: "#2f86c7",
    examples: [
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
      "Burgener Warm-Up",
      "Lynne",
      "Meredith",
      "Randy",
      "Morrison",
      "Mikko",
      "McGhee",
    ],
  },
};

const BENCHMARK_LIBRARY: Record<BenchmarkGroup, CatalogEntry[]> = {
  "weightlifting-strength": [
    { name: "Back Squat", kind: "weight" },
    { name: "Front Squat", kind: "weight" },
    { name: "Goblet Squat", kind: "weight" },
    { name: "Bulgarian Split Squat", kind: "weight" },
    { name: "Deadlift", kind: "weight" },
    { name: "Romanian Deadlift", kind: "weight" },
    { name: "Rack Pull", kind: "weight" },
    { name: "Bench Press", kind: "weight" },
    { name: "Overhead Press", kind: "weight" },
    { name: "Strict Press", kind: "weight" },
    { name: "Push Press", kind: "weight" },
    { name: "Power Clean", kind: "weight" },
    { name: "Hang Clean", kind: "weight" },
    { name: "Clean & Jerk", kind: "weight" },
    { name: "Snatch", kind: "weight" },
    { name: "Power Snatch", kind: "weight" },
    { name: "Hang Snatch", kind: "weight" },
    { name: "Thruster", kind: "weight" },
    { name: "Barbell Row", kind: "weight" },
    { name: "Pendlay Row", kind: "weight" },
    { name: "Good Morning", kind: "weight" },
    { name: "Weighted Pull-Up", kind: "weight" },
    { name: "Strict Dip", kind: "weight" },
    { name: "Lunge", kind: "weight" },
  ],
  gymnastic: [
    { name: "Pull-Up", kind: "reps" },
    { name: "Strict Pull-Up", kind: "reps" },
    { name: "Butterfly Pull-Up", kind: "reps" },
    { name: "Deficit Pull-Up", kind: "reps" },
    { name: "Kipping Pull-Up", kind: "reps" },
    { name: "Muscle-Up", kind: "reps" },
    { name: "Ring Muscle-Up", kind: "reps" },
    { name: "Toes to Bar", kind: "reps" },
    { name: "Chest to Bar", kind: "reps" },
    { name: "Ring Dip", kind: "reps" },
    { name: "Strict Dip", kind: "reps" },
    { name: "HSPU", kind: "reps" },
    { name: "Rope Climb", kind: "reps" },
    { name: "Handstand Walk", kind: "reps" },
    { name: "Pistol Squat", kind: "reps" },
    { name: "L-Sit", kind: "reps" },
    { name: "Front Lever", kind: "reps" },
    { name: "Back Lever", kind: "reps" },
    { name: "Dragon Flag", kind: "reps" },
    { name: "Human Flag", kind: "reps" },
    { name: "Walking Lunge Hold", kind: "reps" },
  ],
  monostructural: [
    { name: "1 Mile Run", kind: "time" },
    { name: "Run 400m", kind: "time" },
    { name: "Run 800m", kind: "time" },
    { name: "Run 1500m", kind: "time" },
    { name: "5k Run", kind: "time" },
    { name: "10k Run", kind: "time" },
    { name: "Row 500m", kind: "time" },
    { name: "Row 750m", kind: "time" },
    { name: "Row 1000m", kind: "time" },
    { name: "Row 1500m", kind: "time" },
    { name: "Row 2000m", kind: "time" },
    { name: "SkiErg 500m", kind: "time" },
    { name: "SkiErg 1000m", kind: "time" },
    { name: "SkiErg 1500m", kind: "time" },
    { name: "Bike Erg 10 min", kind: "time" },
    { name: "Bike Erg 20 min", kind: "time" },
    { name: "Bike Erg 30 min", kind: "time" },
    { name: "Bike Erg 40 min", kind: "time" },
    { name: "Assault Bike 5 min", kind: "reps" },
    { name: "Assault Bike 10 min", kind: "reps" },
    { name: "Assault Bike 15 min", kind: "reps" },
  ],
  crossfit: [
    { name: "Fran", kind: "time" },
    { name: "Helen", kind: "time" },
    { name: "Grace", kind: "time" },
    { name: "Murph", kind: "time" },
    { name: "Cindy", kind: "reps" },
    { name: "Annie", kind: "time" },
    { name: "Diane", kind: "time" },
    { name: "Nancy", kind: "time" },
    { name: "DT", kind: "time" },
    { name: "Isabel", kind: "time" },
    { name: "Fight Gone Bad", kind: "reps" },
    { name: "Filthy Fifty", kind: "time" },
    { name: "Linda", kind: "time" },
    { name: "The Chipper", kind: "time" },
    { name: "Jackie", kind: "time" },
    { name: "Barbara", kind: "time" },
    { name: "Chelsea", kind: "time" },
    { name: "Mary", kind: "reps" },
    { name: "Manion", kind: "time" },
    { name: "Kalsu", kind: "time" },
    { name: "Nate", kind: "reps" },
    { name: "Amanda", kind: "time" },
    { name: "Lynne", kind: "time" },
    { name: "Randy", kind: "time" },
    { name: "Meredith", kind: "time" },
    { name: "Morrison", kind: "time" },
    { name: "Mikko", kind: "time" },
    { name: "McGhee", kind: "time" },
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
    const catalog = BENCHMARK_LIBRARY[group];
    const match = catalog.find((entry) => {
      const target = normalizeName(entry.name);
      return normalized === target || normalized.includes(target) || target.includes(normalized);
    });
    if (match) return group;
  }

  const keywordMap: Array<[BenchmarkGroup, string[]]> = [
    ["weightlifting-strength", ["squat", "deadlift", "bench", "press", "clean", "snatch", "jerk", "thruster", "row", "pull", "rack", "good morning", "split squat", "lunge", "pendlay", "power clean", "hang clean"]],
    ["gymnastic", ["pull-up", "pull up", "muscle-up", "muscle up", "ring", "hspu", "dip", "rope climb", "handstand", "toes to bar", "chest to bar", "pistol", "front lever", "back lever", "dragon flag", "human flag", "l-sit", "butterfly"]],
    ["monostructural", ["run", "row", "bike", "ski", "assault", "mile", "5k", "10k", "500m", "750m", "1000m", "1500m", "2000m", "400m", "800m"]],
    ["crossfit", ["fran", "helen", "grace", "murph", "cindy", "annie", "diane", "nancy", "dt", "isabel", "fight gone bad", "filthy fifty", "linda", "chipper", "jackie", "barbara", "chelsea", "mary", "manion", "kalsu", "nate", "amanda", "lynne", "randy", "morrison", "mikko", "mcghee", "wod"]],
  ];

  for (const [group, words] of keywordMap) {
    if (words.some((word) => normalized.includes(word))) return group;
  }

  return null;
}

function getMetricValue(item: PrItem): number | null {
  if (typeof item.weightKg === "number" && Number.isFinite(item.weightKg)) return item.weightKg;
  if (typeof item.reps === "number" && Number.isFinite(item.reps)) return item.reps;
  if (typeof item.timeSeconds === "number" && Number.isFinite(item.timeSeconds)) return item.timeSeconds;
  return null;
}

function formatMetric(item: PrItem) {
  if (item.kind === "weight" && typeof item.weightKg === "number" && Number.isFinite(item.weightKg)) {
    const repsSuffix = typeof item.reps === "number" && item.reps > 0 ? ` x ${item.reps}` : "";
    return `${item.weightKg.toFixed(1).replace(".0", "")} kg${repsSuffix}`;
  }
  if (item.kind === "time" && typeof item.timeSeconds === "number" && Number.isFinite(item.timeSeconds)) {
    const minutes = Math.floor(item.timeSeconds / 60);
    const seconds = Math.floor(item.timeSeconds % 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  if (item.kind === "reps" && typeof item.reps === "number" && Number.isFinite(item.reps)) {
    return `${item.reps} reps`;
  }
  return "N/D";
}

function formatChartDate(raw: any) {
  const date = raw?.toDate?.() instanceof Date ? raw.toDate() : raw instanceof Date ? raw : null;
  if (!date) return "";
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
}

function toInputDateValue(raw: any) {
  const date = raw?.toDate?.() instanceof Date ? raw.toDate() : raw instanceof Date ? raw : null;
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayInputDateValue() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseInputDate(value: string) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (!Number.isFinite(parsed.getTime()) || parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    return null;
  }
  return parsed;
}

function normalizePrName(raw: string) {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "pr";
}

function buildPrDocId(category: BenchmarkGroup, kind: PrKind, normalizedName: string) {
  const categoryPart = slugify(category);
  const namePart = slugify(normalizedName || "benchmark");
  return `${categoryPart}__${kind}__${namePart}__${Date.now().toString(36)}`;
}

function parseNumeric(value: string) {
  if (value === "") return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function getComparableMetric(item: PrItem): number | null {
  if (typeof item.weightKg === "number" && Number.isFinite(item.weightKg)) return item.weightKg;
  if (typeof item.reps === "number" && Number.isFinite(item.reps)) return item.reps;
  if (typeof item.timeSeconds === "number" && Number.isFinite(item.timeSeconds)) return item.timeSeconds;
  return null;
}

function getCategoryEntries(items: PrItem[], group: BenchmarkGroup) {
  return items
    .filter((item) => (item.category ?? getBenchmarkGroup(item.name)) === group && getMetricValue(item) !== null)
    .sort((a, b) => {
      const at = a.recordedAt?.toDate?.()?.getTime?.() || a.createdAt?.toDate?.()?.getTime?.() || 0;
      const bt = b.recordedAt?.toDate?.()?.getTime?.() || b.createdAt?.toDate?.()?.getTime?.() || 0;
      return bt - at;
    })
    .slice(0, 8);
}

function shortenRadarLabel(label: string, maxLength = 12) {
  const clean = label.trim().replace(/\s+/g, " ");
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trim()}…`;
}

function buildGroupRadarSeries(items: PrItem[], group: BenchmarkGroup) {
  const groupItems = items.filter((item) => (item.category ?? getBenchmarkGroup(item.name)) === group && getComparableMetric(item) !== null);
  if (groupItems.length === 0) {
    return { values: [0, 0, 0, 0], labels: ["-", "-", "-", "-"] };
  }

  const selected = [...groupItems]
    .sort((a, b) => {
      const timeA = a.recordedAt?.toDate?.()?.getTime?.() || a.createdAt?.toDate?.()?.getTime?.() || 0;
      const timeB = b.recordedAt?.toDate?.()?.getTime?.() || b.createdAt?.toDate?.()?.getTime?.() || 0;
      return timeB - timeA;
    })
    .slice(0, 6);

  const values = selected.map((item) => getComparableMetric(item) as number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return {
    values: selected.map((item) => {
      const raw = getComparableMetric(item) as number;
      const normalized = (raw - min) / range;
      const adjusted = item.kind === "time" ? 1 - normalized : normalized;
      return Math.round(Math.max(0, Math.min(1, adjusted)) * 100);
    }),
    labels: selected.map((item) => shortenRadarLabel(item.name)),
  };
}

function renderRadarChart(values: number[], labels: string[], color: string, fillColor: string) {
  const centerX = 60;
  const centerY = 60;
  const radius = 42;
  const labelRadius = 52;
  const minVisibleRadius = 4;
  const points = values.map((value, index) => {
    const angle = -Math.PI / 2 + (index / values.length) * Math.PI * 2;
    const normalized = Math.max(0, Math.min(100, value)) / 100;
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
  const accent = "#2f86c7";
  const accentSoft = "rgba(47, 134, 199, 0.18)";
  const axisColor = "rgba(174, 182, 194, 0.22)";

  return (
    <svg viewBox="0 0 120 120" style={{ width: "100%", height: 240, display: "block", overflow: "visible" }}>
      {[20, 40, 60, 80, 100].map((ring) => {
        const ringPoints = values.map((_, index) => {
          const angle = -Math.PI / 2 + (index / values.length) * Math.PI * 2;
          const x = centerX + Math.cos(angle) * ((ring / 100) * radius);
          const y = centerY + Math.sin(angle) * ((ring / 100) * radius);
          return `${x},${y}`;
        }).join(" ");
        return <polygon key={ring} points={ringPoints} fill="none" stroke={axisColor} strokeWidth="0.7" />;
      })}

      {values.map((_, index) => {
        const angle = -Math.PI / 2 + (index / values.length) * Math.PI * 2;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        return <line key={`axis-${index}`} x1={centerX} y1={centerY} x2={x} y2={y} stroke={axisColor} strokeWidth="0.7" />;
      })}

      <polygon points={polygon} fill={fillColor || accentSoft} stroke={accent} strokeWidth="1.6" />

      {points.map((point, index) => (
        <g key={`${labels[index]}-${index}`}>
          <circle cx={point.x} cy={point.y} r="2.2" fill={accent} stroke="rgba(10,11,13,0.9)" strokeWidth="0.6" />
          <text x={point.labelX} y={point.labelY} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.76)" fontSize={labelFontSize} style={{ letterSpacing: 0.2 }}>{labels[index]}</text>
        </g>
      ))}
    </svg>
  );
}

function buildRadarData(items: PrItem[]) {
  return GROUP_ORDER.map((group) => {
    const groupItems = items.filter((item) => (item.category ?? getBenchmarkGroup(item.name)) === group && getComparableMetric(item) !== null);
    if (groupItems.length === 0) {
      return { group, label: GROUP_META[group].label, value: 0, color: GROUP_META[group].color };
    }

    const values = groupItems.map((item) => getComparableMetric(item) as number);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const averageScore = groupItems.reduce((sum, item) => {
      const raw = getComparableMetric(item);
      if (raw == null) return sum;
      const normalized = (raw - min) / range;
      const adjusted = item.kind === "time" ? 1 - normalized : normalized;
      return sum + Math.max(0, Math.min(1, adjusted)) * 100;
    }, 0) / groupItems.length;

    return {
      group,
      label: GROUP_META[group].label,
      value: Math.round(Math.max(0, Math.min(100, averageScore))),
      color: GROUP_META[group].color,
    };
  });
}

export default function AthleteBenchmarksPage() {
  const { user, profile } = useSession();
  const [items, setItems] = useState<PrItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<BenchmarkGroup>("crossfit");
  const [kind, setKind] = useState<PrKind>("time");
  const [timeMinutes, setTimeMinutes] = useState("0");
  const [timeSecondsPart, setTimeSecondsPart] = useState("00");
  const [weightKg, setWeightKg] = useState("");
  const [reps, setReps] = useState("");
  const [recordedDate, setRecordedDate] = useState(todayInputDateValue());
  const [saving, setSaving] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmType, setConfirmType] = useState<"success" | "error" | "warning">("success");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PrItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const isExpired = isSubscriptionExpired(profile?.subscriptionExpiresAt);

  const toggleGroupExpansion = (key: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(collection(db, "users", user.uid, "prs"), orderBy("recordedAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as any),
        })) as PrItem[];
        setItems(next);
      },
      () => setItems([]),
    );

    return () => unsub();
  }, [user?.uid]);

  const groupedItems = useMemo(
    () => ({
      "weightlifting-strength": getCategoryEntries(items, "weightlifting-strength"),
      gymnastic: getCategoryEntries(items, "gymnastic"),
      monostructural: getCategoryEntries(items, "monostructural"),
      crossfit: getCategoryEntries(items, "crossfit"),
    }),
    [items],
  );

  const radarData = useMemo(() => buildRadarData(items), [items]);
  const radarPoints = useMemo(() => {
    const centerX = 50;
    const centerY = 50;
    const maxRadius = 38;
    return radarData.map((point, index) => {
      const angle = -Math.PI / 2 + (index / radarData.length) * Math.PI * 2;
      const radius = (point.value / 100) * maxRadius;
      return {
        ...point,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      };
    });
  }, [radarData]);
  const radarPolygon = radarPoints.map((point) => `${point.x},${point.y}`).join(" ");

  const allTrackedBenchmarks = items.filter((item) => (item.category ?? getBenchmarkGroup(item.name)) !== null && getMetricValue(item) !== null);
  const latestBenchmark = [...allTrackedBenchmarks].sort((a, b) => {
    const at = a.recordedAt?.toDate?.()?.getTime?.() || a.createdAt?.toDate?.()?.getTime?.() || 0;
    const bt = b.recordedAt?.toDate?.()?.getTime?.() || b.createdAt?.toDate?.()?.getTime?.() || 0;
    return bt - at;
  })[0];
  const strongestGroup = [...radarData].filter((item) => item.value > 0).sort((a, b) => b.value - a.value)[0];

  const openCreateModal = (groupOverride?: BenchmarkGroup) => {
    const nextGroup = groupOverride ?? "crossfit";
    setEditingId(null);
    setName("");
    setCategory(nextGroup);
    setKind(BENCHMARK_LIBRARY[nextGroup][0]?.kind ?? "time");
    setTimeMinutes("0");
    setTimeSecondsPart("00");
    setWeightKg("");
    setReps("");
    setRecordedDate(todayInputDateValue());
    setIsModalOpen(true);
  };

  const openEditModal = (item: PrItem) => {
    const resolvedGroup = (item.category ?? getBenchmarkGroup(item.name) ?? "crossfit") as BenchmarkGroup;
    setEditingId(item.id);
    setName(item.name || "");
    setCategory(resolvedGroup);
    setKind(item.kind ?? "time");

    if (item.kind === "time") {
      const total = Number(item.timeSeconds ?? 0);
      setTimeMinutes(String(Math.floor(total / 60)));
      setTimeSecondsPart(String(Math.floor(total % 60)).padStart(2, "0"));
    } else {
      setTimeMinutes("0");
      setTimeSecondsPart("00");
    }

    setWeightKg(typeof item.weightKg === "number" ? String(item.weightKg) : "");
    setReps(typeof item.reps === "number" ? String(item.reps) : "");
    setRecordedDate(toInputDateValue(item.recordedAt || item.updatedAt || item.createdAt) || todayInputDateValue());
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setName("");
    setCategory("crossfit");
    setKind("time");
    setTimeMinutes("0");
    setTimeSecondsPart("00");
    setWeightKg("");
    setReps("");
    setRecordedDate(todayInputDateValue());
  };

  const handlePreset = (exercise: string, groupOverride?: BenchmarkGroup) => {
    const targetGroup = groupOverride ?? getBenchmarkGroup(exercise) ?? category;
    const entry = BENCHMARK_LIBRARY[targetGroup].find((item) => normalizeName(item.name) === normalizeName(exercise));
    setCategory(targetGroup);
    setName(exercise);
    setKind(entry?.kind ?? (targetGroup === "weightlifting-strength" ? "weight" : targetGroup === "gymnastic" ? "reps" : "time"));
  };

  const savePr = async () => {
    if (!user?.uid) return;
    if (isExpired) {
      setConfirmMessage("Abbonamento scaduto: non puoi salvare nuovi PR.");
      setConfirmType("warning");
      return;
    }

    const cleanName = name.trim();
    if (!cleanName) {
      setConfirmMessage("Inserisci il nome del benchmark.");
      setConfirmType("warning");
      return;
    }

    const dateValue = parseInputDate(recordedDate);
    if (!dateValue) {
      setConfirmMessage("Inserisci una data valida.");
      setConfirmType("warning");
      return;
    }

    const normalizedName = normalizePrName(cleanName);
    const payload: any = {
      name: cleanName,
      category,
      kind,
      normalizedName,
      recordedAt: Timestamp.fromDate(dateValue),
      updatedAt: serverTimestamp(),
    };

    if (kind === "time") {
      const minutes = Number(timeMinutes);
      const seconds = Number(timeSecondsPart);
      if (!Number.isFinite(minutes) || minutes < 0) {
        setConfirmMessage("Inserisci minuti validi.");
        setConfirmType("warning");
        return;
      }
      if (!Number.isFinite(seconds) || seconds < 0 || seconds > 59) {
        setConfirmMessage("Inserisci secondi validi (0-59).");
        setConfirmType("warning");
        return;
      }
      const total = minutes * 60 + seconds;
      if (total <= 0) {
        setConfirmMessage("Il tempo deve essere superiore a 00:00.");
        setConfirmType("warning");
        return;
      }
      payload.timeSeconds = total;
      payload.timeValue = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
      payload.weightKg = null;
      payload.reps = null;
    }

    if (kind === "reps") {
      const parsedReps = parseNumeric(reps);
      if (parsedReps === null || parsedReps <= 0) {
        setConfirmMessage("Inserisci un numero di ripetizioni valido.");
        setConfirmType("warning");
        return;
      }
      payload.reps = Math.round(parsedReps);
      payload.weightKg = null;
      payload.timeSeconds = null;
    }

    if (kind === "weight") {
      const parsedWeight = parseNumeric(weightKg);
      const parsedReps = parseNumeric(reps);
      if (parsedWeight === null || parsedWeight <= 0) {
        setConfirmMessage("Inserisci il peso in kg.");
        setConfirmType("warning");
        return;
      }
      payload.weightKg = parsedWeight;
      payload.reps = parsedReps !== null && parsedReps > 0 ? Math.round(parsedReps) : null;
      payload.timeSeconds = null;
    }

    const docId = editingId || buildPrDocId(category, kind, normalizedName);

    setSaving(true);
    try {
      await setDoc(
        doc(db, "users", user.uid, "prs", docId),
        {
          ...payload,
          createdAt: serverTimestamp(),
        },
        { merge: true },
      );

      setConfirmMessage(editingId ? "PR modificato ✅" : "PR salvato ✅");
      setConfirmType("success");
      closeModal();
    } catch (error: any) {
      setConfirmMessage(`Errore nel salvataggio: ${String(error?.message || error)}`);
      setConfirmType("error");
    } finally {
      setSaving(false);
    }
  };

  const deletePr = async () => {
    if (!user?.uid || !pendingDelete) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "users", user.uid, "prs", pendingDelete.id));
      setPendingDelete(null);
      setConfirmMessage("PR eliminato ✅");
      setConfirmType("success");
    } catch (error: any) {
      setConfirmMessage(`Errore eliminazione PR: ${String(error?.message || error)}`);
      setConfirmType("error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <RoleGuard role="athlete">
      <TopBar title="Performance" />
      <div className="container" style={{ paddingBottom: 80 }}>
        <div className="grid" style={{ marginTop: 20 }}>
          <div className="card cardHover" style={{ background: "linear-gradient(180deg, rgba(47,134,199,0.18), rgba(15,15,15,0.86))" }}>
            <div className="small">Benchmark totali</div>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.05em", marginTop: 8 }}>{allTrackedBenchmarks.length}</div>
            <div className="small" style={{ marginTop: 6 }}>valori registrati</div>
          </div>
          <div className="card cardHover" style={{ background: "linear-gradient(180deg, rgba(47,134,199,0.10), rgba(15,15,15,0.86))" }}>
            <div className="small">Categoria migliore</div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 8 }}>{strongestGroup ? strongestGroup.label : "—"}</div>
            <div className="small" style={{ marginTop: 6 }}>{strongestGroup ? `${strongestGroup.value}% performance` : "nessun dato"}</div>
          </div>
          <div className="card cardHover" style={{ background: "linear-gradient(180deg, rgba(47,134,199,0.08), rgba(15,15,15,0.86))" }}>
            <div className="small">Ultimo benchmark</div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 8 }}>{latestBenchmark ? latestBenchmark.name : "—"}</div>
            <div className="small" style={{ marginTop: 6 }}>{latestBenchmark ? formatMetric(latestBenchmark) : "nessun dato"}</div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 20, background: "linear-gradient(180deg, rgba(10,11,13,0.98), rgba(8,9,10,0.96))", border: "1px solid rgba(47,134,199,0.22)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
            <div>
              <div style={{ opacity: 0.9, textTransform: "uppercase", letterSpacing: 1.2, fontSize: 12, color: "#2f86c7" }}>Performance</div>
              <h2 style={{ margin: "6px 0 0", color: "#F8F4EA" }}>Benchmark overview</h2>
            </div>
            <button className="btn btnPrimary" onClick={() => openCreateModal("crossfit")} disabled={isExpired}>Aggiungi PR</button>
          </div>

          {items.length === 0 ? (
            <div style={{ opacity: 0.8, padding: "12px 0", color: "#F8F4EA" }}>Nessun benchmark registrato. Aggiungi il tuo primo PR per iniziare il confronto delle performance.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 0.8fr)", gap: 20, alignItems: "center" }}>
              <div style={{ width: "100%", border: "1px solid rgba(47,134,199,0.18)", borderRadius: 18, background: "radial-gradient(circle at top, rgba(47,134,199,0.08), rgba(10,11,13,0.94))", padding: 18 }}>
                <div style={{ textTransform: "uppercase", letterSpacing: 1.2, fontSize: 12, opacity: 0.8, marginBottom: 8, color: "#2f86c7" }}>Radar overview</div>
                <svg viewBox="0 0 100 100" style={{ width: "100%", height: 300, display: "block" }}>
                  {[20, 40, 60, 80, 100].map((ring) => {
                    const radius = (ring / 100) * 38;
                    const points = radarData
                      .map((_, index) => {
                        const angle = -Math.PI / 2 + (index / radarData.length) * Math.PI * 2;
                        const x = 50 + Math.cos(angle) * radius;
                        const y = 50 + Math.sin(angle) * radius;
                        return `${x},${y}`;
                      })
                      .join(" ");
                    return <polygon key={ring} points={points} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.7" />;
                  })}

                  <defs>
                    <linearGradient id="radarFill" x1="0" x2="1" y1="0" y2="1">
                      <stop offset="0%" stopColor="rgba(47,134,199,0.38)" />
                      <stop offset="100%" stopColor="rgba(47,134,199,0.08)" />
                    </linearGradient>
                  </defs>

                  {radarData.map((point, index) => {
                    const angle = -Math.PI / 2 + (index / radarData.length) * Math.PI * 2;
                    const lineEndX = 50 + Math.cos(angle) * 38;
                    const lineEndY = 50 + Math.sin(angle) * 38;
                    const labelX = 50 + Math.cos(angle) * 46;
                    const labelY = 50 + Math.sin(angle) * 46;
                    return (
                      <g key={point.group}>
                        <line x1={50} y1={50} x2={lineEndX} y2={lineEndY} stroke="rgba(255,255,255,0.18)" strokeWidth="0.7" />
                        <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.74)" fontSize="4.2">{point.label}</text>
                      </g>
                    );
                  })}

                  <polygon points={radarPolygon} fill="url(#radarFill)" stroke="#2f86c7" strokeWidth="1.3" />
                  {radarPoints.map((point) => (
                    <circle key={`${point.group}-dot`} cx={point.x} cy={point.y} r="1.8" fill={point.color} />
                  ))}
                </svg>
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                {radarData.map((point) => (
                  <div key={point.group} style={{ border: "1px solid rgba(47,134,199,0.16)", borderRadius: 16, padding: 12, background: "linear-gradient(180deg, rgba(10,11,13,0.94), rgba(18,20,24,0.94))", boxShadow: "inset 0 1px 0 rgba(47,134,199,0.05)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: point.color, display: "inline-block", boxShadow: "0 0 0 2px rgba(47,134,199,0.12)" }} />
                        <strong style={{ color: "#F8F4EA" }}>{point.label}</strong>
                      </div>
                      <span style={{ fontWeight: 800, color: "#2f86c7" }}>{point.value}%</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden", marginTop: 10 }}>
                      <div style={{ width: `${point.value}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #2f86c7, #8fc9f2)" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
            {GROUP_ORDER.map((group) => {
              const entries = groupedItems[group] || [];
              const groupMeta = GROUP_META[group];
              const expanded = !!expandedGroups[`${group}-items`];
              const visibleEntries = entries.length > 3 && !expanded ? entries.slice(0, 3) : entries;

              const chart = buildGroupRadarSeries(items, group);

              return (
                <div key={group} className="card" style={{ background: "linear-gradient(180deg, rgba(10,11,13,0.98), rgba(8,9,10,0.96))", border: "1px solid rgba(47,134,199,0.18)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                    <h3 style={{ margin: 0, color: "#F8F4EA" }}>{groupMeta.label}</h3>
                    <span className="badge" style={{ borderColor: "rgba(47,134,199,0.42)", background: "rgba(47,134,199,0.12)", color: "#F8F4EA" }}>{entries.length}</span>
                  </div>

                  <div style={{ border: "1px solid rgba(47,134,199,0.15)", borderRadius: 18, background: "radial-gradient(circle at top, rgba(47,134,199,0.08), rgba(10,11,13,0.92))", padding: 12, marginBottom: 12 }}>
                    {renderRadarChart(chart.values, chart.labels, groupMeta.color, "rgba(47,134,199,0.14)")}
                  </div>

                  {entries.length === 0 ? (
                    <div style={{ opacity: 0.7 }}>Nessun benchmark</div>
                  ) : (
                    <>
                      <div style={{ display: "grid", gap: 10 }}>
                        {visibleEntries.map((item) => (
                          <div key={item.id} style={{ padding: "12px 12px", borderRadius: 14, border: "1px solid rgba(47,134,199,0.12)", background: "linear-gradient(180deg, rgba(10,11,13,0.92), rgba(22,24,29,0.9))", display: "grid", gap: 6, boxShadow: "0 12px 28px rgba(10,11,13,0.22)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                              <strong style={{ fontSize: 15, color: "#F3F5F7" }}>{item.name}</strong>
                              <span style={{ fontWeight: 800, color: "#2f86c7" }}>{formatMetric(item)}</span>
                            </div>
                            <div style={{ opacity: 0.72, fontSize: 12, color: "#AEB6C2" }}>{formatChartDate(item.recordedAt) || "Data non disponibile"}</div>
                            <div className="row" style={{ marginTop: 4 }}>
                              <button className="btn" onClick={() => openEditModal(item)}>Modifica</button>
                              <button className="btn btnDanger" onClick={() => setPendingDelete(item)}>Elimina</button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {entries.length > 3 && (
                        <button
                          className="btn"
                          style={{ width: "100%", marginTop: 12, fontSize: 13, padding: "10px 12px" }}
                          onClick={() => toggleGroupExpansion(`${group}-items`)}
                        >
                          {expanded ? "Mostra meno" : `Mostra tutti (${entries.length})`}
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ marginTop: 20, background: "linear-gradient(180deg, rgba(10,11,13,0.98), rgba(8,9,10,0.96))", borderColor: "rgba(47,134,199,0.22)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ opacity: 0.85, textTransform: "uppercase", letterSpacing: 1.2, fontSize: 12, color: "#2f86c7" }}>PR database</div>
              <h2 style={{ margin: "6px 0 0", color: "#F8F4EA" }}>I tuoi record</h2>
            </div>
            <Link href="/athlete-home" className="btn">Home</Link>
          </div>

          {isExpired && <div style={{ marginTop: 12, color: "#8fc9f2" }}>Abbonamento scaduto: non puoi inserire nuovi PR.</div>}

          <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
            {GROUP_ORDER.map((group) => {
              const presetList = BENCHMARK_LIBRARY[group];
              const expanded = !!expandedGroups[`${group}-library`];
              const visiblePresets = presetList.length > 8 && !expanded ? presetList.slice(0, 8) : presetList;

              return (
                <div key={group} className="card" style={{ background: "linear-gradient(180deg, rgba(8,8,9,0.96), rgba(11,12,14,0.96))", borderColor: "rgba(47,134,199,0.22)", boxShadow: "inset 0 1px 0 rgba(47,134,199,0.06)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 12, flexWrap: "wrap" }}>
                    <h3 style={{ margin: 0 }}>{GROUP_META[group].label}</h3>
                    <span className="badge" style={{ borderColor: `${GROUP_META[group].color}88`, background: `${GROUP_META[group].color}22` }}>{groupedItems[group].length}</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {visiblePresets.map((exercise) => (
                      <button
                        key={`${group}-${exercise.name}`}
                        className="btn"
                        style={{ padding: "8px 10px", fontSize: 12, background: "rgba(0,0,0,0.22)", borderColor: "rgba(47,134,199,0.26)" }}
                        onClick={() => {
                          handlePreset(exercise.name, group);
                          setIsModalOpen(true);
                        }}
                      >
                        {exercise.name}
                      </button>
                    ))}
                  </div>

                  {presetList.length > 8 && (
                    <button
                      className="btn"
                      style={{ width: "100%", marginTop: 10, fontSize: 13, padding: "10px 12px" }}
                      onClick={() => toggleGroupExpansion(`${group}-library`)}
                    >
                      {expanded ? "Mostra meno" : `Mostra tutti (${presetList.length})`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(2, 6, 23, 0.92)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16 }}
          onClick={closeModal}
        >
          <div
            className="card"
            style={{ width: "min(96vw, 560px)", marginTop: 0, background: "linear-gradient(180deg, rgba(10,11,13,0.98), rgba(8,9,10,0.96))", border: "1px solid rgba(47,134,199,0.28)", boxShadow: "0 30px 80px rgba(0,0,0,0.78)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>{editingId ? "Modifica PR" : "Nuovo PR"}</h3>

            <div style={{ marginTop: 10 }}>
              <label style={{ fontSize: 12, opacity: 0.75, display: "block", marginBottom: 6 }}>Categoria</label>
              <select
                className="input"
                value={category}
                onChange={(e) => {
                  const next = e.target.value as BenchmarkGroup;
                  setCategory(next);
                  setKind(BENCHMARK_LIBRARY[next][0]?.kind ?? "time");
                }}
              >
                {GROUP_ORDER.map((group) => (
                  <option key={group} value={group}>{GROUP_META[group].label}</option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 12, opacity: 0.75, display: "block", marginBottom: 6 }}>Nome benchmark</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Fran, Back Squat, Murph..." />
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 12, opacity: 0.75, display: "block", marginBottom: 6 }}>Quick add</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {GROUP_META[category].examples.map((exercise) => (
                  <button key={`${category}-${exercise}`} className="btn" style={{ padding: "8px 10px", fontSize: 12 }} onClick={() => handlePreset(exercise, category)}>
                    {exercise}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 12, opacity: 0.75, display: "block", marginBottom: 6 }}>Score</label>
              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><input type="radio" name="score-kind" checked={kind === "time"} onChange={() => setKind("time")} /> Tempo</label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><input type="radio" name="score-kind" checked={kind === "reps"} onChange={() => setKind("reps")} /> Ripetizioni</label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><input type="radio" name="score-kind" checked={kind === "weight"} onChange={() => setKind("weight")} /> Kg</label>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 12, opacity: 0.75, display: "block", marginBottom: 6 }}>Data registrazione</label>
              <input className="input" type="date" max={todayInputDateValue()} value={recordedDate} onChange={(e) => setRecordedDate(e.target.value)} />
            </div>

            {kind === "time" && (
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, opacity: 0.75, display: "block", marginBottom: 6 }}>Tempo</label>
                <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, opacity: 0.75, display: "block", marginBottom: 6 }}>Minuti</label>
                    <input className="input" type="number" min={0} value={timeMinutes} onChange={(e) => setTimeMinutes(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, opacity: 0.75, display: "block", marginBottom: 6 }}>Secondi</label>
                    <select className="input" value={timeSecondsPart} onChange={(e) => setTimeSecondsPart(e.target.value)}>
                      {Array.from({ length: 60 }).map((_, idx) => (
                        <option key={idx} value={String(idx).padStart(2, "0")}>{String(idx).padStart(2, "0")}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {kind === "reps" && (
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, opacity: 0.75, display: "block", marginBottom: 6 }}>Ripetizioni</label>
                <input className="input" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} placeholder="Es. 12" />
              </div>
            )}

            {kind === "weight" && (
              <div style={{ marginTop: 12 }}>
                <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, opacity: 0.75, display: "block", marginBottom: 6 }}>Peso (kg)</label>
                    <input className="input" inputMode="decimal" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="Es. 140" />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, opacity: 0.75, display: "block", marginBottom: 6 }}>Ripetizioni</label>
                    <input className="input" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} placeholder="Opcional" />
                  </div>
                </div>
              </div>
            )}

            <div className="row" style={{ justifyContent: "flex-end", marginTop: 18 }}>
              <button className="btn" onClick={closeModal} disabled={saving}>Annulla</button>
              <button className="btn btnPrimary" onClick={savePr} disabled={saving}>{saving ? "Salvataggio..." : editingId ? "Salva modifiche" : "Salva"}</button>
            </div>
          </div>
        </div>
      )}

      {pendingDelete && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(2, 6, 23, 0.92)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16 }} onClick={() => setPendingDelete(null)}>
          <div className="card" style={{ width: "min(94vw, 420px)", marginTop: 0, background: "linear-gradient(180deg, rgba(10,11,13,0.98), rgba(8,9,10,0.96))", border: "1px solid rgba(47,134,199,0.28)", boxShadow: "0 30px 80px rgba(0,0,0,0.78)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Conferma eliminazione</div>
            <div style={{ marginBottom: 20 }}>Vuoi eliminare il PR <strong>{pendingDelete.name}</strong>?</div>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setPendingDelete(null)} disabled={deleting}>Annulla</button>
              <button className="btn btnDanger" onClick={deletePr} disabled={deleting}>{deleting ? "Eliminazione..." : "Elimina"}</button>
            </div>
          </div>
        </div>
      )}

      {confirmMessage && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(2, 6, 23, 0.92)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16 }} onClick={() => setConfirmMessage("")}>
          <div className="card" style={{ width: "min(94vw, 420px)", marginTop: 0, background: "linear-gradient(180deg, rgba(10,11,13,0.98), rgba(8,9,10,0.96))", border: "1px solid rgba(47,134,199,0.28)", boxShadow: "0 30px 80px rgba(0,0,0,0.78)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>{confirmType === "success" ? "✅ Successo" : confirmType === "error" ? "❌ Errore" : "⚠️ Attenzione"}</div>
            <div style={{ marginBottom: 20 }}>{confirmMessage}</div>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn btnPrimary" onClick={() => setConfirmMessage("")}>Ok</button>
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
