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

  const isExpired = isSubscriptionExpired(profile?.subscriptionExpiresAt);
  const daysUntilExpiry = subscriptionExpiry
    ? Math.ceil((subscriptionExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

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
        {/* Subscription Status */}
        <div className="card" style={{ marginTop: 20 }}>
          <h2>Abbonamento</h2>
          {subscriptionExpiry ? (
            <>
              <p style={{ marginTop: 12 }}>
                {isExpired ? (
                  <span style={{ color: "#ff6b6b" }}>
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
          <h2>Settimane di Programma</h2>
          {isExpired ? (
            <div style={{ marginTop: 12, color: "#ff6b6b" }}>
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
              {weeks.map((week) => (
                <Link
                  key={`${week.source}-${week.id}-${week.title}`}
                  href={week.source === "users" ? `/athlete/week/${week.id}` : `/athlete/week?weekId=${week.id}`}
                  className="card"
                  style={{
                    cursor: "pointer",
                    padding: 16,
                    backgroundColor: "rgba(245, 245, 247, 0.05)",
                    borderRadius: 8,
                    transition: "background-color 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as any).style.backgroundColor =
                      "rgba(245, 245, 247, 0.1)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as any).style.backgroundColor =
                      "rgba(245, 245, 247, 0.05)";
                  }}
                >
                  <strong>{week.title}</strong>
                </Link>
              ))}
            </div>
          )}
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
