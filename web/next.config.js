const path = require("node:path");

/** @type {import('next').NextConfig} */
module.exports = {
	// Root del repo ha un altro package.json con "next" → Next assume monorepo e
	// imposta outputFileTracingRoot sul parent; turbopack.root era solo `web/`.
	// Valori diversi → warning e path errati (ENOENT … /vercel/node_modules/@opentelemetry/…).
	outputFileTracingRoot: path.join(__dirname),
	turbopack: { root: path.join(__dirname) },
	images: { unoptimized: true },
	serverExternalPackages: ["firebase-admin"],
};
