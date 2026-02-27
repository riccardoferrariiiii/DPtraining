import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Guard } from '../../components/Guard';
import { TopBar } from '../../components/TopBar';
import { db } from '../../lib/firebase';
import { paths } from '../../lib/paths';

function WorkoutResultForm({ athleteUid, weekId, weekTitle, dayId, dayLabel, workout }: any) {
  const [weightKg, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [timeSeconds, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [entries, setEntries] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmType, setConfirmType] = useState<"success" | "error" | "warning">("success");

  useEffect(() => {
    if (!athleteUid || !weekId || !dayId || !workout?.id) return;
    const qResults = query(
      collection(db, paths.results(athleteUid)),
      where('weekId', '==', weekId),
      where('dayId', '==', dayId),
      where('workoutId', '==', workout.id),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(qResults, (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [athleteUid, weekId, dayId, workout?.id]);

  async function save() {
    setSaving(true);
    try {
      const value: any = {};
      const w = parseFloat(weightKg); if (!Number.isNaN(w)) value.weightKg = w;
      const r = parseInt(reps, 10); if (!Number.isNaN(r)) value.reps = r;
      const t = parseInt(timeSeconds, 10); if (!Number.isNaN(t)) value.timeSeconds = t;
      const n = notes.trim(); if (n) value.notes = n;

      await addDoc(collection(db, paths.results(athleteUid)), {
        athleteUid, weekId, dayId, workoutId: workout.id,
        weekTitle: weekTitle || '',
        workoutTitle: workout.title || '',
        workoutType: workout.type || '',
        dayLabel: dayLabel || '',
        value,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setWeight(''); setReps(''); setTime(''); setNotes('');
      setConfirmMessage('Salvato ✅');
      setConfirmType('success');
    } catch (e: any) {
      setConfirmMessage('Errore: ' + (e?.message ?? e));
      setConfirmType('error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="kpi" style={{alignItems:'flex-start'}}>
        <div style={{maxWidth:640}}>
          <div className="badge">{workout.type}</div>
          <h2 className="h2" style={{marginTop:10}}>{workout.title}</h2>
          <pre style={{whiteSpace:'pre-wrap', margin:'6px 0 0', color:'rgba(245,245,247,0.88)'}}>{workout.description}</pre>
        </div>
        <div className="small" style={{textAlign:'right'}}>
          <div>Order</div>
          <div style={{fontWeight:800, color:'rgba(255,255,255,0.9)'}}>{workout.order}</div>
        </div>
      </div>

      <div className="hr" />
      <div className="grid" style={{gridTemplateColumns:'repeat(3, minmax(0,1fr))', gap:12}}>
        <input className="input" inputMode="decimal" placeholder="Peso (kg)" value={weightKg} onChange={e=>setWeight(e.target.value)} />
        <input className="input" inputMode="numeric" placeholder="Reps" value={reps} onChange={e=>setReps(e.target.value)} />
        <input className="input" inputMode="numeric" placeholder="Tempo (sec)" value={timeSeconds} onChange={e=>setTime(e.target.value)} />
      </div>
      <div style={{marginTop:12}}>
        <input className="input" placeholder="Note (opzionale)" value={notes} onChange={e=>setNotes(e.target.value)} />
      </div>
      <div className="row" style={{marginTop:12}}>
        <button className="btn btnPrimary" onClick={save} disabled={saving}>{saving ? '...' : 'Salva risultato'}</button>
      </div>
      <div className="footerHint">Tip: lascia vuoti i campi che non ti servono (es. solo tempo).</div>

      {entries.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="small" style={{ marginBottom: 8 }}>I tuoi risultati e commenti coach</div>
          <div className="stack" style={{ gap: 8 }}>
            {entries.map((entry) => (
              <div key={entry.id} style={{
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 12,
                padding: 10,
                background: 'rgba(255,255,255,0.04)'
              }}>
                <div className="row" style={{ gap: 8 }}>
                  {entry.value?.weightKg !== undefined && <span className="badge">Peso: {entry.value.weightKg} kg</span>}
                  {entry.value?.reps !== undefined && <span className="badge">Reps: {entry.value.reps}</span>}
                  {entry.value?.timeSeconds !== undefined && <span className="badge">Tempo: {entry.value.timeSeconds}s</span>}
                </div>
                {entry.value?.notes && (
                  <div className="small" style={{ marginTop: 6 }}>Le tue note: {entry.value.notes}</div>
                )}
                {entry.coachComment && (
                  <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: 'rgba(100,149,237,0.15)' }}>
                    <strong>Coach:</strong> {entry.coachComment}
                  </div>
                )}
              </div>
            ))}
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
          }}
          onClick={() => setConfirmMessage("")}
        >
          <div
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.08))",
              border: "1px solid rgba(255,255,255,0.16)",
              borderRadius: 18,
              padding: 24,
              maxWidth: 420,
              boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
              {confirmType === "success" ? "✅ Successo" : confirmType === "error" ? "❌ Errore" : "⚠️ Attenzione"}
            </div>
            <div style={{ color: "rgba(245,245,247,0.75)", marginBottom: 20 }}>
              {confirmMessage}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btnPrimary" onClick={() => setConfirmMessage("")}>
                Ok
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Day() {
  const router = useRouter();
  const weekId = (router.query.weekId as string) || '';
  const dayId = (router.query.dayId as string) || '';
  const [day, setDay] = useState<any>(null);
  const [week, setWeek] = useState<any>(null);
  const [workouts, setWorkouts] = useState<any[]>([]);

  return (
    <Guard>
      {({ user }: any) => {
        useEffect(() => {
          if (!weekId || !dayId) return;
          const wref = doc(db, `users/${user.uid}/weeks/${weekId}`);
          const unsubWeek = onSnapshot(wref, (s) => setWeek({ id: s.id, ...s.data() }));
          const dref = doc(db, `${paths.days(user.uid, weekId)}/${dayId}`);
          const unsubDay = onSnapshot(dref, (s) => setDay({ id: s.id, ...s.data() }));
          const q = query(collection(db, paths.workouts(user.uid, weekId, dayId)), orderBy('order', 'asc'));
          const unsubW = onSnapshot(q, (snap) => setWorkouts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
          return () => { unsubWeek(); unsubDay(); unsubW(); };
        }, [user.uid, weekId, dayId]);

        const pageTitle = week?.title && day?.label 
          ? `${week.title} • ${day.label}` 
          : day?.label || 'Giorno';

        return (
          <>
            <TopBar title={pageTitle} />
            <div className="container">
              {workouts.length === 0 ? (
                <div className="card">
                  <div className="badge">Rest day</div>
                  <h1 className="h1">Nessun workout oggi</h1>
                  <p className="p">Se ti manca qualcosa, scrivi al coach.</p>
                </div>
              ) : (
                <div className="stack">
                  {workouts.map(w => (
                    <WorkoutResultForm key={w.id} athleteUid={user.uid} weekId={weekId} weekTitle={week?.title} dayId={dayId} dayLabel={day?.label || ''} workout={w} />
                  ))}
                </div>
              )}
            </div>
          </>
        );
      }}
    </Guard>
  );
}
