import type { AppProps } from "next/app";
import { Analytics } from "@vercel/analytics/next";
import "../styles/globals.css";
import { SessionProvider } from "../lib/session";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <SessionProvider>
      <Component {...pageProps} />
      <Analytics />
    </SessionProvider>
  );
}