import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { RoleGuard } from "../components/RoleGuard";
import { TopBar } from "../components/TopBar";
import { createUniqueInAppNotification } from "../lib/inAppNotifications";
import { useSession, isSubscriptionExpired } from "../lib/session";
import { db } from "../lib/firebase";

type Week = {
  id: string;
  title: string;
  source: "users" | "legacy";
  createdAt?: any;
};

function AthleteHomeInner() {
  const { user, profile } = useSession();
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPreviousWeeks, setShowPreviousWeeks] = useState(false);

  useEffect(() => {
    if (!user) return;

    let usersWeeks: Week[] = [];
    let legacyWeeks: Week[] = [];

    const syncWeeks = () => {
      const merged = [...usersWeeks, ...legacyWeeks].sort((a, b) => {
        const at = a.createdAt?.toDate?.()?.getTime?.() || 0;
        const bt = b.createdAt?.toDate?.()?.getTime?.() || 0;
        return bt - at;
      });
      setWeeks(merged);
      setLoading(false);
    };

    const unsubUsers = onSnapshot(collection(db, "users", user.uid, "weeks"), (snap) => {
      usersWeeks = snap.docs.map((d) => ({
        id: d.id,
        title: (d.data() as any).title || "Settimana",
        source: "users" as const,
        createdAt: (d.data() as any).createdAt,
      }));
      syncWeeks();
    });

    const unsubLegacy = onSnapshot(collection(db, "athletePrograms", user.uid, "weeks"), (snap) => {
      legacyWeeks = snap.docs.map((d) => ({
        id: d.id,
        title: (d.data() as any).title || "Settimana",
        source: "legacy" as const,
        createdAt: (d.data() as any).createdAt,
      }));
      syncWeeks();
    });

    return () => {
      unsubUsers();
      unsubLegacy();
    };
  }, [user]);

  const subscriptionExpiry = profile?.subscriptionExpiresAt?.toDate?.()
    ? new Date(profile.subscriptionExpiresAt.toDate())
    : profile?.subscriptionExpiresAt instanceof Date
    ? profile.subscriptionExpiresAt
    : null;

  const athleteName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || "Atleta";
  const athleteAge =
    profile?.dateOfBirth && typeof (profile.dateOfBirth as any)?.toDate === "function"
      ? (() => {
          const birth = (profile.dateOfBirth as any).toDate();
          const diff = Date.now() - birth.getTime();
          return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)));
        })()
      : null;

  const isExpired = isSubscriptionExpired(profile?.subscriptionExpiresAt);
  const daysUntilExpiry = subscriptionExpiry
    ? Math.ceil((subscriptionExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const visibleWeeks = showPreviousWeeks ? weeks : weeks.slice(0, 1);

  useEffect(() => {
    if (!user?.uid || !subscriptionExpiry || isExpired) return;
    if (daysUntilExpiry !== 7) return;

    const yyyy = subscriptionExpiry.getFullYear();
    const mm = String(subscriptionExpiry.getMonth() + 1).padStart(2, "0");
    const dd = String(subscriptionExpiry.getDate()).padStart(2, "0");
    const key = `${yyyy}-${mm}-${dd}`;

    createUniqueInAppNotification(user.uid, `subscription-expiring-${key}`, {
      type: "subscription_expiring",
      title: "Abbonamento in scadenza",
      message: "Il tuo abbonamento scade tra 7 giorni.",
      link: "/athlete-home",
    }).catch(() => {});
  }, [daysUntilExpiry, isExpired, subscriptionExpiry, user?.uid]);

  return (
    <>
      <TopBar title="Il Mio Programma" />
      <div className="container">
        <div
          className="card athleteHomeHero"
          style={{
            marginTop: 20,
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            gap: 16,
            alignItems: "center",
            background: "linear-gradient(135deg, rgba(47,134,199,0.18), rgba(15,15,15,0.92) 42%, rgba(47,134,199,0.06))",
            borderColor: "rgba(47,134,199,0.28)",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.32)",
          }}
        >
                <img
                  className="athleteHomeHeroImage"
                  src={profile?.photoUrl || "https://ui-avatars.com/api/?name=" + encodeURIComponent(athleteName) + "&background=2f86c7&color=070707&size=120"}
            alt={athleteName}
            style={{ width: 88, height: 88, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(47,134,199,0.5)", boxShadow: "0 16px 32px rgba(47,134,199,0.18)" }}
          />
          <div className="athleteHomeHeroInfo">
            <div style={{ opacity: 0.75, letterSpacing: 1.2, textTransform: "uppercase", fontSize: 12 }}>Performance dashboard</div>
            <h2 style={{ margin: "6px 0 8px" }}>{athleteName}</h2>
            <div className="athleteHomeHeroFacts" style={{ display: "flex", flexWrap: "wrap", gap: 10, opacity: 0.9, fontSize: 14 }}>
              {profile?.dateOfBirth && <span>Data nascita: {new Date(profile.dateOfBirth.toDate ? profile.dateOfBirth.toDate() : profile.dateOfBirth).toLocaleDateString("it-IT")}</span>}
              {profile?.weightKg && <span>Peso: {profile.weightKg} kg</span>}
              {profile?.heightCm && <span>Altezza: {profile.heightCm} cm</span>}
              {athleteAge !== null && <span>Età: {athleteAge} anni</span>}
            </div>
          </div>
          <div className="athleteHomeHeroActions">
            <Link href="/athlete/profile" className="btn">Profilo</Link>
            <Link href="/athlete/benchmarks" className="btn btnPrimary">Performance</Link>
          </div>
        </div>

        <div className="grid" style={{ marginTop: 20 }}>
          <div className="card cardHover" style={{ background: "linear-gradient(180deg, rgba(47,134,199,0.12), rgba(15,15,15,0.72))" }}>
            <div className="small">Settimane</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 8 }}>{loading ? "..." : weeks.length}</div>
            <div className="small" style={{ marginTop: 6 }}>programma attivo</div>
          </div>
          <div className="card cardHover" style={{ background: "linear-gradient(180deg, rgba(47,134,199,0.08), rgba(15,15,15,0.72))" }}>
            <div className="small">Abbonamento</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 8 }}>{isExpired ? "Scaduto" : "Attivo"}</div>
            <div className="small" style={{ marginTop: 6 }}>{subscriptionExpiry ? subscriptionExpiry.toLocaleDateString("it-IT") : "nessuna data"}</div>
          </div>
          <div className="card cardHover" style={{ background: "linear-gradient(180deg, rgba(47,134,199,0.08), rgba(15,15,15,0.72))" }}>
            <div className="small">Notifiche</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 8 }}>Push</div>
            <div className="small" style={{ marginTop: 6 }}>attivabili dal menu</div>
          </div>
        </div>

        {/* Subscription Status */}
        <div className="card" style={{ marginTop: 20 }}>
          <h2>Abbonamento</h2>
          {subscriptionExpiry ? (
            <>
              <p style={{ marginTop: 12 }}>
                {isExpired ? (
                  <span style={{ color: "#2f86c7" }}>
                    <strong>Abbonamento scaduto</strong>
                  </span>
                ) : (
                  <span>
                    Scade il{" "}
                    <strong>
                      {subscriptionExpiry.toLocaleDateString("it-IT", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </strong>
                  </span>
                )}
              </p>
              {!isExpired && daysUntilExpiry !== null && (
                <p style={{ opacity: 0.8, fontSize: 14, marginTop: 6 }}>
                  {daysUntilExpiry > 0
                    ? `Mancano ${daysUntilExpiry} giorni`
                    : "Scade oggi"}
                </p>
              )}
            </>
          ) : (
            <p style={{ opacity: 0.8 }}>Nessuna informazione abbonamento</p>
          )}
        </div>

        {/* Weeks List */}
        <div className="card" style={{ marginTop: 20 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Personal Records</h2>
          </div>

          <div style={{ opacity: 0.8, marginBottom: 16 }}>
            Inserisci e aggiorna i tuoi massimali e benchmark WOD.
          </div>

          <div className="hr" />

          <h2>Settimane di Programma</h2>
          {isExpired ? (
            <div style={{ marginTop: 12, color: "#2f86c7" }}>
              Abbonamento scaduto: non puoi visualizzare le settimane finché il coach non rinnova l'abbonamento.
            </div>
          ) : loading ? (
            <div style={{ marginTop: 12, opacity: 0.8 }}>Caricamento...</div>
          ) : weeks.length === 0 ? (
            <div style={{ marginTop: 12, opacity: 0.8 }}>
              Nessuna settimana assegnata ancora. Contatta il tuo coach.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
              {visibleWeeks.map((week, index) => (
                <Link
                  key={`${week.source}-${week.id}-${week.title}`}
                  href={week.source === "users" ? `/athlete/week/${week.id}` : `/athlete/week?weekId=${week.id}`}
                  className="card"
                  style={{
                    cursor: "pointer",
                    padding: 18,
                    borderRadius: 18,
                    border: index === 0 ? "1px solid rgba(47, 134, 199, 0.26)" : "1px solid rgba(255,255,255,0.09)",
                    background: index === 0
                      ? "linear-gradient(135deg, rgba(47, 134, 199, 0.10), rgba(10, 11, 13, 0.96))"
                      : "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(10, 10, 12, 0.82))",
                    boxShadow: index === 0 ? "0 18px 42px rgba(47, 134, 199, 0.10)" : "0 10px 28px rgba(0, 0, 0, 0.32)",
                    transition: "transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
                    transform: "translateY(0)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as any).style.transform = "translateY(-2px)";
                    (e.currentTarget as any).style.borderColor = "rgba(47, 134, 199, 0.42)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as any).style.transform = "translateY(0)";
                    (e.currentTarget as any).style.borderColor = index === 0 ? "rgba(47, 134, 199, 0.26)" : "rgba(255,255,255,0.09)";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.7, marginBottom: 6 }}>
                        {index === 0 ? "Settimana corrente" : "Settimana precedente"}
                      </div>
                      <strong style={{ fontSize: 20, letterSpacing: "-0.02em" }}>{week.title}</strong>
                    </div>
                    {index === 0 && weeks.length > 1 && (
                      <span className="badge" style={{ background: "rgba(47, 134, 199, 0.12)", borderColor: "rgba(47, 134, 199, 0.42)", color: "#F8F4EA" }}>Live</span>
                    )}
                  </div>
                </Link>
              ))}

              {weeks.length > 1 && (
                <button
                  className="btn"
                  onClick={() => setShowPreviousWeeks((prev) => !prev)}
                  style={{ alignSelf: "flex-start", marginTop: 6 }}
                >
                  {showPreviousWeeks ? "Nascondi settimane precedenti" : `Mostra settimane precedenti (${weeks.length - 1})`}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="card" style={{ marginTop: 20 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <h2 style={{ margin: 0 }}>Visualizza File</h2>
              <div style={{ opacity: 0.8, marginBottom: 16 }}>
                Scarica i file e i materiali che il coach ha preparato per te.
              </div>
            </div>
            <Link href="/athlete/files" className="btn btnPrimary">
              Apri file
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

export default function AthleteHome() {
  return (
    <RoleGuard role="athlete">
      <AthleteHomeInner />
    </RoleGuard>
  );
}
