import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="it">
      <Head>
        <meta name="application-name" content="TRAINED" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="TRAINED" />
        <meta name="theme-color" content="#050507" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/icon-192.png?v=5" sizes="192x192" type="image/png" />
        <link rel="icon" href="/icon-512.png?v=5" sizes="512x512" type="image/png" />
        <link rel="shortcut icon" href="/icon-192.png?v=5" type="image/png" />
        <link rel="apple-touch-icon" href="/icon-192.png?v=5" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
