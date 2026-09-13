import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

describe("intel store", () => {
  it("validates clean with no errors", () => {
    const out = execFileSync("python3", ["intel/check.py"], { encoding: "utf8" });
    assert.ok(out.includes("intel OK"));
  });
});
