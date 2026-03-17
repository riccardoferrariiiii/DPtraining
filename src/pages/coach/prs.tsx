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
type PrSort = "alpha" | "oldest" | "newest";

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

function formatKg(value?: number | null) {
  if (!Number.isFinite(value as number)) return "-";
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value as number);
}

function buildWeightPrLabel(item: PrItem) {
  const weightLabel = Number.isFinite(item.weightKg) ? `${formatKg(item.weightKg)} kg` : "- kg";
  const repsLabel = Number.isFinite(item.reps) && (item.reps as number) > 0 ? ` x ${item.reps}` : "";
  return `${item.name || "PR"} • ${weightLabel}${repsLabel}`;
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

    const filteredItems = items.filter((item) => {
      const matchesFilter = filter === "all" ? true : item.kind === filter;
      if (!matchesFilter) return false;
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
    () =>
      items.filter(
        (item) =>
          item.kind === "weight" &&
          Number.isFinite(item.weightKg) &&
          (item.weightKg as number) > 0
      ),
    [items]
  );

  const selectedPercentagePr = useMemo(() => {
    if (weightPrItems.length === 0) return null;
    return weightPrItems.find((item) => item.id === selectedPercentagePrId) || weightPrItems[0];
  }, [selectedPercentagePrId, weightPrItems]);

  const selectedOneRepMax = useMemo(
    () => estimateOneRepMax(selectedPercentagePr?.weightKg, selectedPercentagePr?.reps),
    [selectedPercentagePr]
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

          <div style={{ marginTop: 12 }}>
            <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value as PrSort)}>
              <option value="newest">Data: dal piu nuovo al piu vecchio</option>
              <option value="oldest">Data: dal piu vecchio al piu nuovo</option>
              <option value="alpha">Nome: ordine alfabetico (A-Z)</option>
            </select>
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

        <div className="card" style={{ marginTop: 16 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0 }}>Calcolatore percentuali</h3>
              <div className="small" style={{ marginTop: 6 }}>
                Calcolo rapido dei kg alle varie percentuali del massimale dell&apos;atleta.
              </div>
            </div>
            {selectedOneRepMax && (
              <span className="badge" style={{ borderColor: "rgba(255,255,255,0.22)" }}>
                1RM {selectedPercentagePr?.reps && selectedPercentagePr.reps > 1 ? "stimato" : "base"}: {formatKg(selectedOneRepMax)} kg
              </span>
            )}
          </div>

          {weightPrItems.length === 0 ? (
            <div className="small" style={{ marginTop: 12 }}>
              Nessun PR di chili disponibile per questo atleta.
            </div>
          ) : (
            <>
              <div className="percentageCalcGrid" style={{ marginTop: 14 }}>
                <div>
                  <label style={{ fontSize: 12, opacity: 0.75, display: "block", marginBottom: 6 }}>
                    PR di riferimento
                  </label>
                  <select
                    className="input"
                    value={selectedPercentagePr?.id || ""}
                    onChange={(e) => setSelectedPercentagePrId(e.target.value)}
                  >
                    {weightPrItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {buildWeightPrLabel(item)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, opacity: 0.75, display: "block", marginBottom: 6 }}>
                    Arrotonda a
                  </label>
                  <select className="input" value={roundingStep} onChange={(e) => setRoundingStep(e.target.value)}>
                    <option value="none">Nessun arrotondamento</option>
                    <option value="0.5">0,5 kg</option>
                    <option value="1">1 kg</option>
                    <option value="2">2 kg</option>
                    <option value="5">5 kg</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, opacity: 0.75, display: "block", marginBottom: 6 }}>
                    Percentuale personalizzata
                  </label>
                  <input
                    className="input"
                    inputMode="decimal"
                    placeholder="Es. 77,5"
                    value={customPercentage}
                    onChange={(e) => setCustomPercentage(e.target.value)}
                  />
                </div>
              </div>

              {selectedPercentagePr && (
                <div className="small" style={{ marginTop: 12 }}>
                  PR selezionato: {buildWeightPrLabel(selectedPercentagePr)}
                  {selectedPercentagePr.reps && selectedPercentagePr.reps > 1
                    ? ` • massimale stimato con formula Epley`
                    : " • massimale diretto"}
                </div>
              )}

              <div className="percentageHighlight" style={{ marginTop: 14 }}>
                <div className="small">Carico alla percentuale inserita</div>
                <div className="percentageHighlightValue">
                  {customPercentageValue && customPercentageValue > 0 ? `${formatKg(customCalculatedWeight)} kg` : "Inserisci una percentuale valida"}
                </div>
                <div className="small">
                  {customPercentageValue && customPercentageValue > 0
                    ? `${formatKg(customPercentageValue)}% di ${formatKg(selectedOneRepMax)} kg`
                    : "Sono accettati anche valori decimali, ad esempio 72,5"}
                </div>
              </div>

              <div className="percentagePresetGrid" style={{ marginTop: 14 }}>
                {presetPercentages.map((percentage) => {
                  const calculatedWeight = selectedOneRepMax
                    ? roundToIncrement((selectedOneRepMax * percentage) / 100, selectedRoundingStep)
                    : null;

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
