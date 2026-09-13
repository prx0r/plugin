import { constants } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";

const DEFAULT_CANDIDATES = [
  "chromium",
  "google-chrome",
  "google-chrome-stable",
  "chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

async function executablePath(candidate, env, accessFn) {
  const hasPathSeparator = candidate.includes("/") || candidate.includes("\\");
  const paths = hasPathSeparator
    ? [path.resolve(candidate)]
    : String(env.PATH || "").split(path.delimiter).filter(Boolean).map((
      entry,
    ) => path.join(entry, candidate));

  for (const executable of paths) {
    try {
      await accessFn(executable, constants.X_OK);
      return executable;
    } catch {
      // Try the next concrete path; a command name alone is not evidence.
    }
  }
  return null;
}

export async function findChrome({
  env = process.env,
  candidates = DEFAULT_CANDIDATES,
  accessFn = access,
} = {}) {
  const override = env.CHROME_BIN;
  const requested = override ? [override] : candidates;

  for (const candidate of requested) {
    const executable = await executablePath(candidate, env, accessFn);
    if (executable) return executable;
  }

  if (override) {
    throw new Error(`CHROME_BIN is not executable: ${override}`);
  }
  throw new Error("No Chrome/Chromium executable found. Set CHROME_BIN.");
}
