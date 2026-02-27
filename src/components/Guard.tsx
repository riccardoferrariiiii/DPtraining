import { ReactNode } from "react";
import { useSession } from "../lib/session";

type GuardChildren = ReactNode | ((args: { user: any }) => ReactNode);

export function Guard({ children }: { children: GuardChildren }) {
  const { user, loading } = useSession();

  if (loading) return <div className="container">Caricamento...</div>;
  if (!user) return <div className="container">Devi fare login.</div>;

  if (typeof children === "function") {
    return <>{children({ user })}</>;
  }

  return <>{children}</>;
}