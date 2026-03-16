import { useMemo, useState } from "react";
import { RoleGuard } from "../../components/RoleGuard";
import { TopBar } from "../../components/TopBar";
import { db } from "../../lib/firebase";
import { useSession, isSubscriptionExpired } from "../../lib/session";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useEffect } from "react";

type PrKind = "time" | "weight";
type PrFilter = "all" | "time" | "weight";

type PrItem = {
  id: string;
  name: string;
  normalizedName: string;
  kind: PrKind;
  timeValue?: string;
  timeSeconds?: number;
  weightKg?: number;
  reps?: number;
  createdAt?: any;
  recordedAt?: any;
  updatedAt?: any;
};

function normalizePrName(raw: string) {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function prDocId(kind: PrKind, normalizedName: string, reps?: number) {
  const slug = normalizedName
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  if (kind === "weight") {
    const repsPart = Number.isFinite(reps) && (reps as number) > 0 ? `__r${Math.round(reps as number)}` : "__r1";
    return `${kind}__${slug || "pr"}${repsPart}`;
  }

  return `${kind}__${slug || "pr"}`;
}

function getKindUi(kind: PrKind) {
  if (kind === "time") {
    return {
      badge: { borderColor: "var(--accent)", background: "rgba(100,149,237,0.2)" },
      card: { borderColor: "rgba(100,149,237,0.45)" },
      editBtn: { borderColor: "var(--accent)", background: "rgba(100,149,237,0.18)" },
    };
  }

  return {
    badge: { borderColor: "rgba(255,170,70,0.65)", background: "rgba(255,170,70,0.2)" },
    card: { borderColor: "rgba(255,170,70,0.45)" },
    editBtn: { borderColor: "rgba(255,170,70,0.65)", background: "rgba(255,170,70,0.2)" },
  };
}

function toNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

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

function formatTimeValue(totalSeconds?: number, fallback?: string) {
  if (Number.isFinite(totalSeconds) && (totalSeconds as number) >= 0) {
    const minutes = Math.floor((totalSeconds as number) / 60);
    const seconds = Math.floor((totalSeconds as number) % 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return fallback || "00:00";
}

function estimateOneRepMax(weightKg?: number, reps?: number) {
  if (!Number.isFinite(weightKg) || (weightKg as number) <= 0) return null;

  const safeReps = Number.isFinite(reps) && (reps as number) > 0 ? Math.round(reps as number) : 1;
  if (safeReps <= 1) return weightKg as number;

  return (weightKg as number) * (1 + safeReps / 30);
}

function roundToIncrement(value: number, increment: number) {
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

function parseToMinSec(item: PrItem) {
  if (Number.isFinite(item.timeSeconds) && (item.timeSeconds as number) >= 0) {
    const total = item.timeSeconds as number;
    return {
      minutes: String(Math.floor(total / 60)),
      seconds: String(Math.floor(total % 60)).padStart(2, "0"),
    };
  }

  const raw = (item.timeValue || "").trim();
  const match = raw.match(/^(\d{1,3})[:m]\s*(\d{1,2})s?$/i) || raw.match(/^(\d{1,3})\s*:\s*(\d{1,2})$/);
  if (match) {
    const minutes = Number(match[1]);
    const seconds = Number(match[2]);
    if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
      return {
        minutes: String(Math.max(0, minutes)),
        seconds: String(Math.min(59, Math.max(0, seconds))).padStart(2, "0"),
      };
    }
  }

  return { minutes: "0", seconds: "00" };
}

export default function AthletePrPage() {
  return (
    <RoleGuard role="athlete">
      <AthletePrInner />
    </RoleGuard>
  );
}

function AthletePrInner() {
  const { user, profile } = useSession();
  const [items, setItems] = useState<PrItem[]>([]);
  const [filter, setFilter] = useState<PrFilter>("all");
  const [searchText, setSearchText] = useState("");
  const [selectedPercentagePrId, setSelectedPercentagePrId] = useState("");
  const [customPercentage, setCustomPercentage] = useState("75");
  const [roundingStep, setRoundingStep] = useState("2.5");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [kind, setKind] = useState<PrKind>("time");
  const [timeMinutes, setTimeMinutes] = useState("0");
  const [timeSecondsPart, setTimeSecondsPart] = useState("00");
  const [weightKg, setWeightKg] = useState("");
  const [reps, setReps] = useState("");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PrItem | null>(null);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmType, setConfirmType] = useState<"success" | "error" | "warning">("success");

  const isExpired = isSubscriptionExpired(profile?.subscriptionExpiresAt);

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(collection(db, "users", user.uid, "prs"), orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          })) as PrItem[]
        );
      },
      (error) => {
        setItems([]);
        setConfirmMessage(`Errore caricamento PR: ${error.message}`);
        setConfirmType("error");
      }
    );

    return () => unsub();
  }, [user?.uid]);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    return items.filter((item) => {
      const matchesFilter = filter === "all" ? true : item.kind === filter;
      if (!matchesFilter) return false;
      if (!q) return true;

      return (item.name || "").toLowerCase().includes(q);
    });
  }, [filter, items, searchText]);

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
    const parsed = toNumber(roundingStep);
    return parsed && parsed > 0 ? parsed : 2.5;
  }, [roundingStep]);

  const customPercentageValue = useMemo(() => toNumber(customPercentage), [customPercentage]);

  const presetPercentages = useMemo(() => [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100], []);

  const customCalculatedWeight = useMemo(() => {
    if (!selectedOneRepMax || customPercentageValue === null || customPercentageValue <= 0) return null;
    return roundToIncrement((selectedOneRepMax * customPercentageValue) / 100, selectedRoundingStep);
  }, [customPercentageValue, selectedOneRepMax, selectedRoundingStep]);

  const clearModal = () => {
    setEditingId(null);
    setName("");
    setKind("time");
    setTimeMinutes("0");
    setTimeSecondsPart("00");
    setWeightKg("");
    setReps("");
  };

  const openCreateModal = () => {
    clearModal();
    setIsModalOpen(true);
  };

  const openEditModal = (item: PrItem) => {
    setEditingId(item.id);
    setName(item.name || "");
    setKind(item.kind);
    const parsedTime = parseToMinSec(item);
    setTimeMinutes(parsedTime.minutes);
    setTimeSecondsPart(parsedTime.seconds);
    setWeightKg(item.weightKg !== undefined && item.weightKg !== null ? String(item.weightKg) : "");
    setReps(item.reps !== undefined && item.reps !== null ? String(item.reps) : "");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    clearModal();
  };

  const requestDeletePr = (item: PrItem) => {
    setPendingDelete(item);
  };

  const deletePr = async () => {
    if (!user?.uid || !pendingDelete) return;

    setDeleting(true);
    try {
      await deleteDoc(doc(db, "users", user.uid, "prs", pendingDelete.id));
      setPendingDelete(null);

      if (editingId === pendingDelete.id) {
        closeModal();
      }

      setConfirmMessage("PR eliminato ✅");
      setConfirmType("success");
    } catch (e: any) {
      setConfirmMessage(`Errore eliminazione PR: ${String(e?.message || e)}`);
      setConfirmType("error");
    } finally {
      setDeleting(false);
    }
  };

  const savePr = async () => {
    if (!user?.uid) return;

    if (isExpired) {
      setConfirmMessage("Abbonamento scaduto: non puoi inserire nuovi PR.");
      setConfirmType("warning");
      return;
    }

    const cleanedName = name.trim();
    if (!cleanedName) {
      setConfirmMessage("Inserisci il nome del PR.");
      setConfirmType("warning");
      return;
    }

    const normalizedName = normalizePrName(cleanedName);
    if (!normalizedName) {
      setConfirmMessage("Nome PR non valido.");
      setConfirmType("warning");
      return;
    }

    const payload: any = {
      name: cleanedName,
      normalizedName,
      kind,
      updatedAt: serverTimestamp(),
      recordedAt: serverTimestamp(),
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

      const totalSeconds = Math.floor(minutes) * 60 + Math.floor(seconds);
      if (totalSeconds <= 0) {
        setConfirmMessage("Il tempo deve essere maggiore di 00:00.");
        setConfirmType("warning");
        return;
      }

      payload.timeSeconds = totalSeconds;
      payload.timeValue = `${String(Math.floor(minutes)).padStart(2, "0")}:${String(Math.floor(seconds)).padStart(2, "0")}`;
      payload.weightKg = null;
      payload.reps = null;
    }

    if (kind === "weight") {
      const parsedWeight = toNumber(weightKg);
      const parsedReps = toNumber(reps);

      if (parsedWeight === null || parsedWeight <= 0) {
        setConfirmMessage("Inserisci i chili del PR.");
        setConfirmType("warning");
        return;
      }

      if (parsedReps === null || parsedReps <= 0) {
        setConfirmMessage("Inserisci le ripetizioni del PR.");
        setConfirmType("warning");
        return;
      }

      payload.weightKg = parsedWeight;
      payload.reps = Math.round(parsedReps);
      payload.timeValue = null;
      payload.timeSeconds = null;
    }

    const id = prDocId(kind, normalizedName, kind === "weight" ? Math.round(toNumber(reps) || 0) : undefined);

    setSaving(true);
    try {
      await setDoc(
        doc(db, "users", user.uid, "prs", id),
        {
          ...payload,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      if (editingId && editingId !== id) {
        await deleteDoc(doc(db, "users", user.uid, "prs", editingId));
      }

      setConfirmMessage(editingId ? "PR modificato ✅" : "PR salvato ✅");
      setConfirmType("success");
      closeModal();
    } catch (e: any) {
      setConfirmMessage(`Errore nel salvataggio: ${String(e?.message || e)}`);
      setConfirmType("error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <TopBar title="I miei PR" />
      <div className="container">
        <div className="card" style={{ marginTop: 20 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>Personal Records</h2>
            <button className="btn btnPrimary" onClick={openCreateModal} disabled={isExpired}>
              Nuovo PR
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            <input
              className="input"
              placeholder="Cerca PR per nome..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          {isExpired && (
            <div style={{ marginTop: 10, color: "#ff6b6b" }}>
              Abbonamento scaduto: non puoi aggiungere nuovi PR.
            </div>
          )}

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
                Seleziona un PR di carico e calcola subito i kg alle varie percentuali del massimale.
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
              Salva almeno un PR di chili per usare il calcolatore.
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
                    <option value="0.5">0,5 kg</option>
                    <option value="1">1 kg</option>
                    <option value="2.5">2,5 kg</option>
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
            Nessun PR nel filtro selezionato.
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

                <div className="row" style={{ marginTop: 12 }}>
                  <button className="btn" style={getKindUi(item.kind || "time").editBtn} onClick={() => openEditModal(item)}>
                    Modifica PR
                  </button>
                  <button className="btn btnDanger" onClick={() => requestDeletePr(item)}>
                    Elimina PR
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
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
            padding: 16,
          }}
          onClick={closeModal}
        >
          <div
            className="card"
            style={{ width: "min(96vw, 520px)", marginTop: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>{editingId ? "Modifica PR" : "Nuovo PR"}</h3>

            <div style={{ marginTop: 10 }}>
              <label style={{ fontSize: 12, opacity: 0.75 }}>Nome PR</label>
              <input
                className="input"
                placeholder="Es. Fran / Back Squat"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 12, opacity: 0.75, display: "block", marginBottom: 6 }}>
                Tipo PR
              </label>
              <div className="row">
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="radio"
                    name="pr-kind"
                    checked={kind === "time"}
                    onChange={() => setKind("time")}
                  />
                  PR di tempo (WOD)
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="radio"
                    name="pr-kind"
                    checked={kind === "weight"}
                    onChange={() => setKind("weight")}
                  />
                  PR di chili
                </label>
              </div>
            </div>

            {kind === "time" ? (
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, opacity: 0.75 }}>Tempo</label>
                <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, opacity: 0.75, display: "block", marginBottom: 6 }}>Minuti</label>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      max={180}
                      value={timeMinutes}
                      onChange={(e) => setTimeMinutes(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, opacity: 0.75, display: "block", marginBottom: 6 }}>Secondi</label>
                    <select
                      className="input"
                      value={timeSecondsPart}
                      onChange={(e) => setTimeSecondsPart(e.target.value)}
                    >
                      {Array.from({ length: 60 }).map((_, idx) => {
                        const value = String(idx).padStart(2, "0");
                        return (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, opacity: 0.75, display: "block", marginBottom: 6 }}>
                  Dettagli PR di chili
                </label>
                <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
                  <input
                    className="input"
                    inputMode="decimal"
                    placeholder="Chili"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                  />
                  <input
                    className="input"
                    inputMode="numeric"
                    placeholder="Ripetizioni"
                    value={reps}
                    onChange={(e) => setReps(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn" onClick={closeModal} disabled={saving}>
                Annulla
              </button>
              <button className="btn btnPrimary" onClick={savePr} disabled={saving}>
                {saving ? "Salvataggio..." : editingId ? "Salva modifiche" : "Salva"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDelete && (
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
            padding: 16,
          }}
          onClick={() => {
            if (!deleting) setPendingDelete(null);
          }}
        >
          <div
            className="card"
            style={{ width: "min(94vw, 420px)", marginTop: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>⚠️ Conferma eliminazione</div>
            <div style={{ color: "rgba(245,245,247,0.75)", marginBottom: 20 }}>
              Vuoi eliminare il PR <strong>{pendingDelete.name}</strong>?
            </div>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setPendingDelete(null)} disabled={deleting}>
                Annulla
              </button>
              <button className="btn btnDanger" onClick={deletePr} disabled={deleting}>
                {deleting ? "Eliminazione..." : "Elimina PR"}
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
            padding: 16,
          }}
          onClick={() => setConfirmMessage("")}
        >
          <div className="card" style={{ width: "min(94vw, 420px)", marginTop: 0 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
              {confirmType === "success" ? "✅ Successo" : confirmType === "error" ? "❌ Errore" : "⚠️ Attenzione"}
            </div>
            <div style={{ color: "rgba(245,245,247,0.75)", marginBottom: 20 }}>{confirmMessage}</div>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn btnPrimary" onClick={() => setConfirmMessage("")}>Ok</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
