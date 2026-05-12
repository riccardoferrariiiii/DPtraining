import { rm, access, readdir, cp } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
const rootDir = resolve(process.cwd());
const webDir = resolve(rootDir, "web");
const webNextDir = resolve(webDir, ".next");
const rootNextDir = resolve(rootDir, ".next");

async function pathExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch (error) {
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

  const npmArgs = useNpmExecPath
    ? [process.env.npm_execpath, ...args]
    : args;

  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(npmCommand, npmArgs, {
      cwd: rootDir,
      stdio: "inherit",
      // On Windows, npm.cmd needs shell. Node + npm-cli.js must run without shell.
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

async function main() {
  if (await pathExists(rootNextDir)) {
    await rm(rootNextDir, { recursive: true, force: true });
  }

  // Ensure root dependencies (including @opentelemetry/api) are installed in the Vercel root
  await runNpm(["ci"]);

  // Install and build the web app
  await runNpm(["--prefix", "web", "ci"]);
  await runNpm(["--prefix", "web", "run", "build"]);

  const entries = await readdir(webNextDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "dev" || entry.name === "node_modules") {
      continue;
    }

    await cp(resolve(webNextDir, entry.name), resolve(rootNextDir, entry.name), {
      recursive: true,
      dereference: false,
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
