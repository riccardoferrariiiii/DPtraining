import { rm, access, cp } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve, relative, sep } from "node:path";
import { spawn } from "node:child_process";

const rootDir = resolve(process.cwd());
const webDir = resolve(rootDir, "web");
const webNextDir = resolve(webDir, ".next");
const rootNextDir = resolve(rootDir, ".next");

async function pathExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function runNpm(args) {
  const useNpmExecPath = Boolean(process.env.npm_execpath);

  const npmCommand = useNpmExecPath
    ? process.execPath
    : process.platform === "win32"
      ? "npm.cmd"
      : "npm";

  const npmArgs = useNpmExecPath ? [process.env.npm_execpath, ...args] : args;

  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(npmCommand, npmArgs, {
      cwd: rootDir,
      stdio: "inherit",
      shell: !useNpmExecPath && process.platform === "win32",
    });

    child.on("error", (error) => rejectPromise(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new Error(`Command failed: ${npmCommand} ${npmArgs.join(" ")} (exit ${code})`));
      }
    });
  });
}

function skipDevOnly(src) {
  const rel = relative(webNextDir, src);
  if (!rel || rel === ".") return true;
  return rel !== "dev" && !rel.startsWith(`dev${sep}`);
}

async function main() {
  if (await pathExists(rootNextDir)) {
    await rm(rootNextDir, { recursive: true, force: true });
  }

  await runNpm(["ci"]);
  await runNpm(["--prefix", "web", "ci"]);
  await runNpm(["--prefix", "web", "run", "build"]);

  // Copia l'intera .next incluso `.next/node_modules` (file tracing di Next / Turbopack).
  // Escludere `node_modules` qui causava ENOENT su Vercel (es. @supabase/..., @opentelemetry/...).
  // `dereference: true` materializza i symlink verso web/node_modules.
  await cp(webNextDir, rootNextDir, {
    recursive: true,
    dereference: true,
    filter: (src) => skipDevOnly(src),
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
