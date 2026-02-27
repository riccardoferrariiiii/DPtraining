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
        <link rel="icon" href="/logo.svg?v=4" type="image/svg+xml" />
        <link rel="shortcut icon" href="/logo.svg?v=4" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/logo.svg?v=4" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
