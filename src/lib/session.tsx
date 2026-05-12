import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, onSnapshot } from "firebase/firestore";

export type Profile = {
  email?: string;
  role?: "coach" | "athlete";
  subscriptionExpiresAt?: any;
};

export type Session = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
};

const SessionContext = createContext<Session | null>(null);

/**
 * Utilità globale per controllare se un abbonamento è scaduto.
 * Supporta: Timestamp Firestore, Date, numero (ms), string ISO.
 * La data rappresenta l'istante di scadenza: scade allo scoccare
 * della mezzanotte del giorno indicato.
 */
export function isSubscriptionExpired(raw: any): boolean {
  if (!raw) return false;

  let expiry: Date | null = null;

  // Firestore Timestamp
  if (raw?.toDate && typeof raw.toDate === "function") {
    try {
      expiry = raw.toDate();
    } catch {
      return false;
    }
  }
  // Date object
  else if (raw instanceof Date) {
    expiry = raw;
  }
  // Numero (ms)
  else if (typeof raw === "number") {
    expiry = new Date(raw);
  }
  // String ISO
  else if (typeof raw === "string") {
    expiry = new Date(raw);
  }

  if (!expiry || isNaN(expiry.getTime())) return false;

  const now = new Date();
  const expiryDayStart = new Date(expiry);
  expiryDayStart.setHours(0, 0, 0, 0);

  const isExpired = now >= expiryDayStart;
  
  return isExpired;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(
      auth,
      (u) => {
        setUser(u);
        if (!u) {
          setProfile(null);
          setLoading(false);
          return;
        }

        // Keep loading true until profile listener resolves the role.
        setLoading(true);
      },
      () => {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    );

    return () => {
      unsubAuth();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = doc(db, "users", user.uid);
    const unsubProfile = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setProfile({ role: "athlete", email: user.email || "" });
          setLoading(false);
          return;
        }
        setProfile(snap.data() as Profile);
        setLoading(false);
      },
      () => {
        // Fallback: evita schermate bloccate anche se il profilo non e leggibile.
        setProfile({ role: "athlete", email: user.email || "" });
        setLoading(false);
      }
    );

    return () => unsubProfile();
  }, [user]);

  const value = useMemo(
    () => ({ user, profile, loading }),
    [user, profile, loading]
  );

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): Session {
  const v = useContext(SessionContext);
  if (!v) {
    // Fallback difensivo: meglio mostrare login che restare in caricamento infinito.
    return { user: null, profile: null, loading: false };
  }
  return v;
} 