import type { AppProps } from "next/app";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { useEffect } from "react";
import "../styles/globals.css";
import { SessionProvider } from "../lib/session";

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    const markerKey = "__trained_chunk_recovery__";

    const shouldRecover = (text: string) => {
      const msg = String(text || "").toLowerCase();
      return (
        msg.includes("loading chunk") ||
        msg.includes("chunkloaderror") ||
        msg.includes("dynamically imported module") ||
        msg.includes("_ssgmanifest") ||
        msg.includes("_buildmanifest")
      );
    };

    const recover = () => {
      if (sessionStorage.getItem(markerKey) === "1") return;
      sessionStorage.setItem(markerKey, "1");
      const sep = window.location.search ? "&" : "?";
      window.location.replace(`${window.location.pathname}${window.location.search}${sep}v=${Date.now()}`);
    };

    const onError = (event: ErrorEvent) => {
      const details = `${event.message || ""} ${(event.filename || "")}`;
      if (shouldRecover(details)) recover();
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = (event.reason && (event.reason.message || event.reason.toString?.())) || "";
      if (shouldRecover(String(reason))) recover();
    };

    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return (
    <SessionProvider>
      <Component {...pageProps} />
      <Analytics />
      <SpeedInsights />
    </SessionProvider>
  );
}