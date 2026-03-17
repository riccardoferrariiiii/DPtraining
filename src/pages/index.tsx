import { useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "../lib/session";

export default function Index() {
  const router = useRouter();
  const { user, profile, loading } = useSession();

  useEffect(() => {
    if (loading) return;

    // non loggato -> login
    if (!user) {
      router.replace("/login");
      return;
    }

    // fallback robusto: non restare bloccato se il profilo ritarda.
    if (!profile) {
      router.replace("/athlete-home");
      return;
    }

    // smistamento
    if (profile.role === "coach") router.replace("/coach/program");
    else router.replace("/athlete-home");
  }, [loading, user, profile, router]);

  return (
    <div className="container">
      <div className="card" style={{ marginTop: 20 }}>
        Caricamento...
      </div>
    </div>
  );
}