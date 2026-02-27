// ✅ INCOLLA QUESTO FILE COMPLETO
// 📄 src/pages/athlete/week/[id].tsx
// (se il problema è PERMESSIONI, te lo stampa a schermo con l’errore reale)

import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { RoleGuard } from "../../../components/RoleGuard";
import { TopBar } from "../../../components/TopBar";
import { useSession, isSubscriptionExpired } from "../../../lib/session";
import { db } from "../../../lib/firebase";
import {
  doc,
  getDoc,
  onSnapshot,
  collection,
  query,
  orderBy,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

type TemplateDay = {
  id: string;
  order: number;
  workout: string;
};

export default function AthleteWeekPage() {
  return (
    <RoleGuard role="athlete">
      <AthleteWeekInner />
    </RoleGuard>
  );
}

function AthleteWeekInner() {
  const router = useRouter();
  const weekId = router.query.id as string;
  const { user, profile } = useSession();

  const [templateId, setTemplateId] = useState<string | null>(null);
  const [title, setTitle] = useState("Settimana");
  const [days, setDays] = useState<TemplateDay[]>([]);
  const [results, setResults] = useState<Record<string, string>>({});
  const [coachComments, setCoachComments] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);

  const subscriptionExpiry = profile?.subscriptionExpiresAt?.toDate?.()
    ? new Date(profile.subscriptionExpiresAt.toDate())
    : profile?.subscriptionExpiresAt instanceof Date
    ? profile.subscriptionExpiresAt
    : null;
  const isExpired = isSubscriptionExpired(profile?.subscriptionExpiresAt);

  // week -> templateId
  useEffect(() => {
    if (isExpired) {
      setTemplateId(null);
      setDays([]);
      return;
    }
    if (!user || !weekId) return;

    (async () => {
      try {
        const wSnap = await getDoc(doc(db, "users", user.uid, "weeks", weekId));
        if (!wSnap.exists()) {
          setErr("Week non trovata in users/{uid}/weeks/{weekId}");
          return;
        }
        const data = wSnap.data() as any;
        setTemplateId(data.templateId || null);
        setTitle(data.title || "Settimana");
      } catch (e: any) {
        setErr(String(e?.message || e));
      }
    })();
  }, [isExpired, user, weekId]);

  // template title live + days live
  useEffect(() => {
    if (!templateId) return;

    const unsubTemplate = onSnapshot(
      doc(db, "programTemplates", templateId),
      (snap) => {
        if (snap.exists()) {
          setTitle(((snap.data() as any).title || "Settimana") as string);
        }
      },
      (e) => setErr(`Template read error: ${String((e as any)?.message || e)}`)
    );

    const qDays = query(
      collection(db, "programTemplates", templateId, "days"),
      orderBy("order", "asc")
    );

    const unsubDays = onSnapshot(
      qDays,
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            order: Number(data.order ?? 0),
            workout: data.workout ?? "",
          } as TemplateDay;
        });
        list.sort((a, b) => a.order - b.order);
        setDays(list);
      },
      (e) => setErr(`Days read error: ${String((e as any)?.message || e)}`)
    );

    return () => {
      unsubTemplate();
      unsubDays();
    };
  }, [templateId]);

  // results
  useEffect(() => {
    if (!user || !weekId) return;

    const qRes = query(
      collection(db, "users", user.uid, "weeks", weekId, "results"),
      orderBy("updatedAt", "desc")
    );

    const unsub = onSnapshot(
      qRes,
      (snap) => {
        const map: Record<string, string> = {};
        const comments: Record<string, string> = {};
        snap.docs.forEach((d) => {
          const data = d.data() as any;
          map[d.id] = (data.result || "") as string;
          comments[d.id] = (data.coachComment || "") as string;
        });
        setResults(map);
        setCoachComments(comments);
      },
      (e) => setErr(`Results read error: ${String((e as any)?.message || e)}`)
    );

    return () => unsub();
  }, [user, weekId]);

  const pageTitle = useMemo(() => title, [title]);

  const saveResult = async (day: TemplateDay) => {
    if (isExpired) {
      setErr("Abbonamento scaduto: non puoi salvare risultati.");
      return;
    }
    if (!user || !weekId) return;
    try {
      await setDoc(
        doc(db, "users", user.uid, "weeks", weekId, "results", day.id),
        {
          result: (draft[day.id] ?? results[day.id] ?? "").trim(),
          dayOrder: day.order,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e: any) {
      setErr(`Save result error: ${String(e?.message || e)}`);
    }
  };

  return (
    <>
      <TopBar title={pageTitle} />
      <div className="container" style={{ paddingBottom: 40 }}>
        {isExpired ? (
          <div className="card" style={{ marginTop: 16, color: "#ff6b6b" }}>
            Abbonamento scaduto: non puoi visualizzare le settimane.
          </div>
        ) : (
          <>
            {err && (
              <div className="card" style={{ marginTop: 16 }}>
                <b>ERRORE:</b>
                <div style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{err}</div>
              </div>
            )}

            {!templateId && !err && (
              <div className="card" style={{ marginTop: 16 }}>
                Settimana non valida: manca templateId.
              </div>
            )}

            {templateId && days.length === 0 && !err && (
              <div className="card" style={{ marginTop: 16 }}>
                Nessun giorno nel template.
              </div>
            )}

            {days.map((day) => (
              <div key={day.id} className="card" style={{ marginTop: 18 }}>
                <h3 style={{ marginBottom: 10 }}>Giorno {day.order}</h3>

                <div style={{ whiteSpace: "pre-wrap" }}>{day.workout || "—"}</div>

                <div style={{ marginTop: 14 }}>
                  <label style={{ fontSize: 12, opacity: 0.75 }}>
                    Il tuo risultato
                  </label>

                  <textarea
                    className="input"
                    style={{ width: "100%", minHeight: 110, marginTop: 8 }}
                    value={draft[day.id] ?? results[day.id] ?? ""}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, [day.id]: e.target.value }))
                    }
                  />

                  <button className="btn" style={{ marginTop: 10 }} onClick={() => saveResult(day)}>
                    Salva risultato
                  </button>

                  {coachComments[day.id] && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 10,
                        borderRadius: 10,
                        background: "rgba(100,149,237,0.15)",
                        border: "1px solid rgba(100,149,237,0.35)",
                      }}
                    >
                      <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Commento coach</div>
                      <div style={{ whiteSpace: "pre-wrap" }}>{coachComments[day.id]}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}