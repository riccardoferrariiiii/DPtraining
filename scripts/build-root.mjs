import { rm, access, cp } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import { constants } from "node:fs";
import { resolve, relative, sep } from "node:path";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const rootDir = resolve(process.cwd());
const webNextDir = resolve(rootDir, "web", ".next");
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

/**
 * Copia web/.next → root/.next includendo `.next/node_modules` (tracing Next).
 * NON usare fs.cp({ dereference: true }): su Linux può lanciare EISDIR su alcuni symlink/cartelle.
 * Su Vercel (Linux) usiamo rsync --copy-links o cp -aL.
 */
async function copyNextToRoot() {
  await rm(rootNextDir, { recursive: true, force: true });
  mkdirSync(rootNextDir, { recursive: true });

  const isWin = process.platform === "win32";

  if (!isWin) {
    try {
      await execFileAsync(
        "rsync",
        ["-a", "--copy-links", "--exclude=dev/", `${webNextDir}/`, `${rootNextDir}/`],
        { cwd: rootDir, maxBuffer: 64 * 1024 * 1024 },
      );
      return;
    } catch (e) {
      console.warn("[build-root] rsync failed, trying cp -aL:", e?.message || e);
    }

    try {
      await execFileAsync("cp", ["-aL", `${webNextDir}/.`, `${rootNextDir}/`], {
        cwd: rootDir,
        maxBuffer: 64 * 1024 * 1024,
      });
      await rm(resolve(rootNextDir, "dev"), { recursive: true, force: true }).catch(() => {});
      return;
    } catch (e2) {
      console.warn("[build-root] cp -aL failed, falling back to Node fs.cp:", e2?.message || e2);
    }
  }

  await cp(webNextDir, rootNextDir, {
    recursive: true,
    dereference: false,
    filter: (src) => skipDevOnly(src),
  });
}

async function main() {
  if (await pathExists(rootNextDir)) {
    await rm(rootNextDir, { recursive: true, force: true });
  }

  await runNpm(["ci"]);
  await runNpm(["--prefix", "web", "ci"]);
  await runNpm(["--prefix", "web", "run", "build"]);

  await copyNextToRoot();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
