import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Guard } from '../../components/Guard';
import { TopBar } from '../../components/TopBar';
import { db } from '../../lib/firebase';
import { paths } from '../../lib/paths';

export default function Week() {
  const router = useRouter();
  const weekId = (router.query.weekId as string) || '';
  const [week, setWeek] = useState<any>(null);
  const [days, setDays] = useState<any[]>([]);

  return (
    <Guard>
      {({ user }: any) => {
        useEffect(() => {
          if (!weekId) return;
          const wref = doc(db, paths.week(user.uid, weekId));
          const unsubWeek = onSnapshot(wref, (s) => setWeek({ id: s.id, ...s.data() }));
          const q = query(collection(db, paths.days(user.uid, weekId)), orderBy('date', 'asc'));
          const unsubDays = onSnapshot(q, (snap) => setDays(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
          return () => { unsubWeek(); unsubDays(); };
        }, [user.uid, weekId]);

        return (
          <>
            <TopBar title={week?.title || 'Settimana'} />
            <div className="container">
              {days.length === 0 && <div className="card cardHover">Nessun giorno ancora.</div>}
              <div className="row">
                {days.map(d => {
                  const date = d.date?.toDate?.();
                  return (
                    <Link key={d.id} href={`/athlete/day?weekId=${weekId}&dayId=${d.id}`} className="card cardHover" style={{flex:'1 1 280px'}}>
                      <strong>{d.label}</strong>
                      <div className="small" style={{marginTop:6}}>
                        {date ? date.toLocaleDateString('it-IT', { weekday:'long', day:'2-digit', month:'2-digit' }) : '-'}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </>
        );
      }}
    </Guard>
  );
}
