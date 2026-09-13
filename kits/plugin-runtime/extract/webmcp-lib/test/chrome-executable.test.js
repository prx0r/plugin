import path from "node:path";
import { findChrome } from "./chrome-executable.mjs";

Deno.test("Chrome selection resolves an existing PATH candidate", async () => {
  const attempts = [];
  const expected = path.join("/second", "chromium");
  const selected = await findChrome({
    env: { PATH: ["/first", "/second"].join(path.delimiter) },
    candidates: ["chromium", "google-chrome"],
    accessFn(candidate) {
      attempts.push(candidate);
      if (candidate === expected) return Promise.resolve();
      return Promise.reject(new Error("missing"));
    },
  });

  if (selected !== expected || attempts.length !== 2) {
    throw new Error(`Did not resolve the existing candidate: ${attempts}`);
  }
});

Deno.test("Chrome selection honors and validates CHROME_BIN", async () => {
  const override = "/custom/chrome";
  let checked;
  const selected = await findChrome({
    env: { CHROME_BIN: override, PATH: "/ignored" },
    candidates: ["chromium"],
    accessFn(candidate) {
      checked = candidate;
      return Promise.resolve();
    },
  });
  if (selected !== override || checked !== override) {
    throw new Error("CHROME_BIN override was not selected");
  }

  let rejected = false;
  try {
    await findChrome({
      env: { CHROME_BIN: "/missing/chrome", PATH: "/ignored" },
      accessFn: () => Promise.reject(new Error("missing")),
    });
  } catch (error) {
    rejected = error.message.includes("CHROME_BIN is not executable");
  }
  if (!rejected) throw new Error("Invalid CHROME_BIN was not rejected");
});
