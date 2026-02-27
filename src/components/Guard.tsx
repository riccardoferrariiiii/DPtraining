import { ReactNode } from "react";
import { useSession } from "../lib/session";

export function Guard({ children }: { children: ReactNode }) {
  const { user, loading } = useSession();

  if (loading) return <div className="container">Caricamento...</div>;
  if (!user) return <div className="container">Devi fare login.</div>;

  return <>{children}</>;
}