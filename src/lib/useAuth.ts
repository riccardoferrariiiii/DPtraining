import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { auth, db } from './firebase';
import { paths } from './paths';

export function useAuthWithProfile() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setProfile(null);

      if (!u) {
        setLoading(false);
        return;
      }

      const ref = doc(db, paths.user(u.uid));
      const snap = await getDoc(ref);

      // IMPORTANT:
      // - If the user doc does NOT exist -> create it with role "athlete"
      // - If it exists -> NEVER overwrite role (so coach stays coach)
      if (!snap.exists()) {
        await setDoc(ref, {
          email: u.email ?? '',
          role: 'athlete',
          subscriptionExpiresAt: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } else {
        await setDoc(ref, {
          email: u.email ?? '',
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      const unsubProfile = onSnapshot(ref, (s) => {
        setProfile(s.data() ?? null);
        setLoading(false);
      });

      return () => unsubProfile();
    });

    return () => unsub();
  }, []);

  return { user, profile, loading };
}
