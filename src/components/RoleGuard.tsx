import { ReactNode, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "../lib/session";

type Role = "coach" | "athlete";

export function RoleGuard({
  role,
  children,
}: {
  role: Role;
  children: ReactNode;
}) {
  const router = useRouter();
  const { user, profile, loading } = useSession();

  if (loading) return <div className="container">Caricamento...</div>;
  if (!user) return <div className="container">Devi fare login.</div>;
  if (!profile) return <div className="container">Profilo non caricato.</div>;

  const hasAccess =
    profile.role === role ||
    (profile.role === "coach" && role === "athlete"); // coach può entrare anche in atleta

  // 🔥 AUTO-FIX: se stai nella pagina sbagliata ti rimanda dove devi stare
  useEffect(() => {
    if (hasAccess) return;

    if (profile.role === "athlete") {
      router.replace("/athlete/weeks");
      return;
    }

    if (profile.role === "coach") {
      router.replace("/coach/program");
      return;
    }
  }, [hasAccess, profile.role, router]);

  if (!hasAccess) {
    return (
      <div className="container">
        <div className="card" style={{ marginTop: 20 }}>
          <b>Non autorizzato.</b>
          <div style={{ marginTop: 10, opacity: 0.8, fontSize: 14 }}>
            Role richiesto: {role}
            <br />
            Role letto dal DB: {String(profile.role)}
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => router.replace("/athlete/weeks")}>
              Vai area Atleta
            </button>
            <button className="btn" onClick={() => router.replace("/coach/program")}>
              Vai area Coach
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}