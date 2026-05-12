import { rm, cp, access } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
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
  if (process.env.npm_execpath) {
    await execFileAsync(process.execPath, [process.env.npm_execpath, ...args], {
      stdio: "inherit",
    });
    return;
  }

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  await execFileAsync(npmCommand, args, { stdio: "inherit" });
}

async function main() {
  await runNpm(["--prefix", "web", "ci"]);
  await runNpm(["--prefix", "web", "run", "build"]);

  if (await pathExists(rootNextDir)) {
    await rm(rootNextDir, { recursive: true, force: true });
  }

  await cp(webNextDir, rootNextDir, {
    recursive: true,
    dereference: true,
    filter: (source) => !source.includes(`${resolve(webNextDir, "dev")}`),
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
