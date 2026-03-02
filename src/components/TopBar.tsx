import { useRouter } from "next/router";
import { useSession } from "../lib/session";
import { signOut } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

type InAppNotification = {
  id: string;
  title?: string;
  message?: string;
  link?: string;
  readAt?: any;
  createdAt?: any;
};

export function TopBar({ title }: { title: string }) {
  const router = useRouter();
  const { user, profile } = useSession();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const logout = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  const goHome = () => {
    router.push("/");
  };

  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      return;
    }

    const qNotifications = query(
      collection(db, "users", user.uid, "notifications"),
      orderBy("createdAt", "desc"),
      limit(30)
    );

    const unsub = onSnapshot(qNotifications, (snap) => {
      setNotifications(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }))
      );
    });

    return () => unsub();
  }, [user?.uid]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.readAt).length,
    [notifications]
  );

  const markAllAsRead = async () => {
    if (!user?.uid) return;

    const unread = notifications.filter((n) => !n.readAt);
    if (unread.length === 0) return;

    const batch = writeBatch(db);
    unread.forEach((n) => {
      batch.update(doc(db, "users", user.uid, "notifications", n.id), {
        readAt: serverTimestamp(),
      });
    });
    await batch.commit();
  };

  const openNotifications = async () => {
    setNotificationsOpen(true);
    await markAllAsRead();
  };

  const openNotificationItem = (n: InAppNotification) => {
    setNotificationsOpen(false);
    if (n.link) {
      router.push(n.link);
      return;
    }
    goHome();
  };

  const deleteNotificationItem = async (id: string) => {
    if (!user?.uid) return;
    await deleteDoc(doc(db, "users", user.uid, "notifications", id));
  };

  const clearNotifications = async () => {
    if (!user?.uid) return;
    if (notifications.length === 0) return;

    const batch = writeBatch(db);
    notifications.forEach((n) => {
      batch.delete(doc(db, "users", user.uid, "notifications", n.id));
    });
    await batch.commit();
  };

  return (
    <>
      <div className="topbar">
        <div className="topbarInner">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/logo.svg?v=4" alt="TRAINED" style={{ width: 32, height: 32 }} />
            <h2 style={{ cursor: "pointer", margin: 0, fontSize: 16, fontWeight: 700 }} onClick={goHome}>
              {title}
            </h2>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={openNotifications} className="btn" style={{ position: "relative" }}>
              Notifiche
              {unreadCount > 0 && (
                <span
                  style={{
                    marginLeft: 8,
                    borderRadius: 999,
                    background: "rgba(190,16,16,0.95)",
                    color: "#fff",
                    minWidth: 22,
                    height: 22,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "0 6px",
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>
            <button onClick={goHome} className="btn" style={{ marginRight: 10 }}>
              Home
            </button>
            <button onClick={logout} className="btn">
              Logout
            </button>
          </div>
        </div>
      </div>

      {notificationsOpen && (
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
          }}
          onClick={() => setNotificationsOpen(false)}
        >
          <div
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.08))",
              border: "1px solid rgba(255,255,255,0.16)",
              borderRadius: 18,
              padding: 20,
              width: "min(92vw, 560px)",
              maxHeight: "80vh",
              overflowY: "auto",
              boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Notifiche</div>

            {notifications.length === 0 ? (
              <div className="small">Nessuna notifica.</div>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 12,
                      padding: 10,
                      background: "rgba(255,255,255,0.04)",
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{n.title || "Notifica"}</div>
                    <div className="small" style={{ opacity: 0.9, marginBottom: 10 }}>{n.message || ""}</div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button className="btn" onClick={() => openNotificationItem(n)}>
                        Apri
                      </button>
                      <button className="btn btnDanger" onClick={() => deleteNotificationItem(n.id)}>
                        Elimina
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
              <button className="btn btnDanger" onClick={clearNotifications} disabled={notifications.length === 0}>
                Elimina tutte
              </button>
              <button className="btn btnPrimary" onClick={() => setNotificationsOpen(false)}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}