import { ReactNode } from "react";
import { useSession } from "../lib/session";

type GuardChildren = ReactNode | ((args: { user: any }) => ReactNode);

export function Guard({ children }: { children: GuardChildren }) {
  const { user, profile, loading } = useSession();

  if (loading) return <div className="container">Caricamento...</div>;
  if (!user) return <div className="container">Devi fare login.</div>;

  // Se il profilo è stato disabilitato (soft-delete), mostra messaggio.
  if ((profile as any)?.disabled) {
    return (
      <div className="container">
        Il tuo account è stato rimosso. Contatta il coach per assistenza.
      </div>
    );
  }

  if (typeof children === "function") {
    return <>{children({ user })}</>;
  }

  return <>{children}</>;
}