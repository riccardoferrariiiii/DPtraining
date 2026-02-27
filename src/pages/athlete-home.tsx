import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import Link from "next/link";
import { RoleGuard } from "../components/RoleGuard";
import { TopBar } from "../components/TopBar";
import { useSession } from "../lib/session";
import { db } from "../lib/firebase";

type Week = {
  id: string;
  title: string;
  createdAt?: any;
};

function AthleteHomeInner() {
  const { user, profile } = useSession();
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "users", user.uid, "weeks"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        title: (d.data() as any).title || "Settimana",
        createdAt: (d.data() as any).createdAt,
      }));
      setWeeks(list);
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  const subscriptionExpiry = profile?.subscriptionExpiresAt?.toDate?.()
    ? new Date(profile.subscriptionExpiresAt.toDate())
    : profile?.subscriptionExpiresAt instanceof Date
    ? profile.subscriptionExpiresAt
    : null;

  const isExpired = !!(subscriptionExpiry && subscriptionExpiry < new Date());
  const daysUntilExpiry = subscriptionExpiry
    ? Math.ceil((subscriptionExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

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
                  key={`${week.id}-${week.title}`}
                  href={`/athlete/week/${week.id}`}
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
