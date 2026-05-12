/**
 * Dopo `next build` in `web/`, copia `web/.next` → `.next` nella root del repo.
 * Vercel (root del repo) si aspetta `.next` qui, non in `web/.next`.
 * Usa `cp -a` su Linux (no fs.cp dereference → niente EISDIR). Su Windows: fs.cp senza dereference.
 */
import { rm, cp, access } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve, relative, sep } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const rootDir = resolve(process.cwd());
const webNextDir = resolve(rootDir, "web", ".next");
const rootNextDir = resolve(rootDir, ".next");

function skipDevOnly(src) {
  const rel = relative(webNextDir, src);
  if (!rel || rel === ".") return true;
  return rel !== "dev" && !rel.startsWith(`dev${sep}`);
}

async function main() {
  await access(webNextDir, constants.F_OK);

  await rm(rootNextDir, { recursive: true, force: true }).catch(() => {});

  if (process.platform === "win32") {
    await cp(webNextDir, rootNextDir, {
      recursive: true,
      dereference: false,
      filter: (src) => skipDevOnly(src),
    });
  } else {
    await execFileAsync("cp", ["-a", "web/.next", ".next"], {
      cwd: rootDir,
      stdio: "inherit",
      maxBuffer: 64 * 1024 * 1024,
    });
  }

  await rm(resolve(rootDir, ".next", "dev"), { recursive: true, force: true }).catch(() => {});
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
